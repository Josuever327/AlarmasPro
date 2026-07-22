// Detecta si la app corre dentro de Expo Go (donde NO existen módulos nativos
// como Notifee) o dentro del development build / APK propia (donde sí funcionan).
import Constants from 'expo-constants';

export const isExpoGo = Constants.executionEnvironment === 'storeClient';
