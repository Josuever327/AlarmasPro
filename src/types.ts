// Modelo de datos de una alarma.
// `days` guarda los días de la semana en que se repite: 0 = domingo ... 6 = sábado.
// Si `days` está vacío, la alarma suena una sola vez.
export interface Alarm {
  id: number;
  hour: number; // 0-23
  minute: number; // 0-59
  label: string;
  days: number[]; // días de repetición
  enabled: boolean;
  vibrate: boolean; // si vibra al sonar
  sound: string; // nombre del sonido ('default' = el predeterminado)
}

// Sonidos incluidos en la app (se empaquetan en el build vía expo-notifications).
// 'default' usa el sonido de alarma del sistema. Los demás son archivos .wav
// en assets/sounds. El usuario además puede cargar un sonido propio.
export const SOUNDS: { key: string; label: string }[] = [
  { key: 'default', label: 'Predeterminado' },
  { key: 'clasica', label: 'Clásica' },
  { key: 'suave', label: 'Suave' },
  { key: 'intensa', label: 'Intensa' },
];

// Alarma antes de guardarse (todavía no tiene id).
export type NewAlarm = Omit<Alarm, 'id'>;

export const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const DAY_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

// Formato de hora que elige el usuario.
export type HourFormat = '12' | '24';

// Formatea una hora respetando el formato elegido por el usuario.
export function formatTime(
  hour: number,
  minute: number,
  format: HourFormat
): string {
  const mm = minute.toString().padStart(2, '0');
  if (format === '24') {
    return `${hour.toString().padStart(2, '0')}:${mm}`;
  }
  const suffix = hour < 12 ? 'AM' : 'PM';
  let h12 = hour % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${mm} ${suffix}`;
}
