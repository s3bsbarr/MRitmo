import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/** The fill is absolute and childless, so animating its width never re-lays-out siblings. */
export function ProgressBar({ ratio, height = 6 }: { ratio: number; height?: number }) {
  const { c } = useTheme();
  const p = useSharedValue(ratio);

  useEffect(() => {
    p.set(withTiming(Math.min(1, Math.max(0, ratio)), { duration: 520, easing: EASE_OUT }));
  }, [ratio, p]);

  const fill = useAnimatedStyle(() => ({ width: `${p.get() * 100}%` }));

  return (
    <View style={{ height, borderRadius: height, backgroundColor: c.track, overflow: 'hidden' }}>
      <Animated.View
        style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: height, backgroundColor: c.ink }, fill]}
      />
    </View>
  );
}
