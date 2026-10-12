import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Gender } from '../avatar/Avatar';
import { NAV_HEIGHT } from '../components/NavBar';
import { Press } from '../components/Press';
import { dayInitial, formatMinutes } from '../format';
import { progressOf, TasksApi } from '../store';
import { radius, space, ThemePref, type, useTheme } from '../theme';

const CHART_H = 140;

export function Summary({ api, gender, setGender }: { api: TasksApi; gender: Gender; setGender: (g: Gender) => void }) {
  const { c, pref, setPref } = useTheme();
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
      `Mi día en Ritmo: ${pct}% cumplido`,
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

  const themes: { key: ThemePref; label: string }[] = [
    { key: 'system', label: 'Sistema' },
    { key: 'light', label: 'Claro' },
    { key: 'dark', label: 'Oscuro' },
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
      <Text style={[type.largeTitle, { color: c.text }]} accessibilityRole="header">
        Resumen
      </Text>
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

      <Text style={[type.headline, { color: c.text, marginTop: space.xxxl, marginBottom: space.md }]}>Personaje</Text>
      <View style={{ flexDirection: 'row', gap: space.md }} accessibilityRole="radiogroup">
        {([
          ['m', 'Hombre'],
          ['f', 'Mujer'],
        ] as [Gender, string][]).map(([g, label]) => {
          const active = gender === g;
          return (
            <Press
              key={g}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setGender(g);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingTop: space.lg,
                paddingBottom: space.md,
                borderRadius: radius.lg,
                backgroundColor: c.surface,
                borderWidth: 1.5,
                borderColor: active ? c.ink : 'transparent',
              }}
            >
              <Avatar gender={g} mood="foco" px={3} />
              <Text style={[type.callout, { color: active ? c.text : c.textSecondary, marginTop: space.sm }]}>{label}</Text>
            </Press>
          );
        })}
      </View>
      <Text style={[type.footnote, { color: c.textTertiary, marginTop: space.sm }]}>
        Se sienta tranquilo al empezar, se pone de pie al pasar la mitad y celebra cuando completas el día.
      </Text>

      <Text style={[type.headline, { color: c.text, marginTop: space.xxl, marginBottom: space.md }]}>Apariencia</Text>
      <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: radius.md, padding: 4 }} accessibilityRole="radiogroup">
        {themes.map((t) => {
          const active = pref === t.key;
          return (
            <Press
              key={t.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setPref(t.key);
              }}
              scaleTo={0.96}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={{
                flex: 1,
                height: 40,
                borderRadius: radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? c.bg : 'transparent',
                shadowColor: '#000',
                shadowOpacity: active ? 0.08 : 0,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: active ? 2 : 0,
              }}
            >
              <Text style={[type.callout, { color: active ? c.text : c.textSecondary }]}>{t.label}</Text>
            </Press>
          );
        })}
      </View>

      <Text style={[type.caption, { color: c.textTertiary, textAlign: 'center', marginTop: space.xxxl }]}>Ritmo 1.0</Text>
    </ScrollView>
  );
}
