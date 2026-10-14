import { Text, View } from 'react-native';
import { Avatar } from '../avatar/Avatar';
import { moodFor } from '../avatar/mood';
import { formatShort } from '../format';
import type { BoardRow, Period } from '../friends';
import * as Haptics from '../haptics';
import { font, radius, space, type, useTheme } from '../theme';
import { Press } from './Press';

type Props = {
  rows: BoardRow[];
  period: Period;
  now: number;
  onOpen?: (r: BoardRow) => void;
  onLongPress?: (r: BoardRow) => void;
};

/**
 * One ranking (friends or a room): place, character, name, minutes and %.
 * The character always shows today's state, also in the weekly view.
 */
export function BoardList({ rows, period, now, onOpen, onLongPress }: Props) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
      {rows.map((r, i) => {
        const pct = Math.round(r.ratio * 100);
        const inFocus = r.focusUntil !== null && r.focusUntil > now;
        const name = r.me ? 'Tú' : r.profile.display_name || `@${r.profile.username}`;
        const minutes = r.total > 0 ? `${formatShort(r.done)} de ${formatShort(r.total)}${period === 'week' ? ' esta semana' : ''}` : period === 'week' ? 'Sin plan esta semana' : 'Sin plan todavía';
        return (
          <Press
            key={r.profile.id}
            onPress={onOpen ? () => onOpen(r) : undefined}
            onLongPress={onLongPress && !r.me ? () => onLongPress(r) : undefined}
            delayLongPress={400}
            disabled={!onOpen && !onLongPress}
            scaleTo={0.99}
            accessibilityRole={onOpen ? 'button' : 'text'}
            accessibilityLabel={`${name}, puesto ${i + 1}, ${pct} por ciento ${period === 'week' ? 'esta semana' : 'hoy'}${inFocus ? ', en foco' : ''}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 72,
              paddingHorizontal: space.lg,
              gap: space.md,
              borderBottomWidth: i === rows.length - 1 ? 0 : 1,
              borderBottomColor: c.separator,
            }}
          >
            <Text style={[type.headline, { color: c.textTertiary, width: 20, fontVariant: ['tabular-nums'] }]}>{i + 1}</Text>
            <Avatar gender={r.profile.gender} mood={moodFor(r.ratio, r.total > 0)} px={2} still />
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { color: c.text, fontFamily: r.me ? font.semibold : font.regular }]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[type.footnote, { color: c.textSecondary, fontVariant: ['tabular-nums'] }]} numberOfLines={1}>
                {minutes}
                {inFocus ? '  ·  en foco' : ''}
              </Text>
            </View>
            <Text style={[type.title, { color: c.text, fontVariant: ['tabular-nums'] }]}>
              {pct}
              <Text style={[type.footnote, { color: c.textSecondary }]}> %</Text>
            </Text>
          </Press>
        );
      })}
    </View>
  );
}

/** "Hoy | Semana" switch above a board. */
export function PeriodSwitch({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: radius.pill, padding: 3 }} accessibilityRole="tablist">
      {(['day', 'week'] as Period[]).map((p) => {
        const active = value === p;
        return (
          <Press
            key={p}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => {});
              onChange(p);
            }}
            scaleTo={0.96}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{ height: 30, paddingHorizontal: space.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.ink : 'transparent' }}
          >
            <Text style={[type.footnote, { color: active ? c.inkOnInk : c.textSecondary, fontFamily: font.semibold }]}>{p === 'day' ? 'Hoy' : 'Semana'}</Text>
          </Press>
        );
      })}
    </View>
  );
}
