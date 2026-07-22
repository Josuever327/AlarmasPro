import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Alarm, DAY_LABELS, HourFormat, formatTime } from './types';
import { formatCountdown, nextAlarm } from './schedule';
import { Colors } from './theme';

type Filter = 'active' | 'all';

// Pantalla de listado: muestra todas las alarmas con filtro y una cuenta
// regresiva en vivo hacia la próxima alarma que va a sonar.
export default function AlarmListScreen({
  alarms,
  format,
  colors,
  onToggle,
}: {
  alarms: Alarm[];
  format: HourFormat;
  colors: Colors;
  onToggle: (a: Alarm) => void;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [filter, setFilter] = useState<Filter>('all');
  const [now, setNow] = useState(new Date());

  // Actualiza el "ahora" cada segundo para que la cuenta regresiva avance.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const next = nextAlarm(alarms, now);
  const shown = filter === 'active' ? alarms.filter((a) => a.enabled) : alarms;

  return (
    <View style={styles.container}>
      {/* Cuenta regresiva de la próxima alarma */}
      <View style={styles.countdownCard}>
        {next ? (
          <>
            <Text style={styles.countdownLabel}>La siguiente alarma sonará en</Text>
            <Text style={styles.countdownValue}>
              {formatCountdown(next.date.getTime() - now.getTime())}
            </Text>
            <Text style={styles.countdownSub}>
              {formatTime(next.alarm.hour, next.alarm.minute, format)}
              {next.alarm.label ? ` · ${next.alarm.label}` : ''}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.countdownLabel}>Sin próximas alarmas</Text>
            <Text style={styles.countdownSub}>
              Activá alguna alarma para ver la cuenta regresiva.
            </Text>
          </>
        )}
      </View>

      {/* Filtro: activas / todas */}
      <View style={styles.filterRow}>
        {(
          [
            { key: 'active', label: 'Alarmas activas' },
            { key: 'all', label: 'Todas' },
          ] as { key: Filter; label: string }[]
        ).map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f.key && styles.filterChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={shown}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {filter === 'active'
              ? 'No hay alarmas activas.'
              : 'No hay alarmas todavía.'}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, !item.enabled && styles.cardDisabled]}>
            <View style={styles.cardLeft}>
              <Text style={styles.time}>
                {formatTime(item.hour, item.minute, format)}
              </Text>
              {!!item.label && <Text style={styles.label}>{item.label}</Text>}
              <Text style={styles.repeat}>
                {item.days.length === 0
                  ? 'Una vez'
                  : item.days
                      .slice()
                      .sort()
                      .map((d) => DAY_LABELS[d])
                      .join(' ')}
              </Text>
            </View>
            <Switch
              value={item.enabled}
              onValueChange={() => onToggle(item)}
              trackColor={{ true: colors.primary }}
            />
          </View>
        )}
      />
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1 },
    countdownCard: {
      backgroundColor: c.countdownCard,
      borderRadius: 20,
      marginHorizontal: 16,
      marginTop: 8,
      padding: 24,
      alignItems: 'center',
    },
    countdownLabel: { color: c.countdownLabel, fontSize: 14 },
    countdownValue: {
      color: c.countdownValue,
      fontSize: 40,
      fontWeight: '700',
      marginTop: 6,
    },
    countdownSub: { color: c.textLabel, fontSize: 14, marginTop: 6 },
    filterRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      marginTop: 18,
    },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.card,
    },
    filterChipActive: { backgroundColor: c.primary },
    filterChipText: { color: c.textMuted, fontWeight: '600', fontSize: 13 },
    filterChipTextActive: { color: c.primaryOn },
    list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
    empty: { color: c.textMuted, textAlign: 'center', marginTop: 40 },
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
    time: { color: c.text, fontSize: 30, fontWeight: '300' },
    label: { color: c.textLabel, fontSize: 15, marginTop: 2 },
    repeat: { color: c.textSubtle, fontSize: 13, marginTop: 4 },
  });
}
