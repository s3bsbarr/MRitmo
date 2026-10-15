/**
 * Motion for 1.9.2: one place for durations, curves and the "calm" switch.
 *
 * Rules: motion explains a change (where a row went, that a number moved), never
 * decorates. 150–350 ms, ease-out, no exaggerated bounce. With the phone's
 * "Remove animations" (One UI) or "reduce motion" on, everything lands at once:
 * `MotionGate` tells Reanimated, so every withTiming/withSpring and every
 * layout animation that keeps the default `ReduceMotion.System` jumps to its end.
 * Widgets and the live notification never animate (they are not React views).
 */
import { createElement, useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  Easing,
  ExitAnimationsValues,
  FadeIn,
  FadeOut,
  Keyframe,
  LinearTransition,
  makeMutable,
  ReducedMotionConfig,
  ReduceMotion,
  withTiming,
} from 'react-native-reanimated';

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

export const DUR = {
  /** A check filling, a strike drawing. */
  quick: 180,
  /** A row moving to its place, a card leaving. */
  move: 280,
  /** A number counting up, a bar growing. */
  count: 340,
} as const;

// ---- Calm (reduced motion) ------------------------------------------------

// Reanimated reads the system scale once at start; Android's accessibility event
// also follows "Remove animations" while the app is open. Either one turns motion off.
let calm = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => {
  if (v === calm) return;
  calm = v;
  listeners.forEach((l) => l());
};
AccessibilityInfo.isReduceMotionEnabled()
  .then(set)
  .catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', set);

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** True when the phone asks for no motion. Re-renders when the setting changes. */
export function useCalm() {
  return useSyncExternalStore(subscribe, () => calm);
}

export function isCalm() {
  return calm;
}

/** Mount once at the root: forces Reanimated's reduce-motion while the phone asks for it. */
export function MotionGate() {
  const c = useCalm();
  return c ? createElement(ReducedMotionConfig, { mode: ReduceMotion.Always }) : null;
}

// ---- Lists ----------------------------------------------------------------

/** Rows sliding to a new place (reorder, a neighbor left or arrived). */
export const rowLayout = LinearTransition.duration(DUR.move).easing(EASE_OUT);

/** A row that appears for any reason other than being just created. */
export const rowFadeIn = FadeIn.duration(200);

/** A card that leaves without a direction (accepted, rejected, cancelled). */
export const cardOut = FadeOut.duration(200);

/**
 * A task just created rises from the bottom, where the + is, and settles.
 * Starts at 96 %, never from 0.
 */
export const fromAdd = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 36 }, { scale: 0.96 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: EASE_OUT },
}).duration(DUR.move + 40);

/**
 * Which way the next removed row leaves: -1 to the left (deleted), 1 to the right
 * (moved to a later day). Read on the UI thread when the row unmounts.
 */
export const exitSide = makeMutable(-1);
let sideTimer: ReturnType<typeof setTimeout> | null = null;

/** Call right before removing a row from a list. Falls back to "left" after a moment. */
export function leaveTo(side: -1 | 1) {
  exitSide.set(side);
  if (sideTimer) clearTimeout(sideTimer);
  sideTimer = setTimeout(() => exitSide.set(-1), 800);
}

/** A row leaving sideways; the rows under it close the gap with `rowLayout`. */
export function slideAway(values: ExitAnimationsValues) {
  'worklet';
  const config = { duration: DUR.move - 40, easing: EASE_OUT, reduceMotion: ReduceMotion.System };
  return {
    initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
    animations: {
      opacity: withTiming(0, config),
      transform: [{ translateX: withTiming(exitSide.value * values.currentWidth * 0.5, config) }],
    },
  };
}
