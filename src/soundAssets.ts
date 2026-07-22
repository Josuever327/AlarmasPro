// Mapa de sonidos incluidos → archivo, para poder reproducirlos (preview) con
// expo-audio. Las rutas deben ser require() estáticos (los resuelve Metro).
export const SOUND_ASSETS: Record<string, number> = {
  clasica: require('../assets/sounds/clasica.wav'),
  suave: require('../assets/sounds/suave.wav'),
  intensa: require('../assets/sounds/intensa.wav'),
};
