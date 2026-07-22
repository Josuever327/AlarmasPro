import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  LogBox,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';

import {
  Alarm,
  DAY_LABELS,
  HourFormat,
  SOUNDS,
  formatTime,
  NewAlarm,
} from './src/types';
import {
  deleteAlarm,
  deleteAllAlarms,
  getAlarms,
  getSetting,
  initDb,
  insertAlarm,
  insertManyAlarms,
  setAllEnabled,
  setEnabled,
  setSetting,
  updateAlarm,
} from './src/db';
import { ensurePermissions, scheduleTestAlarm, syncAlarms } from './src/notifications';
import AlarmListScreen from './src/AlarmListScreen';
import RingingScreen, { Ringing } from './src/RingingScreen';
import { Colors, ThemeMode, getColors } from './src/theme';
import { isExpoGo } from './src/env';
import { SOUND_ASSETS } from './src/soundAssets';

// Silencia el aviso de push remoto de Expo Go.
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
]);

type Tab = 'home' | 'list';
type Styles = ReturnType<typeof makeStyles>;

// Carga expo-audio SOLO si su módulo nativo está presente (dev build ya rebuildeado).
// Así el build actual no crashea al importar un módulo que todavía no tiene.
let AudioLib: any = null;
try {
  const core = require('expo-modules-core');
  const hasNative =
    typeof core.requireOptionalNativeModule === 'function'
      ? core.requireOptionalNativeModule('ExpoAudio')
      : null;
  if (hasNative) AudioLib = require('expo-audio');
} catch {}

// Nombre corto para mostrar un sonido (bundleado o personalizado).
function soundLabel(sound: string): string {
  if (!sound || sound === 'default') return 'Predeterminado';
  const known = SOUNDS.find((s) => s.key === sound);
  if (known) return known.label;
  const parts = sound.split('/');
  return decodeURIComponent(parts[parts.length - 1]) || 'Sonido propio';
}

// Extrae los datos de la alarma que suena desde una notificación de Notifee.
function ringingFrom(n: any): Ringing | null {
  if (!n || !n.data || n.data.hour === undefined) return null;
  return {
    id: n.id,
    hour: Number(n.data.hour),
    minute: Number(n.data.minute),
    label: n.data.label || '',
  };
}

