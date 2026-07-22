import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { HourFormat, formatTime } from './types';
import { Colors } from './theme';

// Datos de la alarma que está sonando (leídos de la notificación).
export interface Ringing {
  id: string;
  hour: number;
  minute: number;
  label: string;
}

// Ventana emergente a pantalla completa que aparece cuando suena una alarma.
// Muestra la hora, la etiqueta (si hay) y un botón grande para apagarla.
export default function RingingScreen({
  ringing,
  format,
  colors,
  onStop,
}: {
  ringing: Ringing | null;
  format: HourFormat;
  colors: Colors;
  onStop: () => void;
}) {
  if (!ringing) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onStop}>
      <View style={[styles.container, { backgroundColor: colors.primary }]}>
        <View style={styles.top}>
          <Text style={styles.small}>Alarma</Text>
          <Text style={styles.time}>
            {formatTime(ringing.hour, ringing.minute, format)}
          </Text>
          {!!ringing.label && <Text style={styles.label}>{ringing.label}</Text>}
        </View>

        <Pressable style={styles.stopBtn} onPress={onStop}>
          <Text style={[styles.stopText, { color: colors.primary }]}>
            Apagar alarma
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 140,
    paddingBottom: 70,
    paddingHorizontal: 30,
  },
  top: { alignItems: 'center' },
  small: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 18,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  time: {
    color: '#fff',
    fontSize: 84,
    fontWeight: '200',
    marginTop: 10,
  },
  label: {
    color: '#fff',
    fontSize: 22,
    marginTop: 6,
    textAlign: 'center',
  },
  stopBtn: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    borderRadius: 40,
    alignItems: 'center',
    width: '100%',
  },
  stopText: { fontSize: 20, fontWeight: '700' },
});
