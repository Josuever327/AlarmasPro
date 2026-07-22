// Motor de alarmas con Notifee (requiere development build, NO funciona en Expo Go).
// Notifee se carga de forma PEREZOSA: si estamos en Expo Go, estas funciones no
// hacen nada (para que la interfaz siga abriendo). En el dev build hacen todo:
//  - Android: sonido fuerte en canal de alarma, disparo exacto con AlarmManager,
//    pantalla completa sobre el bloqueo, bypass de "No molestar", vibración y loop.
//  - iOS: notificación con sonido e "interrupción time-sensitive" (Apple NO permite
//    ignorar el interruptor de silencio a apps de terceros).
import { Platform } from 'react-native';
import type { Alarm } from './types';
import { isExpoGo } from './env';

type NotifeeModule = typeof import('@notifee/react-native');

let cached: NotifeeModule | null = null;

// Carga Notifee solo si NO estamos en Expo Go. Devuelve null si no está disponible.
function loadNotifee(): NotifeeModule | null {
  if (isExpoGo) return null;
  if (!cached) cached = require('@notifee/react-native');
  return cached;
}

// Indica si el motor de alarmas real está disponible (development build).
export function alarmsAvailable(): boolean {
  return !isExpoGo;
}

// --- Canales ---
// En Android el SONIDO es una propiedad del CANAL, no de cada notificación. Por eso
// creamos un canal por combinación de (sonido, vibración) y usamos el que toque.

