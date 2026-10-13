import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { radius, space, useTheme } from '../theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Called once the sheet has finished opening (focus inputs here). */
  onOpened?: () => void;
};

/** Bottom sheet shared by every modal task in the app: rises without overshoot, dims the page. */
export function Sheet({ visible, onClose, children, onOpened }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const y = useSharedValue(700);
  const scrim = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.set(withSpring(0, { duration: 340, dampingRatio: 1 }));
      scrim.set(withTiming(1, { duration: 220, easing: EASE_OUT }));
      if (onOpened) setTimeout(onOpened, 140);
    } else if (mounted) {
      scrim.set(withTiming(0, { duration: 180, easing: EASE_OUT }));
      y.set(
        withTiming(700, { duration: 220, easing: EASE_OUT }, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() }));

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <Animated.View
          style={[
            {
              backgroundColor: c.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingHorizontal: space.xl,
              paddingTop: space.md,
              paddingBottom: Math.max(insets.bottom, space.lg) + space.md,
              maxHeight: '92%',
            },
            sheetStyle,
          ]}
        >
          <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: c.track, marginBottom: space.xl }} />
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
