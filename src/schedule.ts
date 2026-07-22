// Cálculos de "cuándo suena" una alarma, para la cuenta regresiva del listado.
import { Alarm } from './types';

// Devuelve la próxima fecha/hora exacta en que sonará una alarma, o null si no aplica.
export function nextOccurrence(alarm: Alarm, now: Date): Date | null {
  // Alarma de una sola vez: hoy si todavía no pasó, si no mañana.
  if (alarm.days.length === 0) {
    const d = new Date(now);
    d.setHours(alarm.hour, alarm.minute, 0, 0);
    if (d.getTime() <= now.getTime()) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  // Alarma repetitiva: busco el próximo día (dentro de la semana) que coincida.
  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(alarm.hour, alarm.minute, 0, 0);
    if (alarm.days.includes(d.getDay()) && d.getTime() > now.getTime()) {
      return d;
    }
  }
  return null;
}

// De todas las alarmas activas, cuál es la que suena primero.
export function nextAlarm(
  alarms: Alarm[],
  now: Date
): { alarm: Alarm; date: Date } | null {
  let best: { alarm: Alarm; date: Date } | null = null;
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const date = nextOccurrence(alarm, now);
    if (!date) continue;
    if (!best || date.getTime() < best.date.getTime()) {
      best = { alarm, date };
    }
  }
  return best;
}

// Convierte milisegundos restantes a un texto tipo "2 h 05 min 30 s".
export function formatCountdown(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (days > 0) {
    return `${days} d ${pad(hours)} h ${pad(minutes)} min`;
  }
  if (hours > 0) {
    return `${hours} h ${pad(minutes)} min ${pad(seconds)} s`;
  }
  if (minutes > 0) {
    return `${minutes} min ${pad(seconds)} s`;
  }
  return `${seconds} s`;
}
