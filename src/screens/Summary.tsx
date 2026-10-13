import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../haptics';
import { ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NAV_HEIGHT } from '../components/NavBar';
import { Press } from '../components/Press';
import { dayInitial, formatMinutes } from '../format';
import { bestStreakOf, consistencyOf, shiftDay, streakOf } from '../data';
import { Habit, progressOf, TasksApi } from '../store';
import { radius, space, type, useTheme } from '../theme';

const CHART_H = 140;

export function Summary({ api, habits, name, onOpenSettings }: { api: TasksApi; habits: Habit[]; name: string; onOpenSettings: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { week, todayTasks } = api;

  const max = Math.max(60, ...week.map((d) => d.total));
  const weekDone = week.reduce((s, d) => s + d.done, 0);
  const weekPlanned = week.reduce((s, d) => s + d.total, 0);
  const fullDays = week.filter((d) => d.total > 0 && d.ratio >= 1).length;
  const activeDays = week.filter((d) => d.done > 0).length;
  const today = progressOf(todayTasks);

  const share = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const pct = Math.round(today.ratio * 100);
    const lines = [
      name ? `${name} en Ritmo: ${pct}% del día cumplido` : `Mi día en Ritmo: ${pct}% cumplido`,
      `${formatMinutes(today.done)} de ${formatMinutes(today.total)} planeadas`,
      ...todayTasks.map((t) => `${t.done ? '✓' : '○'} ${t.title} · ${formatMinutes(t.minutes)}`),
    ];
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {}
  };

  const rows: [string, string][] = [
    ['Tiempo cumplido', formatMinutes(weekDone)],
    ['Tiempo planeado', formatMinutes(weekPlanned)],
    ['Cumplimiento', weekPlanned === 0 ? '—' : `${Math.round((weekDone / weekPlanned) * 100)}%`],
    ['Días completos', `${fullDays} de 7`],
    ['Días con avance', `${activeDays} de 7`],
  ];

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: insets.top + space.xl,
        paddingBottom: insets.bottom + NAV_HEIGHT + space.xxxl,
        paddingHorizontal: space.xl,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[type.largeTitle, { color: c.text }]} accessibilityRole="header">
          Resumen
        </Text>
        <Press
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onOpenSettings();
          }}
          accessibilityRole="button"
          accessibilityLabel="Configuración"
          scaleTo={0.9}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}
        >
          <Ionicons name="settings-outline" size={21} color={c.text} />
        </Press>
      </View>
      <Text style={[type.callout, { color: c.textSecondary, marginTop: 2 }]}>Últimos siete días</Text>

      <View
        style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: CHART_H + 28, marginTop: space.xxl }}
        accessible
        accessibilityLabel={`Esta semana cumpliste ${formatMinutes(weekDone)} de ${formatMinutes(weekPlanned)} planeadas`}
      >
        {week.map((d) => {
          const isToday = d.key === api.today;
          const plannedH = Math.max(4, (d.total / max) * CHART_H);
          const doneH = d.total === 0 ? 0 : (d.done / max) * CHART_H;
          return (
            <View key={d.key} style={{ alignItems: 'center', flex: 1 }}>
              <View style={{ width: 22, height: plannedH, borderRadius: 8, backgroundColor: c.track, overflow: 'hidden', justifyContent: 'flex-end' }}>
                <View style={{ height: doneH, backgroundColor: c.ink, borderRadius: 8 }} />
              </View>
              <Text
                style={[
                  type.caption,
                  { marginTop: space.sm, color: isToday ? c.text : c.textTertiary, fontFamily: isToday ? 'Inter_700Bold' : 'Inter_500Medium' },
                ]}
              >
                {dayInitial(d.key)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, marginTop: space.xxl, overflow: 'hidden' }}>
        {rows.map(([label, value], i) => (
          <View
            key={label}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              minHeight: 52,
              marginLeft: space.lg,
              paddingRight: space.lg,
              borderBottomWidth: i === rows.length - 1 ? 0 : 1,
              borderBottomColor: c.separator,
            }}
          >
            <Text style={[type.body, { color: c.text }]}>{label}</Text>
            <Text style={[type.body, { color: c.textSecondary, fontVariant: ['tabular-nums'] }]}>{value}</Text>
          </View>
        ))}
      </View>

      {habits.length > 0 && (
        <>
          <Text style={[type.headline, { color: c.text, marginTop: space.xxl, marginBottom: space.md }]}>Hábitos</Text>
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
            {habits.map((h, i) => {
              const streak = streakOf(h, api.today);
              const best = bestStreakOf(h);
              const pct = Math.round(consistencyOf(h, 30, api.today) * 100);
              const last7 = Array.from({ length: 7 }, (_, k) => shiftDay(api.today, k - 6));
              return (
                <View
                  key={h.id}
                  style={{
                    paddingVertical: space.md + 2,
                    marginLeft: space.lg,
                    paddingRight: space.lg,
                    borderBottomWidth: i === habits.length - 1 ? 0 : 1,
                    borderBottomColor: c.separator,
                  }}
                  accessible
                  accessibilityLabel={`${h.title}: racha de ${streak} días, mejor racha ${best}, constancia de ${pct} por ciento en 30 días`}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[type.body, { color: c.text, flex: 1 }]} numberOfLines={1}>
                      {h.title}
                    </Text>
                    <Ionicons name="flame" size={18} color={c.text} />
                    <Text style={[type.headline, { color: c.text, marginLeft: 3, fontVariant: ['tabular-nums'] }]}>{streak}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.sm }}>
                    <View style={{ flexDirection: 'row', gap: 5, flex: 1 }}>
                      {last7.map((d) => (
                        <View
                          key={d}
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 4,
                            backgroundColor: h.checks.includes(d) ? c.ink : c.track,
                          }}
                        />
                      ))}
                    </View>
                    <Text style={[type.footnote, { color: c.textSecondary, fontVariant: ['tabular-nums'] }]}>
                      Mejor {best} · 30 días {pct}%
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      <Press
        onPress={share}
        disabled={todayTasks.length === 0}
        accessibilityRole="button"
        style={{
          marginTop: space.xl,
          height: 54,
          borderRadius: radius.pill,
          backgroundColor: c.ink,
          opacity: todayTasks.length === 0 ? 0.3 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
        }}
      >
        <Ionicons name="share-outline" size={18} color={c.inkOnInk} />
        <Text style={[type.headline, { color: c.inkOnInk }]}>Compartir mi día</Text>
      </Press>
      <Text style={[type.footnote, { color: c.textTertiary, textAlign: 'center', marginTop: space.sm }]}>
        Envía tu avance a un amigo para rendir cuentas.
      </Text>

    </ScrollView>
  );
}
