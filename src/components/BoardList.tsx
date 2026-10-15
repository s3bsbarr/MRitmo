import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Text, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';
import { Avatar } from '../avatar/Avatar';
import { moodFor } from '../avatar/mood';
import { formatShort } from '../format';
import type { BoardRow, Period } from '../friends';
import * as Haptics from '../haptics';
import { font, radius, space, type, useTheme } from '../theme';
import { cardOut, rowFadeIn, rowLayout } from '../motion';
import { ArrivalWash, Counted } from './Motion';
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
  // 1.9.2: who was already here when the list first showed. Anyone after that
  // (a request accepted, someone who joined the room) arrives waving, with the
  // row lit for a moment. Never forgotten, so a reload doesn't greet twice.
  const seen = useRef<Set<string> | null>(null);
  const arrived = useRef<Set<string>>(new Set());
  if (seen.current === null) {
    if (rows.length > 0) seen.current = new Set(rows.map((r) => r.profile.id));
  } else {
    for (const r of rows) {
      if (!seen.current.has(r.profile.id)) {
        seen.current.add(r.profile.id);
        if (!r.me) arrived.current.add(r.profile.id);
      }
    }
  }
  return (
    <LayoutAnimationConfig skipEntering>
    <Animated.View layout={rowLayout} style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
      {rows.map((r, i) => {
        const isNew = arrived.current.has(r.profile.id);
        const pct = Math.round(r.ratio * 100);
        const inFocus = r.focusUntil !== null && r.focusUntil > now;
        const name = r.me ? 'Tú' : r.profile.display_name || `@${r.profile.username}`;
        // 1.9: someone who hides their progress shows no numbers; you see yours, with a reminder.
        const minutes = r.hidden
          ? 'Avance oculto'
          : r.total > 0
            ? `${formatShort(r.done)} de ${formatShort(r.total)}${period === 'week' ? ' esta semana' : ''}`
            : period === 'week'
              ? 'Sin plan esta semana'
              : 'Sin plan todavía';
        const meHidden = r.me && Boolean(r.profile.hide_progress);
        return (
          <Animated.View key={r.profile.id} layout={rowLayout} entering={rowFadeIn} exiting={cardOut}>
          {isNew ? <ArrivalWash color={c.ink} /> : null}
          <Press
            onPress={onOpen ? () => onOpen(r) : undefined}
            onLongPress={onLongPress && !r.me ? () => onLongPress(r) : undefined}
            delayLongPress={400}
            disabled={!onOpen && !onLongPress}
            scaleTo={0.99}
            accessibilityRole={onOpen ? 'button' : 'text'}
            accessibilityLabel={
              r.hidden
                ? `${name}, avance oculto`
                : `${name}, puesto ${i + 1}, ${pct} por ciento ${period === 'week' ? 'esta semana' : 'hoy'}${inFocus ? ', en foco' : ''}${meHidden ? ', oculto para los demás' : ''}`
            }
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
            <Text style={[type.headline, { color: c.textTertiary, width: 20, fontVariant: ['tabular-nums'] }]}>{r.hidden ? '–' : i + 1}</Text>
            <Avatar gender={r.profile.gender} mood={r.hidden ? 'calma' : moodFor(r.ratio, r.total > 0)} px={2} still wave={isNew} />
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { color: c.text, fontFamily: r.me ? font.semibold : font.regular }]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[type.footnote, { color: c.textSecondary, fontVariant: ['tabular-nums'] }]} numberOfLines={1}>
                {minutes}
                {inFocus ? '  ·  en foco' : ''}
                {meHidden ? '  ·  oculto para los demás' : ''}
              </Text>
            </View>
            {r.hidden ? (
              <Ionicons name="eye-off-outline" size={20} color={c.textTertiary} />
            ) : (
              <Text style={[type.title, { color: c.text, fontVariant: ['tabular-nums'] }]}>
                <Counted value={pct} />
                <Text style={[type.footnote, { color: c.textSecondary }]}> %</Text>
              </Text>
            )}
          </Press>
          </Animated.View>
        );
      })}
    </Animated.View>
    </LayoutAnimationConfig>
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