export default function App() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [hourFormat, setHourFormat] = useState<HourFormat>('24');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [tab, setTab] = useState<Tab>('home');

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Alarm | null>(null);
  const [generateVisible, setGenerateVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [ringing, setRinging] = useState<Ringing | null>(null);

  // Ajustes globales por defecto para las alarmas nuevas.
  const [defaultSound, setDefaultSound] = useState('default');
  const [defaultVibrate, setDefaultVibrate] = useState(true);

  const colors = getColors(theme);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    initDb();
    ensurePermissions();
    const fmt = getSetting('hourFormat');
    if (fmt === '12' || fmt === '24') setHourFormat(fmt);
    const th = getSetting('theme');
    if (th === 'dark' || th === 'light') setTheme(th);
    const ds = getSetting('defaultSound');
    if (ds) setDefaultSound(ds);
    const dv = getSetting('defaultVibrate');
    if (dv !== null) setDefaultVibrate(dv === '1');
    refresh();
  }, []);

  // Muestra la ventana emergente cuando suena una alarma.
  useEffect(() => {
    if (isExpoGo) return;
    const notifee = require('@notifee/react-native').default;
    const { EventType } = require('@notifee/react-native');

    // Revisa si hay una alarma sonando ahora mismo (notificación activa) y
    // levanta la ventanita. Se llama al abrir y cada vez que la app se activa
    // (por ej. cuando la pantalla completa la trae al frente).
    async function checkRinging() {
      try {
        const displayed = await notifee.getDisplayedNotifications();
        const found = displayed.find(
          (d: any) => d.notification?.data?.hour !== undefined
        );
        if (found) {
          const r = ringingFrom(found.notification);
          if (r) setRinging(r);
        }
      } catch {}
    }
    checkRinging();

    const appSub = AppState.addEventListener('change', (st) => {
      if (st === 'active') checkRinging();
    });

    const unsub = notifee.onForegroundEvent(async ({ type, detail }: any) => {
      const n = detail.notification;
      if (!n) return;
      if (type === EventType.DELIVERED || type === EventType.PRESS) {
        const r = ringingFrom(n);
        if (r) setRinging(r);
      } else if (type === EventType.DISMISSED && n.id) {
        await notifee.cancelNotification(n.id);
      }
    });

    return () => {
      appSub.remove();
      unsub();
    };
  }, []);

  // Apaga la alarma que está sonando (corta el sonido y cierra la ventanita).
  async function stopRinging() {
    if (ringing && !isExpoGo) {
      const notifee = require('@notifee/react-native').default;
      await notifee.cancelNotification(ringing.id);
    }
    setRinging(null);
  }

  function refresh() {
    const data = getAlarms();
    setAlarms(data);
    syncAlarms(data);
  }

  function toggle(alarm: Alarm) {
    setEnabled(alarm.id, !alarm.enabled);
    refresh();
  }

  function remove(alarm: Alarm) {
    deleteAlarm(alarm.id);
    refresh();
  }

  function openCreate() {
    setEditing(null);
    setFormVisible(true);
  }

  function openEdit(alarm: Alarm) {
    setEditing(alarm);
    setFormVisible(true);
  }

  function changeFormat(fmt: HourFormat) {
    setHourFormat(fmt);
    setSetting('hourFormat', fmt);
  }

  function toggleTheme() {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setSetting('theme', next);
  }

  function changeDefaultSound(s: string) {
    setDefaultSound(s);
    setSetting('defaultSound', s);
  }

  function changeDefaultVibrate(v: boolean) {
    setDefaultVibrate(v);
    setSetting('defaultVibrate', v ? '1' : '0');
  }

  // --- Acciones del menú de opciones ---

  async function testAlarm() {
    setMenuVisible(false);
    if (isExpoGo) {
      Alert.alert(
        'Solo en la app instalada',
        'Las alarmas reales funcionan en el development build (la APK propia), no en Expo Go.'
      );
      return;
    }
    const ok = await ensurePermissions();
    if (!ok) {
      Alert.alert(
        'Permiso necesario',
        'Activá los permisos de notificaciones para que suenen las alarmas.'
      );
      return;
    }
    await scheduleTestAlarm(defaultSound);
    Alert.alert('Prueba programada', 'En 10 segundos debería sonar.');
  }

  function allOn() {
    setAllEnabled(true);
    setMenuVisible(false);
    refresh();
  }

  function allOff() {
    setAllEnabled(false);
    setMenuVisible(false);
    refresh();
  }

  function confirmDeleteAll() {
    setMenuVisible(false);
    if (alarms.length === 0) return;
    Alert.alert(
      'Eliminar todas',
      `¿Seguro que querés borrar las ${alarms.length} alarmas?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            deleteAllAlarms();
            refresh();
          },
        },
      ]
    );
  }

  const enabledCount = alarms.filter((a) => a.enabled).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={colors.statusBar} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Alarmas</Text>
          <Text style={styles.subtitle}>
            {alarms.length} en total · {enabledCount} activas
          </Text>
        </View>
        <View style={styles.headerBtns}>
          <Pressable style={styles.themeBtn} onPress={toggleTheme} hitSlop={8}>
            <Text style={styles.themeBtnText}>
              {theme === 'dark' ? 'Claro' : 'Oscuro'}
            </Text>
          </Pressable>
          <Pressable style={styles.menuBtn} onPress={() => setMenuVisible(true)} hitSlop={8}>
            <Text style={styles.menuBtnText}>⋯</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tabBar}>
        {(
          [
            { key: 'home', label: 'Mis alarmas' },
            { key: 'list', label: 'Listado' },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isExpoGo && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Modo Expo Go: podés diseñar y probar la interfaz, pero las alarmas
            suenan solo en la APK instalada (development build).
          </Text>
        </View>
      )}

      {tab === 'list' && (
        <AlarmListScreen
          alarms={alarms}
          format={hourFormat}
          colors={colors}
          onToggle={toggle}
        />
      )}

      {tab === 'home' && (
        <>
          <View style={styles.formatRow}>
            {(['24', '12'] as HourFormat[]).map((fmt) => (
              <Pressable
                key={fmt}
                style={[styles.formatChip, hourFormat === fmt && styles.formatChipActive]}
                onPress={() => changeFormat(fmt)}
              >
                <Text
                  style={[
                    styles.formatChipText,
                    hourFormat === fmt && styles.formatChipTextActive,
                  ]}
                >
                  {fmt === '24' ? '24 h' : '12 h (AM/PM)'}
                </Text>
              </Pressable>
            ))}
          </View>

          <FlatList
            data={alarms}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>
                No tenés alarmas todavía.{'\n'}Tocá Personalizar para crear una o
                Generar varias.
              </Text>
            }
            renderItem={({ item }) => (
              <AlarmRow
                alarm={item}
                format={hourFormat}
                styles={styles}
                colors={colors}
                onEdit={openEdit}
                onToggle={toggle}
                onDelete={remove}
              />
            )}
          />

          <View style={styles.bottomBar}>
            <Pressable
              style={[styles.bottomBtn, styles.generateBtn]}
              onPress={() => setGenerateVisible(true)}
            >
              <Text style={styles.generateBtnText}>Generar varias</Text>
            </Pressable>
            <Pressable style={[styles.bottomBtn, styles.addBtn]} onPress={openCreate}>
              <Text style={styles.addBtnText}>Personalizar</Text>
            </Pressable>
          </View>
        </>
      )}

      <OptionsMenu
        visible={menuVisible}
        styles={styles}
        onClose={() => setMenuVisible(false)}
        onTest={testAlarm}
        onSettings={() => {
          setMenuVisible(false);
          setSettingsVisible(true);
        }}
        onAllOn={allOn}
        onAllOff={allOff}
        onDeleteAll={confirmDeleteAll}
      />

      <AlarmFormModal
        visible={formVisible}
        editing={editing}
        defaultSound={defaultSound}
        defaultVibrate={defaultVibrate}
        styles={styles}
        colors={colors}
        onClose={() => setFormVisible(false)}
        onSaved={refresh}
      />

      <GenerateModal
        visible={generateVisible}
        defaultSound={defaultSound}
        defaultVibrate={defaultVibrate}
        styles={styles}
        colors={colors}
        onClose={() => setGenerateVisible(false)}
        onSaved={refresh}
      />

      <SettingsModal
        visible={settingsVisible}
        sound={defaultSound}
        vibrate={defaultVibrate}
        styles={styles}
        colors={colors}
        onChangeSound={changeDefaultSound}
        onChangeVibrate={changeDefaultVibrate}
        onClose={() => setSettingsVisible(false)}
      />

      <RingingScreen
        ringing={ringing}
        format={hourFormat}
        colors={colors}
        onStop={stopRinging}
      />
    </SafeAreaView>
  );
}

// ---------- Fila de alarma ----------

function AlarmRow({
  alarm,
  format,
  styles,
  colors,
  onEdit,
  onToggle,
  onDelete,
}: {
  alarm: Alarm;
  format: HourFormat;
  styles: Styles;
  colors: Colors;
  onEdit: (a: Alarm) => void;
  onToggle: (a: Alarm) => void;
  onDelete: (a: Alarm) => void;
}) {
  const repeatText =
    alarm.days.length === 0
      ? 'Una vez'
      : alarm.days
          .slice()
          .sort()
          .map((d) => DAY_LABELS[d])
          .join(' ');

  return (
    <View style={[styles.card, !alarm.enabled && styles.cardDisabled]}>
      <Pressable style={styles.cardLeft} onPress={() => onEdit(alarm)}>
        <Text style={styles.time}>{formatTime(alarm.hour, alarm.minute, format)}</Text>
        {!!alarm.label && <Text style={styles.label}>{alarm.label}</Text>}
        <Text style={styles.repeat}>{repeatText}</Text>
      </Pressable>
      <View style={styles.cardRight}>
        <Switch
          value={alarm.enabled}
          onValueChange={() => onToggle(alarm)}
          trackColor={{ true: colors.primary }}
        />
        <Pressable onPress={() => onDelete(alarm)} hitSlop={10}>
          <Text style={styles.delete}>Borrar</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------- Menú de opciones (acciones masivas) ----------

function OptionsMenu({
  visible,
  styles,
  onClose,
  onTest,
  onSettings,
  onAllOn,
  onAllOff,
  onDeleteAll,
}: {
  visible: boolean;
  styles: Styles;
  onClose: () => void;
  onTest: () => void;
  onSettings: () => void;
  onAllOn: () => void;
  onAllOff: () => void;
  onDeleteAll: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={styles.menuCard}>
          <Pressable style={styles.menuItem} onPress={onSettings}>
            <Text style={styles.menuItemText}>Ajustes</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={onTest}>
            <Text style={styles.menuItemText}>Probar alarma (10s)</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={onAllOn}>
            <Text style={styles.menuItemText}>Encender todas</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={onAllOff}>
            <Text style={styles.menuItemText}>Apagar todas</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={onDeleteAll}>
            <Text style={[styles.menuItemText, styles.menuItemDanger]}>Eliminar todas</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

// ---------- Selector de sonido reutilizable ----------

function SoundSelector({
  value,
  onChange,
  styles,
}: {
  value: string;
  onChange: (s: string) => void;
  styles: Styles;
}) {
  // El valor es custom si no es 'default' ni una de las opciones incluidas.
  const isBundled = SOUNDS.some((s) => s.key === value);
  const isCustom = value !== 'default' && !isBundled;
  const playerRef = useRef<any>(null);

  // Corta cualquier preview en curso.
  function stopPreview() {
    if (playerRef.current) {
      try {
        playerRef.current.remove();
      } catch {}
      playerRef.current = null;
    }
  }

  useEffect(() => stopPreview, []);

  // Reproduce el sonido para que el usuario lo escuche al elegirlo.
  // Requiere expo-audio (development build ya rebuildeado); si no está, no hace nada.
  function preview(key: string) {
    const src = key === 'default' ? null : SOUND_ASSETS[key] ?? { uri: key };
    if (!src || !AudioLib) return;
    try {
      stopPreview();
      const p = AudioLib.createAudioPlayer(src);
      p.volume = 1;
      p.play();
      playerRef.current = p;
    } catch {}
  }

  function select(key: string) {
    onChange(key);
    preview(key);
  }

  async function pickSound() {
    const res = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
    });
    if (!res.canceled && res.assets && res.assets[0]) {
      onChange(res.assets[0].uri);
      preview(res.assets[0].uri);
    }
  }

  return (
    <View style={styles.soundRow}>
      {SOUNDS.map((s) => {
        const active = value === s.key;
        return (
          <Pressable
            key={s.key}
            style={[styles.soundChip, active && styles.soundChipActive]}
            onPress={() => select(s.key)}
          >
            <Text style={[styles.soundChipText, active && styles.soundChipTextActive]}>
              {s.label}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        style={[styles.soundChip, isCustom && styles.soundChipActive]}
        onPress={pickSound}
      >
        <Text style={[styles.soundChipText, isCustom && styles.soundChipTextActive]}>
          {isCustom ? soundLabel(value) : 'Cargar…'}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------- Modal: crear o editar una alarma ----------

function AlarmFormModal({
  visible,
  editing,
  defaultSound,
  defaultVibrate,
  styles,
  colors,
  onClose,
  onSaved,
}: {
  visible: boolean;
  editing: Alarm | null;
  defaultSound: string;
  defaultVibrate: boolean;
  styles: Styles;
  colors: Colors;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pickerDate, setPickerDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [label, setLabel] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [vibrate, setVibrate] = useState(true);
  const [sound, setSound] = useState('default');

  // Carga los valores al abrir: los de la alarma si estamos editando, o por defecto.
  useEffect(() => {
    if (!visible) return;
    if (editing) {
      const d = new Date();
      d.setHours(editing.hour, editing.minute, 0, 0);
      setPickerDate(d);
      setLabel(editing.label);
      setSelectedDays(editing.days);
      setVibrate(editing.vibrate);
      setSound(editing.sound);
    } else {
      setPickerDate(new Date());
      setLabel('');
      setSelectedDays([]);
      setVibrate(defaultVibrate);
      setSound(defaultSound);
    }
    setShowPicker(Platform.OS === 'ios');
  }, [visible, editing]);

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function save() {
    const data: NewAlarm = {
      hour: pickerDate.getHours(),
      minute: pickerDate.getMinutes(),
      label: label.trim(),
      days: selectedDays,
      enabled: editing ? editing.enabled : true,
      vibrate,
      sound,
    };
    if (editing) {
      updateAlarm({ ...data, id: editing.id });
    } else {
      insertAlarm(data);
    }
    onClose();
    onSaved();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {editing ? 'Editar alarma' : 'Nueva alarma'}
          </Text>

          {Platform.OS === 'android' && (
            <Pressable style={styles.timeButton} onPress={() => setShowPicker(true)}>
              <Text style={styles.timeButtonText}>
                {pad(pickerDate.getHours())}:{pad(pickerDate.getMinutes())}
              </Text>
            </Pressable>
          )}

          {showPicker && (
            <DateTimePicker
              value={pickerDate}
              mode="time"
              is24Hour
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => {
                if (Platform.OS === 'android') setShowPicker(false);
                if (date) setPickerDate(date);
              }}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Etiqueta (ej: Ir al gym)"
            placeholderTextColor={colors.placeholder}
            value={label}
            onChangeText={setLabel}
          />

          <Text style={styles.daysLabel}>Repetir en los días</Text>
          <View style={styles.daysRow}>
            {DAY_LABELS.map((d, i) => {
              const active = selectedDays.includes(i);
              return (
                <Pressable
                  key={i}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  onPress={() => toggleDay(i)}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                    {d}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.daysLabel}>Sonido</Text>
          <SoundSelector value={sound} onChange={setSound} styles={styles} />

          <View style={styles.rowBetween}>
            <Text style={styles.daysLabel}>Vibrar</Text>
            <Switch
              value={vibrate}
              onValueChange={setVibrate}
              trackColor={{ true: colors.primary }}
            />
          </View>

          <ModalActions
            styles={styles}
            onCancel={onClose}
            onSave={save}
            saveLabel={editing ? 'Guardar cambios' : 'Crear'}
          />
        </View>
      </View>
    </Modal>
  );
}

// ---------- Modal: ajustes globales ----------

function SettingsModal({
  visible,
  sound,
  vibrate,
  styles,
  colors,
  onChangeSound,
  onChangeVibrate,
  onClose,
}: {
  visible: boolean;
  sound: string;
  vibrate: boolean;
  styles: Styles;
  colors: Colors;
  onChangeSound: (s: string) => void;
  onChangeVibrate: (v: boolean) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Ajustes</Text>
          <Text style={styles.settingsHint}>
            Valores por defecto que se aplican a las alarmas nuevas (podés
            cambiarlos en cada alarma).
          </Text>

          <Text style={styles.daysLabel}>Sonido por defecto</Text>
          <SoundSelector value={sound} onChange={onChangeSound} styles={styles} />

          <View style={styles.rowBetween}>
            <Text style={styles.daysLabel}>Vibrar por defecto</Text>
            <Switch
              value={vibrate}
              onValueChange={onChangeVibrate}
              trackColor={{ true: colors.primary }}
            />
          </View>

          <Pressable style={[styles.modalBtn, styles.saveBtn, styles.settingsClose]} onPress={onClose}>
            <Text style={styles.saveBtnText}>Listo</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ---------- Modal: generar varias alarmas en lote ----------

function GenerateModal({
  visible,
  defaultSound,
  defaultVibrate,
  styles,
  colors,
  onClose,
  onSaved,
}: {
  visible: boolean;
  defaultSound: string;
  defaultVibrate: boolean;
  styles: Styles;
  colors: Colors;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [from, setFrom] = useState(new Date());
  const [to, setTo] = useState(new Date());
  const [interval, setInterval] = useState('5');
  const [labelPrefix, setLabelPrefix] = useState('');
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);

  useEffect(() => {
    if (visible) {
      const start = new Date();
      const end = new Date();
      end.setHours(end.getHours() + 1);
      setFrom(start);
      setTo(end);
      setInterval('5');
      setLabelPrefix('');
      setShowFrom(false);
      setShowTo(false);
    }
  }, [visible]);

  function buildList(): NewAlarm[] {
    const step = parseInt(interval, 10);
    if (!step || step <= 0) return [];
    const start = from.getHours() * 60 + from.getMinutes();
    const end = to.getHours() * 60 + to.getMinutes();
    if (end < start) return [];
    const list: NewAlarm[] = [];
    let n = 1;
    for (let m = start; m <= end; m += step) {
      list.push({
        hour: Math.floor(m / 60),
        minute: m % 60,
        label: labelPrefix.trim() ? `${labelPrefix.trim()} ${n}` : '',
        days: [],
        enabled: true,
        vibrate: defaultVibrate,
        sound: defaultSound,
      });
      n++;
    }
    return list;
  }

  const preview = buildList();

  function save() {
    if (preview.length === 0) {
      Alert.alert(
        'Revisá los datos',
        'La hora "hasta" debe ser mayor que "desde" y el intervalo válido.'
      );
      return;
    }
    insertManyAlarms(preview);
    onClose();
    onSaved();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Generar varias alarmas</Text>

          <View style={styles.rangeRow}>
            <View style={styles.rangeCol}>
              <Text style={styles.daysLabel}>Desde</Text>
              <Pressable style={styles.timeButton} onPress={() => setShowFrom(true)}>
                <Text style={styles.timeButtonSmall}>
                  {pad(from.getHours())}:{pad(from.getMinutes())}
                </Text>
              </Pressable>
            </View>
            <View style={styles.rangeCol}>
              <Text style={styles.daysLabel}>Hasta</Text>
              <Pressable style={styles.timeButton} onPress={() => setShowTo(true)}>
                <Text style={styles.timeButtonSmall}>
                  {pad(to.getHours())}:{pad(to.getMinutes())}
                </Text>
              </Pressable>
            </View>
          </View>

          {showFrom && (
            <DateTimePicker
              value={from}
              mode="time"
              is24Hour
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => {
                setShowFrom(Platform.OS === 'ios');
                if (date) setFrom(date);
              }}
            />
          )}
          {showTo && (
            <DateTimePicker
              value={to}
              mode="time"
              is24Hour
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => {
                setShowTo(Platform.OS === 'ios');
                if (date) setTo(date);
              }}
            />
          )}

          <Text style={styles.daysLabel}>Cada cuántos minutos</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="5"
            placeholderTextColor={colors.placeholder}
            value={interval}
            onChangeText={setInterval}
          />

          <Text style={styles.daysLabel}>Etiqueta (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="ej: Tomar agua"
            placeholderTextColor={colors.placeholder}
            value={labelPrefix}
            onChangeText={setLabelPrefix}
          />

          <Text style={styles.previewText}>
            Se crearán {preview.length} alarma{preview.length === 1 ? '' : 's'}
          </Text>

          <ModalActions styles={styles} onCancel={onClose} onSave={save} saveLabel="Generar" />
        </View>
      </View>
    </Modal>
  );
}

// ---------- Botones cancelar / guardar reutilizables ----------

function ModalActions({
  styles,
  onCancel,
  onSave,
  saveLabel,
}: {
  styles: Styles;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
}) {
  return (
    <View style={styles.modalActions}>
      <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={onCancel}>
        <Text style={styles.cancelBtnText}>Cancelar</Text>
      </Pressable>
      <Pressable style={[styles.modalBtn, styles.saveBtn]} onPress={onSave}>
        <Text style={styles.saveBtnText}>{saveLabel}</Text>
      </Pressable>
    </View>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingTop: 24,
    },
    headerLeft: { flex: 1 },
    headerBtns: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    title: { color: c.text, fontSize: 28, fontWeight: '700' },
    subtitle: { color: c.textSubtle, fontSize: 13, marginTop: 2 },
    themeBtn: {
      paddingHorizontal: 14,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeBtnText: { color: c.textMuted, fontWeight: '600', fontSize: 13 },
    menuBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuBtnText: { color: c.text, fontSize: 22, marginTop: -8 },
    tabBar: {
      flexDirection: 'row',
      gap: 8,
      marginHorizontal: 20,
      marginTop: 16,
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 4,
    },
    banner: {
      marginHorizontal: 20,
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: c.surface,
    },
    bannerText: { color: c.textMuted, fontSize: 12, lineHeight: 17 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
    tabActive: { backgroundColor: c.surfaceActive },
    tabText: { color: c.textMuted, fontWeight: '600' },
    tabTextActive: { color: c.text },
    formatRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 14 },
    formatChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.card,
    },
    formatChipActive: { backgroundColor: c.primary },
    formatChipText: { color: c.textMuted, fontWeight: '600', fontSize: 13 },
    formatChipTextActive: { color: c.primaryOn },
    list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
    empty: { color: c.textMuted, textAlign: 'center', marginTop: 80, lineHeight: 22 },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 18,
      marginTop: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardDisabled: { opacity: 0.45 },
    cardLeft: { flex: 1 },
    cardRight: { alignItems: 'center', gap: 8 },
    time: { color: c.text, fontSize: 32, fontWeight: '300' },
    label: { color: c.textLabel, fontSize: 15, marginTop: 2 },
    repeat: { color: c.textSubtle, fontSize: 13, marginTop: 4 },
    delete: { color: c.danger, fontSize: 13 },
    bottomBar: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 30,
      flexDirection: 'row',
      gap: 12,
    },
    bottomBtn: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
      elevation: 4,
    },
    generateBtn: { backgroundColor: c.surface },
    generateBtnText: { color: c.textLabel, fontWeight: '600', fontSize: 15 },
    addBtn: { backgroundColor: c.primary },
    addBtnText: { color: c.primaryOn, fontWeight: '700', fontSize: 15 },
    modalBackdrop: { flex: 1, backgroundColor: c.backdrop, justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: c.modalCard,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
    },
    modalTitle: { color: c.text, fontSize: 20, fontWeight: '600', marginBottom: 16 },
    timeButton: {
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 8,
    },
    timeButtonText: { color: c.text, fontSize: 30, fontWeight: '300' },
    timeButtonSmall: { color: c.text, fontSize: 24, fontWeight: '300' },
    input: {
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      color: c.text,
      fontSize: 16,
      marginTop: 6,
    },
    daysLabel: { color: c.textMuted, marginTop: 18, marginBottom: 8 },
    daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dayChip: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayChipActive: { backgroundColor: c.primary },
    dayChipText: { color: c.textMuted, fontWeight: '600' },
    dayChipTextActive: { color: c.primaryOn },
    rangeRow: { flexDirection: 'row', gap: 12 },
    rangeCol: { flex: 1 },
    soundRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    soundChip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.surface,
    },
    soundChipActive: { backgroundColor: c.primary },
    soundChipText: { color: c.textMuted, fontWeight: '600' },
    soundChipTextActive: { color: c.primaryOn },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    settingsHint: { color: c.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 4 },
    settingsClose: { marginTop: 28 },
    previewText: {
      color: c.primary,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 20,
    },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    cancelBtn: { backgroundColor: c.surface },
    cancelBtnText: { color: c.textLabel, fontWeight: '600' },
    saveBtn: { backgroundColor: c.primary },
    saveBtnText: { color: c.primaryOn, fontWeight: '600' },
    menuCard: {
      position: 'absolute',
      top: 70,
      right: 16,
      backgroundColor: c.menuCard,
      borderRadius: 14,
      paddingVertical: 6,
      minWidth: 200,
      elevation: 8,
    },
    menuItem: { paddingVertical: 14, paddingHorizontal: 18 },
    menuItemText: { color: c.text, fontSize: 15 },
    menuItemDanger: { color: c.danger },
  });
}
