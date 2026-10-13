import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Avatar } from '../avatar/Avatar';
import { moodFor } from '../avatar/mood';
import { dayKey } from '../data';
import { dayInitial, formatMinutes } from '../format';
import { BoardRow, DayProgress, streakOfDays, weekOfDays } from '../friends';
import { font, radius, space, type, useTheme } from '../theme';
import { Press } from './Press';
import { ProgressBar } from './ProgressBar';
import { Sheet } from './Sheet';

const BAR_H = 96;

type Props = {
  visible: boolean;
  /** Kept after closing so the sheet doesn't empty out while it slides away. */
  row: BoardRow | null;
  /** Their last days; null while loading. */
  days: DayProgress[] | null;
  error?: string | null;
  now: number;
  onClose: () => void;
  onRemove?: () => void;
  /**
   * Room for what comes next on this sheet (1.7: shared habits and
   * "Crear hábito juntos"). Rendered between the week and the footer.
   */
  children?: React.ReactNode;
};

/**
 * A friend, up close: their character in today's state, today's %, minutes,
 * focus, their streak of complete days and the last seven days. Only
 * percentages and minutes — never what their tasks are.
 */
export function FriendSheet({ visible, row, days, error, now, onClose, onRemove, children }: Props) {
  return (
    <Sheet visible={visible && row !== null} onClose={onClose}>
      {row ? (
        <FriendBody row={row} days={days} error={error} now={now} onRemove={onRemove}>
          {children}
        </FriendBody>
      ) : null}
    </Sheet>
  );
}

function FriendBody({ row, days, error, now, onRemove, children }: Omit<Props, 'onClose' | 'row' | 'visible'> & { row: BoardRow }) {
  const { c } = useTheme();
  const today = dayKey();
  const pct = Math.round(row.ratio * 100);
  const inFocus = row.focusUntil !== null && row.focusUntil > now;
  const name = row.me ? 'Tú' : row.profile.display_name || `@${row.profile.username}`;
  // Today on the sheet always matches the live board, even before history loads.
  const merged = days ? [...days.filter((d) => d.day !== today), { day: today, done: row.done, total: row.total }] : null;
  const streak = merged ? streakOfDays(merged, today) : null;
  const week = merged ? weekOfDays(merged, today) : null;
  const fullDays = week ? week.filter((d) => d.ratio !== null && d.ratio >= 1).length : null;

  return (
    <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <Avatar gender={row.profile.gender} mood={moodFor(row.ratio, row.total > 0)} px={3} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[type.title, { color: c.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[type.footnote, { color: c.textSecondary }]} numberOfLines={1}>
            @{row.profile.username}
          </Text>
          {inFocus && (
            <View
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                marginTop: space.sm,
                paddingHorizontal: 10,
                height: 26,
                borderRadius: radius.pill,
                backgroundColor: c.ink,
              }}
              accessibilityLabel="En foco ahora"
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.inkOnInk }} />
              <Text style={[type.caption, { color: c.inkOnInk }]}>En foco</Text>
            </View>
          )}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: space.xl }}>
        <Text style={[type.display, { color: c.text, fontVariant: ['tabular-nums'] }]}>{pct}</Text>
        <Text style={[type.title, { color: c.textSecondary, marginBottom: 10, marginLeft: 4 }]}>%</Text>
      </View>
      <Text style={[type.callout, { color: c.textSecondary, marginBottom: space.md }]}>
        {row.total > 0 ? `${formatMinutes(row.done)} de ${formatMinutes(row.total)} hoy` : 'Sin plan todavía hoy'}
      </Text>
      <ProgressBar ratio={row.ratio} />

      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.xl }}>
        <Stat icon="flame" value={streak === null ? '—' : String(streak)} label={streak === 1 ? 'día completo seguido' : 'días completos seguidos'} />
        <Stat icon="calendar-clear-outline" value={fullDays === null ? '—' : `${fullDays} de 7`} label="días completos esta semana" />
      </View>

      <Text style={[type.headline, { color: c.text, marginTop: space.xl, marginBottom: space.md }]}>Últimos 7 días</Text>
      {week ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            backgroundColor: c.surface,
            borderRadius: radius.lg,
            paddingHorizontal: space.lg,
            paddingTop: space.lg,
            paddingBottom: space.md,
          }}
          accessible
          accessibilityLabel={week.map((d) => `${dayInitial(d.day)} ${d.ratio === null ? 'sin plan' : `${Math.round(d.ratio * 100)} por ciento`}`).join(', ')}
        >
          {week.map((d) => {
            const isToday = d.day === today;
            const h = d.ratio === null ? 0 : Math.max(4, d.ratio * BAR_H);
            return (
              <View key={d.day} style={{ alignItems: 'center', flex: 1 }}>
                <Text style={[type.caption, { color: d.ratio === null ? c.textTertiary : c.textSecondary, fontVariant: ['tabular-nums'], marginBottom: 6 }]}>
                  {d.ratio === null ? '·' : Math.round(d.ratio * 100)}
                </Text>
                <View style={{ width: 20, height: BAR_H, borderRadius: 7, backgroundColor: c.track, overflow: 'hidden', justifyContent: 'flex-end' }}>
                  <View style={{ height: h, backgroundColor: c.ink, borderRadius: 7 }} />
                </View>
                <Text style={[type.caption, { marginTop: space.sm, color: isToday ? c.text : c.textTertiary, fontFamily: isToday ? font.bold : font.medium }]}>
                  {dayInitial(d.day)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : error ? (
        <Text style={[type.footnote, { color: c.danger }]}>{error}</Text>
      ) : (
        <View style={{ height: BAR_H + 56, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderRadius: radius.lg }}>
          <ActivityIndicator color={c.textSecondary} />
        </View>
      )}

      {children}

      <Text style={[type.footnote, { color: c.textTertiary, marginTop: space.xl, textAlign: 'center' }]}>
        {row.me ? 'Así te ven tus amigos: solo el % y los minutos, nunca tus tareas.' : 'Solo ves su % y sus minutos, nunca sus tareas.'}
      </Text>

      {onRemove && !row.me && (
        <Press onPress={onRemove} accessibilityRole="button" style={{ alignSelf: 'center', padding: space.md, marginTop: space.sm }}>
          <Text style={[type.callout, { color: c.danger }]}>Eliminar amigo</Text>
        </Press>
      )}
    </ScrollView>
  );
}

function Stat({ icon, value, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; value: string; label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={18} color={c.text} />
        <Text style={[type.title, { color: c.text, fontVariant: ['tabular-nums'] }]}>{value}</Text>
      </View>
      <Text style={[type.footnote, { color: c.textSecondary, marginTop: 2 }]}>{label}</Text>
    </View>
  );
}
