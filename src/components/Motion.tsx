import { useEffect, useRef, useState } from 'react';
import { StyleProp, TextStyle, View } from 'react-native';
import Animated, { FadeOut, Keyframe, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { DUR, EASE_OUT, useCalm } from '../motion';

/**
 * A number that counts to its new value (the day's %, a friend's %).
 * Only this hook's component re-renders per frame, and only while it moves.
 */
export function useCountUp(target: number, duration: number = DUR.count) {
  const calm = useCalm();
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const start = current.current;
    if (calm || start === target) {
      current.current = target;
      setShown(target);
      return;
    }
    const t0 = Date.now();
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(start + (target - start) * eased);
      if (v !== current.current) {
        current.current = v;
        setShown(v);
      }
      frame.current = p < 1 ? requestAnimationFrame(step) : null;
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [target, duration, calm]);

  return shown;
}

/** Text-free count: put it inside a <Text> (it renders the bare number). */
export function Counted({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

const rollUp = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 12 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
}).duration(240);

const rollDown = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -12 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
}).duration(240);

const rollOut = FadeOut.duration(120);

/**
 * A small integer that rolls to its new value: up when it grows (a streak +1),
 * down when it shrinks. Bigger jumps count instead of rolling.
 */
export function Roll({ value, style, lineHeight }: { value: number; style: StyleProp<TextStyle>; lineHeight: number }) {
  const calm = useCalm();
  const prev = useRef(value);
  const diff = value - prev.current;
  useEffect(() => {
    prev.current = value;
  }, [value]);
  const counted = useCountUp(value);

  if (Math.abs(diff) > 1) {
    return <Animated.Text style={style}>{counted}</Animated.Text>;
  }
  const entering = calm || diff === 0 ? undefined : diff > 0 ? rollUp : rollDown;
  return (
    <View style={{ height: lineHeight, overflow: 'hidden', justifyContent: 'center' }}>
      <Animated.Text key={value} entering={entering} exiting={calm ? undefined : rollOut} style={style}>
        {value}
      </Animated.Text>
    </View>
  );
}

/**
 * A soft wash over a row that just arrived (a new friend, someone who joined a
 * room): holds for a moment, then fades. Uses the ink color, so it works in all four tones.
 */
export function ArrivalWash({ color, radius = 0 }: { color: string; radius?: number }) {
  const o = useSharedValue(0.1);
  useEffect(() => {
    o.set(withDelay(900, withTiming(0, { duration: DUR.count, easing: EASE_OUT })));
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: color, borderRadius: radius }, style]}
    />
  );
}

/**
 * Keeps a list in its previous order for a moment when only the order changed,
 * so a completed task first shows its strike, then slides to its place among the
 * done ones. Additions and removals apply at once (they animate on their own).
 */
export function useSettledOrder<T>(items: T[], idOf: (t: T) => string, delay = 200): T[] {
  const calm = useCalm();
  const ids = items.map(idOf);
  const key = ids.join('|');
  const [order, setOrder] = useState(ids);

  useEffect(() => {
    const next = key ? key.split('|') : [];
    const sameSet = next.length === order.length && next.every((id) => order.includes(id));
    if (!sameSet || calm) {
      setOrder(next);
      return;
    }
    if (next.join('|') === order.join('|')) return;
    const t = setTimeout(() => setOrder(next), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, calm, delay]);

  // A row came or went: show the real order right away (only pure reorders wait).
  if (calm || ids.length !== order.length || !ids.every((id) => order.includes(id))) return items;
  const byId = new Map(items.map((t) => [idOf(t), t] as const));
  const out: T[] = [];
  for (const id of order) {
    const t = byId.get(id);
    if (t) {
      out.push(t);
      byId.delete(id);
    }
  }
  return out;
}
