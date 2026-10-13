import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Avatar, Gender, moodFor } from '../avatar/Avatar';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NAV_HEIGHT } from '../components/NavBar';
import { Press } from '../components/Press';
import { ProgressBar } from '../components/ProgressBar';
import type { ConfirmRequest } from '../components/ConfirmSheet';
import { CheckRow, TaskRow } from '../components/TaskRow';
import { streakOf } from '../data';
import { dayChip, formatMinutes, hhmmLabel, longDate, timeLabel } from '../format';
import { Habit, HabitsApi, progressOf, Task, TasksApi } from '../store';
import { radius, space, type, useTheme } from '../theme';

type Props = {
  api: TasksApi;
  habitsApi: HabitsApi;
  gender: Gender;
  name: string;
  onAdd: () => void;
  onFocus: (id: string) => void;
  onConfirm: (r: ConfirmRequest) => void;
};

function SectionHeader({ title, count }: { title: string; count?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: space.xxl, marginBottom: space.sm }}>
      <Text style={[type.headline, { color: c.text }]}>{title}</Text>
      {count ? <Text style={[type.footnote, { color: c.textSecondary, fontVariant: ['tabular-nums'] }]}>{count}</Text> : null}
    </View>
  );
}

export function Today({ api, habitsApi, gender, name, onAdd, onFocus, onConfirm }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { todayTasks, carryover, upcoming } = api;
  const { habits } = habitsApi;
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  const askRemoveTask = (t: Task) =>
    onConfirm({
      title: '¿Eliminar tarea?',
      subject: t.title,
      detail: `${formatMinutes(t.minutes)}${t.at ? ` · ${dayChip(t.day, api.today)} ${timeLabel(t.at)}` : ''}`,
      confirmLabel: 'Eliminar',
      destructive: true,
      onConfirm: () => api.remove(t.id),
    });

  const askRemoveHabit = (h: Habit) =>
    onConfirm({
      title: '¿Eliminar hábito?',
      subject: h.title,
      detail: `Racha actual: ${streakOf(h, api.today)} ${streakOf(h, api.today) === 1 ? 'día' : 'días'}. Se borra su historial.`,
      confirmLabel: 'Eliminar',
      destructive: true,
      onConfirm: () => habitsApi.remove(h.id),
    });
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
          <Text style={[type.title, { color: c.text }]}>{name ? `Planea tu día, ${name}.` : 'Planea tu día por tiempo.'}</Text>
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
            <Text style={[type.headline, { color: c.inkOnInk }]}>{habits.length ? 'Agregar tarea' : 'Primera tarea'}</Text>
          </Press>
        </View>
      ) : (
        <>
          <SectionHeader title="Tareas" count={`${todayTasks.filter((t) => t.done).length} de ${todayTasks.length}`} />
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
            {todayTasks.map((t, i) => (
              <Animated.View key={t.id} entering={FadeIn.duration(200)} layout={LinearTransition.duration(240)}>
                <TaskRow task={t} last={i === todayTasks.length - 1} onToggle={api.toggle} onRequestRemove={askRemoveTask} onFocus={onFocus} />
              </Animated.View>
            ))}
          </View>
        </>
      )}

      {habits.length > 0 && (
        <>
          <SectionHeader title="Hábitos" count={`${habits.filter((h) => h.checks.includes(api.today)).length} de ${habits.length}`} />
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
            {habits.map((h, i) => {
              const checked = h.checks.includes(api.today);
              const streak = streakOf(h, api.today);
              return (
                <Animated.View key={h.id} entering={FadeIn.duration(200)} layout={LinearTransition.duration(240)}>
                  <CheckRow
                    square
                    checked={checked}
                    title={h.title}
                    meta={h.time ? `Recordatorio ${hhmmLabel(h.time)}` : undefined}
                    last={i === habits.length - 1}
                    checkLabel={checked ? `Desmarcar ${h.title}` : `Marcar ${h.title} como hecho hoy`}
                    onToggle={() => habitsApi.toggleToday(h.id)}
                    onLongPress={() => askRemoveHabit(h)}
                    right={<Streak n={streak} lit={checked} />}
                  />
                </Animated.View>
              );
            })}
          </View>
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <SectionHeader title="Próximos días" count={String(upcoming.length)} />
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
            {(showAllUpcoming ? upcoming : upcoming.slice(0, 3)).map((t, i, list) => (
              <TaskRow
                key={t.id}
                task={t}
                meta={`${dayChip(t.day, api.today)}${t.at ? ` · ${timeLabel(t.at)}` : ''}`}
                last={i === list.length - 1}
                onToggle={api.toggle}
                onRequestRemove={askRemoveTask}
                onFocus={onFocus}
              />
            ))}
          </View>
          {upcoming.length > 3 && (
            <Press onPress={() => setShowAllUpcoming(!showAllUpcoming)} style={{ alignSelf: 'center', padding: space.sm, marginTop: space.xs }}>
              <Text style={[type.callout, { color: c.textSecondary }]}>{showAllUpcoming ? 'Ver menos' : `Ver las ${upcoming.length}`}</Text>
            </Press>
          )}
        </>
      )}

      {(todayTasks.length > 0 || habits.length > 0) && (
        <Text style={[type.footnote, { color: c.textTertiary, marginTop: space.lg, textAlign: 'center' }]}>
          Toca una tarea para enfocarte. Mantén presionado para eliminar.
        </Text>
      )}
    </ScrollView>
  );
}

/** Streak counter: a flame in the ink color (white in dark mode, black in light). */
function Streak({ n, lit }: { n: number; lit: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: space.md, opacity: n === 0 && !lit ? 0.45 : 1 }}
      accessible
      accessibilityLabel={`Racha de ${n} ${n === 1 ? 'día' : 'días'}`}
    >
      <Ionicons name={lit ? 'flame' : 'flame-outline'} size={18} color={c.text} />
      <Text style={[type.callout, { color: c.text, fontVariant: ['tabular-nums'], fontFamily: 'Inter_600SemiBold' }]}>{n}</Text>
    </View>
  );
}
