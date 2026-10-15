import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { EASE_OUT } from '../motion';
import { space, type, useTheme } from '../theme';
import { Roll } from './Motion';

/**
 * Streak counter: a flame in the ink color (white in dark mode, black in light).
 * A shared streak adds a small "people" mark: it only lights when both marked.
 */
export function Streak({ n, lit, shared, people = shared }: { n: number; lit: boolean; shared?: boolean; /** The small people mark (Today); the friend sheet already says who. */ people?: boolean }) {
  const { c } = useTheme();
  // 1.9.2: when the streak lights up or grows (yours, or your friend just marked),
  // the flame grows for a moment and the number rolls up.
  const grow = useSharedValue(1);
  const before = useRef({ n, lit });
  useEffect(() => {
    const b = before.current;
    if ((lit && !b.lit) || n > b.n) {
      grow.set(withSequence(withTiming(1.32, { duration: 150, easing: EASE_OUT }), withTiming(1, { duration: 220, easing: EASE_OUT })));
    }
    before.current = { n, lit };
  }, [n, lit, grow]);
  const flame = useAnimatedStyle(() => ({ transform: [{ scale: grow.get() }] }));
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: space.md, opacity: n === 0 && !lit ? 0.45 : 1 }}
      accessible
      accessibilityLabel={`Racha${shared ? ' compartida' : ''} de ${n} ${n === 1 ? 'día' : 'días'}`}
    >
      {people && <Ionicons name="people-outline" size={15} color={c.textSecondary} style={{ marginRight: 3 }} />}
      <Animated.View style={[flame, { transformOrigin: 'bottom' }]}>
        <Ionicons name={lit ? 'flame' : 'flame-outline'} size={18} color={c.text} />
      </Animated.View>
      <Roll value={n} lineHeight={20} style={[type.callout, { color: c.text, fontVariant: ['tabular-nums'], fontFamily: 'Inter_600SemiBold' }]} />
    </View>
  );
}
