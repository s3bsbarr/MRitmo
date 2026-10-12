import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Avatar, Gender, moodFor } from '../avatar/Avatar';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NAV_HEIGHT } from '../components/NavBar';
import { Press } from '../components/Press';
import { ProgressBar } from '../components/ProgressBar';
import { TaskRow } from '../components/TaskRow';
import { formatMinutes, longDate } from '../format';
import { progressOf, TasksApi } from '../store';
import { radius, space, type, useTheme } from '../theme';

type Props = { api: TasksApi; gender: Gender; onAdd: () => void; onFocus: (id: string) => void };

export function Today({ api, gender, onAdd, onFocus }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { todayTasks, carryover } = api;
  const { total, done, ratio } = progressOf(todayTasks);
  const pct = Math.round(ratio * 100);
  const remaining = total - done;
  const mood = moodFor(ratio, todayTasks.length > 0);

  // Reaching 100% is the one moment worth a success haptic, fired with the pose change.
  const prevMood = useRef(mood);
  useEffect(() => {
    if (prevMood.current !== 'fuerza' && mood === 'fuerza') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    prevMood.current = mood;
  }, [mood]);

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: insets.top + space.xl,
        paddingBottom: insets.bottom + NAV_HEIGHT + space.xxxl,
        paddingHorizontal: space.xl,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingBottom: space.xs }}>
          <Text style={[type.largeTitle, { color: c.text }]} accessibilityRole="header">
            Hoy
          </Text>
          <Text style={[type.callout, { color: c.textSecondary, marginTop: 2 }]}>{longDate(api.today)}</Text>
        </View>
        <Avatar gender={gender} mood={mood} px={4} />
      </View>

      {todayTasks.length > 0 && (
        <View style={{ marginTop: space.xxl }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <Text
              style={[type.display, { color: c.text, fontVariant: ['tabular-nums'] }]}
              accessibilityLabel={`${pct} por ciento del día completado`}
            >
              {pct}
              <Text style={[type.title, { color: c.textSecondary, letterSpacing: -0.4 }]}> %</Text>
            </Text>
            <View style={{ alignItems: 'flex-end', paddingBottom: 10 }}>
              <Text style={[type.headline, { color: c.text, fontVariant: ['tabular-nums'] }]}>{formatMinutes(done)}</Text>
              <Text style={[type.footnote, { color: c.textSecondary, fontVariant: ['tabular-nums'] }]}>de {formatMinutes(total)}</Text>
            </View>
          </View>
          <View style={{ marginTop: space.lg }}>
            <ProgressBar ratio={ratio} />
          </View>
          <Text style={[type.footnote, { color: c.textSecondary, marginTop: space.md }]}>
            {ratio >= 1
              ? 'Día completo. Todo lo que planeaste está hecho.'
              : `Te quedan ${formatMinutes(remaining)} de trabajo planeado.`}
          </Text>
        </View>
      )}

      {carryover.length > 0 && (
        <Animated.View entering={FadeIn.duration(220)} layout={LinearTransition.duration(220)}>
          <Press
            onPress={api.carryIntoToday}
            accessibilityRole="button"
            style={{
              marginTop: space.xl,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: c.surface,
              borderRadius: radius.md,
              paddingHorizontal: space.lg,
              paddingVertical: space.md + 2,
            }}
          >
            <Ionicons name="return-down-forward" size={18} color={c.textSecondary} />
            <Text style={[type.callout, { color: c.text, flex: 1, marginLeft: space.md }]}>
              {carryover.length === 1 ? '1 pendiente de días anteriores' : `${carryover.length} pendientes de días anteriores`}
            </Text>
            <Text style={[type.callout, { color: c.text, fontFamily: 'Inter_600SemiBold' }]}>Traer a hoy</Text>
          </Press>
        </Animated.View>
      )}

      {todayTasks.length === 0 ? (
        <View style={{ marginTop: space.xxxl + space.xl }}>
          <Text style={[type.title, { color: c.text }]}>Planea tu día por tiempo.</Text>
          <Text style={[type.body, { color: c.textSecondary, marginTop: space.sm }]}>
            Agrega cada tarea con lo que te va a tomar. Tu avance se mide en horas cumplidas, así una tarea de dos horas pesa más que una de quince minutos.
          </Text>
          <Press
            onPress={onAdd}
            accessibilityRole="button"
            style={{
              marginTop: space.xl,
              alignSelf: 'flex-start',
              height: 50,
              paddingHorizontal: space.xl,
              borderRadius: radius.pill,
              backgroundColor: c.ink,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
            }}
          >
            <Ionicons name="add" size={20} color={c.inkOnInk} />
            <Text style={[type.headline, { color: c.inkOnInk }]}>Primera tarea</Text>
          </Press>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xxl, marginBottom: space.sm }}>
            <Text style={[type.headline, { color: c.text }]}>Tareas</Text>
            <Text style={[type.footnote, { color: c.textSecondary, fontVariant: ['tabular-nums'] }]}>
              {todayTasks.filter((t) => t.done).length} de {todayTasks.length}
            </Text>
          </View>
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
            {todayTasks.map((t, i) => (
              <Animated.View key={t.id} entering={FadeIn.duration(200)} layout={LinearTransition.duration(240)}>
                <TaskRow task={t} last={i === todayTasks.length - 1} onToggle={api.toggle} onRemove={api.remove} onFocus={onFocus} />
              </Animated.View>
            ))}
          </View>
          <Text style={[type.footnote, { color: c.textTertiary, marginTop: space.md, textAlign: 'center' }]}>
            Toca una tarea para enfocarte. Mantén presionado para eliminarla.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
