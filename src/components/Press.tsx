import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

/** Feedback on press-in (not release), 0.97 scale in ~120ms, like a native control. */
export function Press({ style, scaleTo = 0.97, onPressIn, onPressOut, hitSlop = 8, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      {...rest}
      hitSlop={hitSlop}
      pressRetentionOffset={16}
      onPressIn={(e) => {
        scale.set(withTiming(scaleTo, { duration: 110, easing: EASE_OUT }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, { duration: 160, easing: EASE_OUT }));
        onPressOut?.(e);
      }}
      style={[style, animated]}
    />
  );
}
