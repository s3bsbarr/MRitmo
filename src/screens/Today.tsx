import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../haptics';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Avatar, Gender, moodFor } from '../avatar/Avatar';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NAV_HEIGHT } from '../components/NavBar';
import { Press } from '../components/Press';
import { ProgressBar } from '../components/ProgressBar';
import type { ItemActions } from '../components/ActionsSheet';
import type { Editing } from '../components/AddSheet';
import type { ConfirmRequest } from '../components/ConfirmSheet';
import { CheckRow, TaskRow } from '../components/TaskRow';
import { streakOf } from '../data';
import { dayChip, formatMinutes, hhmmLabel, longDate, timeLabel } from '../format';
import { friendName, markedBy, SharedHabit, sharedStreak } from '../shared';
import { Habit, HabitsApi, progressOf, SharedApi, Task, TasksApi } from '../store';
import { radius, space, type, useTheme } from '../theme';

type Props = {
  api: TasksApi;
  habitsApi: HabitsApi;
  /** Habits kept with a friend (1.7). */
  sharedApi: SharedApi;
  gender: Gender;
  name: string;
  onAdd: () => void;
  onFocus: (id: string) => void;
  onConfirm: (r: ConfirmRequest) => void;
  onActions: (r: ItemActions) => void;
  onEdit: (e: Editing) => void;
  /** Shown under the header: "MRitmo X está disponible" (1.9). */
  banner?: React.ReactNode;
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

export function Today({ api, habitsApi, sharedApi, gender, name, onAdd, onFocus, onConfirm, onActions, onEdit, banner }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { todayTasks, carryover, upcoming } = api;
  const { habits } = habitsApi;
  const shared = sharedApi.active;
  const habitCount = habits.length + shared.length;
  const habitsDone = habits.filter((h) => h.checks.includes(api.today)).length + shared.filter((h) => markedBy(h, api.today).me).length;
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  const taskActions = (t: Task) =>
    onActions({
      title: t.title,
      detail: `${formatMinutes(t.minutes)}${t.at ? ` · ${dayChip(t.day, api.today)} ${timeLabel(t.at)}` : ''}`,
      onEdit: () => onEdit({ kind: 'task', task: t }),
      onDelete: () => askRemoveTask(t),
    });

  const habitActions = (h: Habit) =>
    onActions({
      title: h.title,
      detail: `Hábito diario${h.time ? ` · ${hhmmLabel(h.time)}` : ''}`,
      onEdit: () => onEdit({ kind: 'habit', habit: h }),
      onDelete: () => askRemoveHabit(h),
    });

  const askRemoveTask = (t: Task) =>
    onConfirm({
      title: '¿Eliminar tarea?',
      subject: t.title,
      detail: `${formatMinutes(t.minutes)}${t.at ? ` · ${dayChip(t.day, api.today)} ${timeLabel(t.at)}` : ''}`,
      confirmLabel: 'Eliminar',
      destructive: true,
      onConfirm: () => api.remove(t.id),
    });

  const sharedActions = (h: SharedHabit) =>
    onActions({
      title: h.title,
      detail: `Con ${friendName(h.friend)} · racha de ${sharedStreak(h, api.today)}`,
      deleteLabel: 'Dejar hábito',
      onDelete: () =>
        onConfirm({
          title: '¿Dejar el hábito?',
          subject: h.title,
          detail: `Se quita para ti y para ${friendName(h.friend)}, y se pierde la racha de ${sharedStreak(h, api.today)}.`,
          confirmLabel: 'Dejar hábito',
          destructive: true,
          onConfirm: () => sharedApi.remove(h.id).catch(() => {}),
        }),
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
        <Avatar gender={gender} mood={mood} px={4} interactive />
      </View>

      {banner}

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
            <Text style={[type.headline, { color: c.inkOnInk }]}>{habitCount ? 'Agregar tarea' : 'Primera tarea'}</Text>
          </Press>
        </View>
      ) : (
        <>
          <SectionHeader title="Tareas" count={`${todayTasks.filter((t) => t.done).length} de ${todayTasks.length}`} />
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
            {todayTasks.map((t, i) => (
              <Animated.View key={t.id} entering={FadeIn.duration(200)} layout={LinearTransition.duration(240)}>
                <TaskRow task={t} last={i === todayTasks.length - 1} onToggle={api.toggle} onRequestRemove={taskActions} onFocus={onFocus} />
              </Animated.View>
            ))}
          </View>
        </>
      )}

      {habitCount > 0 && (
        <>
          <SectionHeader title="Hábitos" count={`${habitsDone} de ${habitCount}`} />
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
                    last={i === habitCount - 1}
                    checkLabel={checked ? `Desmarcar ${h.title}` : `Marcar ${h.title} como hecho hoy`}
                    onToggle={() => habitsApi.toggleToday(h.id)}
                    onLongPress={() => habitActions(h)}
                    right={<Streak n={streak} lit={checked} />}
                  />
                </Animated.View>
              );
            })}
            {shared.map((h, i) => {
              const m = markedBy(h, api.today);
              const who = friendName(h.friend);
              const meta = m.me && m.them ? `Con ${who} · marcaron los dos` : m.them ? `Con ${who} · ya marcó, faltas tú` : m.me ? `Con ${who} · falta ${who}` : `Con ${who}`;
              return (
                <Animated.View key={h.id} entering={FadeIn.duration(200)} layout={LinearTransition.duration(240)}>
                  <CheckRow
                    square
                    checked={m.me}
                    title={h.title}
                    meta={meta}
                    last={habits.length + i === habitCount - 1}
                    checkLabel={m.me ? `Desmarcar ${h.title}` : `Marcar ${h.title} como hecho hoy, con ${who}`}
                    onToggle={() => sharedApi.toggleToday(h.id)}
                    onLongPress={() => sharedActions(h)}
                    right={<Streak n={sharedStreak(h, api.today)} lit={m.me && m.them} shared />}
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
                onRequestRemove={taskActions}
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

      {(todayTasks.length > 0 || habitCount > 0) && (
        <Text style={[type.footnote, { color: c.textTertiary, marginTop: space.lg, textAlign: 'center' }]}>
          Toca una tarea para enfocarte. Mantén presionado para editar o eliminar.
        </Text>
      )}
    </ScrollView>
  );
}

/**
 * Streak counter: a flame in the ink color (white in dark mode, black in light).
 * A shared streak adds a small "people" mark: it only lights when both marked.
 */
function Streak({ n, lit, shared }: { n: number; lit: boolean; shared?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: space.md, opacity: n === 0 && !lit ? 0.45 : 1 }}
      accessible
      accessibilityLabel={`Racha${shared ? ' compartida' : ''} de ${n} ${n === 1 ? 'día' : 'días'}`}
    >
      {shared && <Ionicons name="people-outline" size={15} color={c.textSecondary} style={{ marginRight: 3 }} />}
      <Ionicons name={lit ? 'flame' : 'flame-outline'} size={18} color={c.text} />
      <Text style={[type.callout, { color: c.text, fontVariant: ['tabular-nums'], fontFamily: 'Inter_600SemiBold' }]}>{n}</Text>
    </View>
  );
}
