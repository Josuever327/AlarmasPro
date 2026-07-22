// Capa de base de datos local (SQLite).
// Todo se guarda EN EL TELÉFONO, funciona sin internet y persiste al cerrar la app.
import * as SQLite from 'expo-sqlite';
import { Alarm, NewAlarm } from './types';

// Abre (o crea la primera vez) el archivo de base de datos.
const db = SQLite.openDatabaseSync('alarmas.db');

// Crea las tablas si todavía no existen. Los días se guardan como texto "1,3,5".
export function initDb() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS alarms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hour INTEGER NOT NULL,
      minute INTEGER NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      days TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  // Migración: agrega columnas nuevas si la tabla ya existía de una versión previa.
  addColumnIfMissing('vibrate', 'INTEGER NOT NULL DEFAULT 1');
  addColumnIfMissing('sound', "TEXT NOT NULL DEFAULT 'default'");
}

// Agrega una columna a la tabla alarms solo si todavía no existe.
function addColumnIfMissing(name: string, definition: string) {
  const cols = db.getAllSync<any>('PRAGMA table_info(alarms)');
  if (!cols.some((c) => c.name === name)) {
    db.execSync(`ALTER TABLE alarms ADD COLUMN ${name} ${definition}`);
  }
}

// --- Ajustes (clave/valor) ---

export function getSetting(key: string): string | null {
  const row = db.getFirstSync<any>(
    'SELECT value FROM settings WHERE key = ?',
    key
  );
  return row ? row.value : null;
}

export function setSetting(key: string, value: string) {
  db.runSync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
    key,
    value,
    value
  );
}

// Convierte una fila de la base de datos a un objeto Alarm de la app.
function rowToAlarm(row: any): Alarm {
  return {
    id: row.id,
    hour: row.hour,
    minute: row.minute,
    label: row.label,
    days: row.days ? row.days.split(',').map(Number) : [],
    enabled: row.enabled === 1,
    vibrate: row.vibrate === 1,
    sound: row.sound || 'default',
  };
}

// Devuelve todas las alarmas ordenadas por hora.
export function getAlarms(): Alarm[] {
  const rows = db.getAllSync<any>(
    'SELECT * FROM alarms ORDER BY hour, minute'
  );
  return rows.map(rowToAlarm);
}

// Inserta una alarma nueva y devuelve su id generado.
export function insertAlarm(a: NewAlarm): number {
  const result = db.runSync(
    'INSERT INTO alarms (hour, minute, label, days, enabled, vibrate, sound) VALUES (?, ?, ?, ?, ?, ?, ?)',
    a.hour,
    a.minute,
    a.label,
    a.days.join(','),
    a.enabled ? 1 : 0,
    a.vibrate ? 1 : 0,
    a.sound
  );
  return result.lastInsertRowId;
}

// Actualiza una alarma existente.
export function updateAlarm(a: Alarm) {
  db.runSync(
    'UPDATE alarms SET hour = ?, minute = ?, label = ?, days = ?, enabled = ?, vibrate = ?, sound = ? WHERE id = ?',
    a.hour,
    a.minute,
    a.label,
    a.days.join(','),
    a.enabled ? 1 : 0,
    a.vibrate ? 1 : 0,
    a.sound,
    a.id
  );
}

// Enciende / apaga una alarma.
export function setEnabled(id: number, enabled: boolean) {
  db.runSync('UPDATE alarms SET enabled = ? WHERE id = ?', enabled ? 1 : 0, id);
}

// Borra una alarma.
export function deleteAlarm(id: number) {
  db.runSync('DELETE FROM alarms WHERE id = ?', id);
}

// --- Operaciones masivas ---

// Enciende o apaga TODAS las alarmas de una sola vez.
export function setAllEnabled(enabled: boolean) {
  db.runSync('UPDATE alarms SET enabled = ?', enabled ? 1 : 0);
}

// Borra TODAS las alarmas.
export function deleteAllAlarms() {
  db.runSync('DELETE FROM alarms');
}

// Inserta muchas alarmas de una sola vez (usado por "Generar alarmas").
export function insertManyAlarms(list: NewAlarm[]) {
  db.withTransactionSync(() => {
    for (const a of list) {
      insertAlarm(a);
    }
  });
}
