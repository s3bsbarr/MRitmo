import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NAV_HEIGHT } from '../components/NavBar';
import { Press } from '../components/Press';
import { ProgressBar } from '../components/ProgressBar';
import { formatClock, formatShort } from '../format';
import { TasksApi } from '../store';
import { radius, space, type, useTheme } from '../theme';

export { emptyFocus } from '../data';
export type { FocusState } from '../data';
import { emptyFocus as EMPTY, extendFocus, focusOn, pauseFocus, resumeFocus, totalOf, type FocusState } from '../data';

type Props = { api: TasksApi; focus: FocusState; setFocus: (f: FocusState) => void };

export function Focus({ api, focus, setFocus }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const task = api.tasks.find((t) => t.id === focus.taskId) ?? null;
  const pending = api.todayTasks.filter((t) => !t.done);
  const [now, setNow] = useState(Date.now());
  const firedFor = useRef<string | null>(null);

  // Time comes from the wall clock, so leaving the app never drifts the countdown.
  useEffect(() => {
    if (focus.endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [focus.endsAt]);

  const totalMs = totalOf(focus, api.tasks);
  const remaining = focus.endsAt !== null ? Math.max(0, focus.endsAt - now) : focus.remaining;
  const running = focus.endsAt !== null && remaining > 0;
  const finished = task !== null && remaining === 0;

  useEffect(() => {
    if (finished && task && firedFor.current !== task.id) {
      firedFor.current = task.id;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [finished, task]);

  const pick = (id: string) => {
    const t = api.tasks.find((x) => x.id === id);
    if (!t) return;
    firedFor.current = null;
    Haptics.selectionAsync().catch(() => {});
    setFocus(focusOn(api.tasks, id));
  };

  const startPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (running) setFocus(pauseFocus(focus));
    else {
      setNow(Date.now());
      setFocus(resumeFocus(focus));
    }
  };

  const addFive = () => {
    Haptics.selectionAsync().catch(() => {});
    firedFor.current = null;
    setNow(Date.now());
    setFocus(extendFocus(focus, 5 * 60_000));
  };

  const completeTask = () => {
    if (!task) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    api.complete(task.id);
    setFocus(EMPTY);
  };

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top + space.xl,
        paddingBottom: insets.bottom + NAV_HEIGHT + space.xxxl,
        paddingHorizontal: space.xl,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[type.largeTitle, { color: c.text }]} accessibilityRole="header">
        Foco
      </Text>

      {task && !task.done ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingVertical: space.xxxl }}>
          <Text style={[type.title, { color: c.text, textAlign: 'center' }]} numberOfLines={3}>
            {task.title}
          </Text>
          <Text
            style={[
              type.display,
              { fontSize: 76, lineHeight: 84, letterSpacing: -3, color: c.text, textAlign: 'center', marginTop: space.xl, fontVariant: ['tabular-nums'] },
            ]}
            accessibilityLiveRegion="polite"
          >
            {formatClock(remaining / 1000)}
          </Text>
          <View style={{ marginTop: space.xl, marginHorizontal: space.xl }}>
            <ProgressBar ratio={totalMs === 0 ? 0 : 1 - remaining / totalMs} height={4} />
          </View>
          <Text style={[type.footnote, { color: c.textSecondary, textAlign: 'center', marginTop: space.md }]}>
            {finished ? 'Tiempo cumplido.' : running ? 'En curso' : !focus.started ? `Bloque de ${formatShort(Math.round(totalMs / 60000))}` : 'En pausa'}
          </Text>

          <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.xxl }}>
            {!finished && (
              <Press
                onPress={startPause}
                accessibilityRole="button"
                style={{ flex: 1, height: 56, borderRadius: radius.pill, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.sm }}
              >
                <Ionicons name={running ? 'pause' : 'play'} size={18} color={c.inkOnInk} />
                <Text style={[type.headline, { color: c.inkOnInk }]}>{running ? 'Pausar' : !focus.started ? 'Empezar' : 'Seguir'}</Text>
              </Press>
            )}
            <Press
              onPress={completeTask}
              accessibilityRole="button"
              style={{
                flex: 1,
                height: 56,
                borderRadius: radius.pill,
                backgroundColor: finished ? c.ink : c.surface,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: space.sm,
              }}
            >
              <Ionicons name="checkmark" size={18} color={finished ? c.inkOnInk : c.text} />
              <Text style={[type.headline, { color: finished ? c.inkOnInk : c.text }]}>Terminé</Text>
            </Press>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.xl, marginTop: space.xl }}>
            {(running || finished) && (
              <Press onPress={addFive} accessibilityRole="button" style={{ padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="add-circle-outline" size={18} color={c.text} />
                <Text style={[type.callout, { color: c.text }]}>5 min</Text>
              </Press>
            )}
            <Press onPress={() => setFocus(EMPTY)} style={{ padding: space.sm }}>
              <Text style={[type.callout, { color: c.textSecondary }]}>Cambiar de tarea</Text>
            </Press>
          </View>
        </View>
      ) : (
        <View style={{ marginTop: space.xl }}>
          <Text style={[type.body, { color: c.textSecondary }]}>
            {pending.length > 0
              ? 'Elige una tarea. El temporizador corre con la duración que le diste.'
              : 'No tienes tareas pendientes hoy. Agrega una con el botón +.'}
          </Text>
          {pending.length > 0 && (
            <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden', marginTop: space.xl }}>
              {pending.map((t, i) => (
                <Press
                  key={t.id}
                  onPress={() => pick(t.id)}
                  scaleTo={0.985}
                  accessibilityRole="button"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 60,
                    paddingHorizontal: space.lg,
                    borderBottomWidth: i === pending.length - 1 ? 0 : 1,
                    borderBottomColor: c.separator,
                  }}
                >
                  <Text style={[type.body, { color: c.text, flex: 1 }]} numberOfLines={2}>
                    {t.title}
                  </Text>
                  <Text style={[type.callout, { color: c.textSecondary, marginHorizontal: space.md, fontVariant: ['tabular-nums'] }]}>
                    {formatShort(t.minutes)}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
                </Press>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
