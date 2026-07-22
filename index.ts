import { registerRootComponent } from 'expo';

import App from './App';
import { isExpoGo } from './src/env';

// Manejador de eventos en segundo plano de Notifee (obligatorio en el dev build).
// En Expo Go no se carga, porque el módulo nativo no existe.
if (!isExpoGo) {
  const notifee = require('@notifee/react-native').default;
  const { EventType } = require('@notifee/react-native');
  notifee.onBackgroundEvent(async ({ type, detail }: any) => {
    const id = detail.notification?.id;
    // Si el usuario descarta (desliza) la notificación, cortamos el sonido.
    // El toque (PRESS) abre la app y muestra la ventanita para apagarla.
    if (type === EventType.DISMISSED && id) {
      await notifee.cancelNotification(id);
    }
  });
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