function soundInfo(sound: string) {
  const isDefault = !sound || sound === 'default';
  // Un sonido incluido es un nombre corto (ej: 'clasica'); uno propio es una ruta.
  const isCustomFile = !isDefault && (sound.includes('/') || sound.includes(':'));
  return { isDefault, isCustomFile };
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

// Crea (si hace falta) y devuelve el id del canal para ese sonido y vibración.
async function ensureChannel(
  mod: NotifeeModule,
  sound: string,
  vibrate: boolean
): Promise<string> {
  const { isDefault, isCustomFile } = soundInfo(sound);
  const key = isDefault ? 'default' : isCustomFile ? 'c' + simpleHash(sound) : sound;
  const id = `alarm_${key}_${vibrate ? 'v' : 'n'}`;
  if (Platform.OS !== 'android') return id;
  await mod.default.createChannel({
    id,
    name: 'Alarmas',
    importance: mod.AndroidImportance.HIGH,
    sound: isDefault ? 'default' : sound,
    vibration: vibrate,
    vibrationPattern: vibrate ? [300, 500, 300, 500] : undefined,
    bypassDnd: true, // ignorar "No molestar" (requiere permiso de política de notificaciones)
    visibility: mod.AndroidVisibility.PUBLIC,
  });
  return id;
}

// Pide permisos (notificaciones y, en Android 12+, alarmas exactas / DND). true si OK.
export async function ensurePermissions(): Promise<boolean> {
  const mod = loadNotifee();
  if (!mod) return false;
  await ensureChannel(mod, 'default', true);
  const settings = await mod.default.requestPermission();
  // authorizationStatus >= 1 (AUTHORIZED o PROVISIONAL) significa concedido.
  return settings.authorizationStatus >= 1;
}

// Construye el contenido nativo de la alarma según su configuración.
function buildNotification(mod: NotifeeModule, alarm: Alarm, channelId: string) {
  const body = alarm.label || `${pad(alarm.hour)}:${pad(alarm.minute)}`;
  const { isDefault, isCustomFile } = soundInfo(alarm.sound);
  // iOS usa el sonido en la propia notificación (no hay canales). El archivo
  // propio necesitaría estar embebido en el build, así que ahí va el default.
  const iosSound = isDefault || isCustomFile ? 'default' : `${alarm.sound}.wav`;
  return {
    id: `alarm-${alarm.id}`,
    title: 'Alarma',
    body,
    data: {
      hour: String(alarm.hour),
      minute: String(alarm.minute),
      label: alarm.label,
    },
    android: {
      channelId,
      category: mod.AndroidCategory.ALARM,
      importance: mod.AndroidImportance.HIGH,
      loopSound: true, // el sonido se repite hasta que la descartan
      // Abre la app a pantalla completa aunque el celu esté bloqueado.
      fullScreenAction: { id: 'default' },
      pressAction: { id: 'default' },
      ongoing: true,
      autoCancel: false,
    },
    ios: {
      sound: iosSound,
      critical: true, // ignorado si Apple no otorga el entitlement de alertas críticas
      interruptionLevel: 'timeSensitive' as const,
    },
  };
}

// Programa las notificaciones (disparadores) de UNA alarma.
async function scheduleAlarm(mod: NotifeeModule, alarm: Alarm) {
  const now = new Date();
  const channelId = await ensureChannel(mod, alarm.sound, alarm.vibrate);
  const base = buildNotification(mod, alarm, channelId);

  if (alarm.days.length === 0) {
    // Una sola vez: próxima vez que llegue esa hora.
    const date = nextOnce(alarm.hour, alarm.minute, now);
    await createTrigger(mod, base, alarm.id, 'once', date.getTime());
  } else {
    // Repetitiva: un disparador semanal por cada día elegido.
    for (const day of alarm.days) {
      const date = nextForWeekday(day, alarm.hour, alarm.minute, now);
      await createTrigger(
        mod,
        base,
        alarm.id,
        `d${day}`,
        date.getTime(),
        mod.RepeatFrequency.WEEKLY
      );
    }
  }
}

// Crea un disparador exacto con AlarmManager (modo "alarm clock": exento de doze).
async function createTrigger(
  mod: NotifeeModule,
  base: ReturnType<typeof buildNotification>,
  alarmId: number,
  suffix: string,
  timestamp: number,
  repeat?: number
) {
  const trigger = {
    type: mod.TriggerType.TIMESTAMP,
    timestamp,
    repeatFrequency: repeat,
    alarmManager: { type: mod.AlarmType.SET_ALARM_CLOCK },
  };
  await mod.default.createTriggerNotification(
    { ...base, id: `alarm-${alarmId}-${suffix}` },
    trigger as any
  );
}

// Reprograma TODO desde cero: cancela lo pendiente y reagenda las alarmas activas.
export async function syncAlarms(alarms: Alarm[]) {
  const mod = loadNotifee();
  if (!mod) return; // en Expo Go no hacemos nada
  await mod.default.cancelTriggerNotifications();
  for (const alarm of alarms) {
    if (alarm.enabled) {
      await scheduleAlarm(mod, alarm);
    }
  }
}

// Detiene/descarta una alarma que está sonando (corta el sonido en loop).
export async function stopAlarm(notificationId?: string) {
  const mod = loadNotifee();
  if (!mod) return;
  if (notificationId) {
    await mod.default.cancelDisplayedNotification(notificationId);
  } else {
    await mod.default.cancelAllNotifications();
  }
}

// Dispara una alarma de prueba en 10 segundos (con el sonido indicado, o el default).
export async function scheduleTestAlarm(sound = 'default'): Promise<void> {
  const mod = loadNotifee();
  if (!mod) return;
  const channelId = await ensureChannel(mod, sound, true);
  const fire = new Date(Date.now() + 10_000);
  const { isDefault, isCustomFile } = soundInfo(sound);
  await mod.default.createTriggerNotification(
    {
      id: 'test-alarm',
      title: 'Prueba de alarma',
      body: 'Si ves y escuchás esto, las alarmas funcionan.',
      data: {
        hour: String(fire.getHours()),
        minute: String(fire.getMinutes()),
        label: 'Prueba de alarma',
      },
      android: {
        channelId,
        category: mod.AndroidCategory.ALARM,
        importance: mod.AndroidImportance.HIGH,
        loopSound: true,
        fullScreenAction: { id: 'default' },
        pressAction: { id: 'default' },
      },
      ios: {
        sound: isDefault || isCustomFile ? 'default' : `${sound}.wav`,
        critical: true,
        interruptionLevel: 'timeSensitive',
      },
    },
    {
      type: mod.TriggerType.TIMESTAMP,
      timestamp: fire.getTime(),
      alarmManager: { type: mod.AlarmType.SET_ALARM_CLOCK },
    } as any
  );
}

// --- Cálculo de próximas fechas ---

function nextOnce(hour: number, minute: number, now: Date): Date {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

function nextForWeekday(day: number, hour: number, minute: number, now: Date): Date {
  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(hour, minute, 0, 0);
    if (d.getDay() === day && d.getTime() > now.getTime()) return d;
  }
  const d = new Date(now);
  d.setDate(d.getDate() + 7);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
