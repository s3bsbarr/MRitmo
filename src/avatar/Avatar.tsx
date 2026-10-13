import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';
import { useTheme } from '../theme';
import { Gender, Mood, SPRITE_COLORS, SPRITES } from './sprites';

export type { Gender, Mood };

export const SPRITE_W = 24;
export const SPRITE_H = 26;

export { moodFor } from './mood';

type Run = { x: number; y: number; w: number; color: string };

/** Merge horizontal runs of the same color so a 24×26 sprite is ~150 views, not 624. */
function toRuns(rows: string[], palette: Record<string, string>): Run[] {
  const runs: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      runs.push({ x, y, w: end - x, color: palette[ch] });
      x = end;
    }
  });
  return runs;
}

const Sprite = memo(function Sprite({ rows, palette, px }: { rows: string[]; palette: Record<string, string>; px: number }) {
  const runs = useMemo(() => toRuns(rows, palette), [rows, palette]);
  return (
    <View style={{ width: SPRITE_W * px, height: SPRITE_H * px }}>
      {runs.map((r, i) => (
        <View
          key={i}
          style={{ position: 'absolute', left: r.x * px, top: r.y * px, width: r.w * px, height: px, backgroundColor: r.color }}
        />
      ))}
    </View>
  );
});

// A mood change is a rare, earned moment: the new pose settles in from 92% with a
// small lift instead of popping. Never from scale 0.
const enter = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.92 }, { translateY: 6 }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }] },
}).duration(320);

const LABEL: Record<Mood, string> = {
  sueno: 'Tu personaje duerme: aún no empiezas el día',
  calma: 'Tu personaje está sentado, tranquilo',
  foco: 'Tu personaje está de pie, concentrado',
  fuerza: 'Tu personaje celebra con los brazos en alto',
};

export function Avatar({ gender, mood, px = 4 }: { gender: Gender; mood: Mood; px?: number }) {
  const { c } = useTheme();
  const palette = SPRITE_COLORS[c.scheme] as Record<string, string>;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={LABEL[mood]} style={{ width: SPRITE_W * px, height: SPRITE_H * px }}>
      <Animated.View key={`${gender}-${mood}`} entering={enter}>
        <Sprite rows={SPRITES[gender][mood]} palette={palette} px={px} />
      </Animated.View>
    </View>
  );
}
