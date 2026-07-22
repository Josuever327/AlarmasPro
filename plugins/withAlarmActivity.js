// Config plugin: hace que la Activity principal pueda mostrarse SOBRE la pantalla
// de bloqueo y encender la pantalla, para que la alarma salte a pantalla completa
// apenas suena (aunque el celu esté bloqueado).
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAlarmActivity(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    if (!app || !app.activity) return config;

    const main = app.activity.find(
      (a) => a['$']['android:name'] === '.MainActivity'
    );
    if (main) {
      main['$']['android:showWhenLocked'] = 'true';
      main['$']['android:turnScreenOn'] = 'true';
    }
    return config;
  });
};
