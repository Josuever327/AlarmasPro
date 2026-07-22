// Sistema de temas: paleta clara y oscura.
// Los estilos de cada pantalla se construyen a partir de estos colores,
// así toda la app cambia de tema de una sola vez.

export type ThemeMode = 'dark' | 'light';

export interface Colors {
  bg: string; // fondo de pantalla
  card: string; // tarjetas de alarma, chips base
  surface: string; // inputs, botones secundarios, day chips
  surfaceActive: string; // pestaña activa
  modalCard: string; // fondo de los modales
  menuCard: string; // menú de opciones
  text: string; // texto principal (hora, títulos)
  textLabel: string; // etiquetas de alarma
  textMuted: string; // texto secundario / placeholders visibles
  textSubtle: string; // texto muy tenue (repeticiones)
  placeholder: string; // placeholder de inputs
  primary: string; // color de acento (botones, activos)
  primaryOn: string; // texto sobre el acento
  danger: string; // borrar / eliminar
  countdownCard: string; // tarjeta de cuenta regresiva
  countdownValue: string; // número grande de la cuenta regresiva
  countdownLabel: string; // texto de la cuenta regresiva
  backdrop: string; // fondo oscurecido detrás de los modales
  statusBar: 'light' | 'dark'; // color de los íconos de la barra de estado
}

export const dark: Colors = {
  bg: '#0e1116',
  card: '#1a1f29',
  surface: '#1f2530',
  surfaceActive: '#2b3446',
  modalCard: '#151a22',
  menuCard: '#1f2530',
  text: '#ffffff',
  textLabel: '#cdd5e0',
  textMuted: '#8892a6',
  textSubtle: '#6f7a8c',
  placeholder: '#8892a6',
  primary: '#4F7CFF',
  primaryOn: '#ffffff',
  danger: '#ff5c72',
  countdownCard: '#141b2e',
  countdownValue: '#6ea0ff',
  countdownLabel: '#8fa3c8',
  backdrop: 'rgba(0,0,0,0.6)',
  statusBar: 'light',
};

export const light: Colors = {
  bg: '#e9edf3',
  card: '#ffffff',
  surface: '#dfe5ee',
  surfaceActive: '#ffffff',
  modalCard: '#ffffff',
  menuCard: '#ffffff',
  text: '#10141b',
  textLabel: '#3a4256',
  textMuted: '#5f6a7d',
  textSubtle: '#8791a3',
  placeholder: '#9aa3b2',
  primary: '#4F7CFF',
  primaryOn: '#ffffff',
  danger: '#e5384d',
  countdownCard: '#dfe8ff',
  countdownValue: '#2f6bff',
  countdownLabel: '#5b6b8c',
  backdrop: 'rgba(16,20,27,0.45)',
  statusBar: 'dark',
};

export function getColors(mode: ThemeMode): Colors {
  return mode === 'dark' ? dark : light;
}
