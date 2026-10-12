import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { formatMinutes } from '../format';
import { font, radius, space, type, useTheme } from '../theme';
import { Press } from './Press';

const PRESETS = [15, 30, 45, 60, 90, 120];
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

type Props = { visible: boolean; onClose: () => void; onAdd: (title: string, minutes: number) => void };

export function AddSheet({ visible, onClose, onAdd }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(30);
  const input = useRef<TextInput>(null);

  const y = useSharedValue(600);
  const scrim = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setTitle('');
      setMinutes(30);
      // Sheet rises with the iOS sheet feel; no overshoot because no finger threw it.
      y.set(withSpring(0, { duration: 340, dampingRatio: 1 }));
      scrim.set(withTiming(1, { duration: 220, easing: EASE_OUT }));
      setTimeout(() => input.current?.focus(), 120);
    } else if (mounted) {
      scrim.set(withTiming(0, { duration: 180, easing: EASE_OUT }));
      y.set(
        withTiming(600, { duration: 220, easing: EASE_OUT }, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() }));

  const canAdd = title.trim().length > 0;
  const submit = () => {
    if (!canAdd) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onAdd(title, minutes);
    onClose();
  };

  const step = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    setMinutes((m) => Math.min(480, Math.max(5, m + delta)));
  };

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
            },
            sheetStyle,
          ]}
        >
          <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: c.track, marginBottom: space.xl }} />

          <Text style={[type.title, { color: c.text, marginBottom: space.lg }]}>Nueva tarea</Text>

          <TextInput
            ref={input}
            value={title}
            onChangeText={setTitle}
            placeholder="¿Qué vas a hacer?"
            placeholderTextColor={c.textTertiary}
            selectionColor={c.ink}
            cursorColor={c.ink}
            returnKeyType="done"
            enterKeyHint="done"
            onSubmitEditing={submit}
            maxLength={120}
            style={{
              fontFamily: font.regular,
              fontSize: 18,
              letterSpacing: -0.25,
              color: c.text,
              backgroundColor: c.surface,
              borderRadius: radius.md,
              paddingHorizontal: space.lg,
              paddingVertical: 14,
            }}
          />

          <Text style={[type.caption, { color: c.textSecondary, marginTop: space.xl, marginBottom: space.md }]}>DURACIÓN</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {PRESETS.map((p) => {
              const active = p === minutes;
              return (
                <Press
                  key={p}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setMinutes(p);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    paddingHorizontal: space.lg,
                    height: 40,
                    borderRadius: radius.pill,
                    justifyContent: 'center',
                    backgroundColor: active ? c.ink : c.surface,
                  }}
                >
                  <Text style={[type.callout, { color: active ? c.inkOnInk : c.text, fontVariant: ['tabular-nums'] }]}>
                    {formatMinutes(p)}
                  </Text>
                </Press>
              );
            })}
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: space.lg,
              backgroundColor: c.surface,
              borderRadius: radius.md,
              paddingLeft: space.lg,
              height: 52,
            }}
          >
            <Text style={[type.callout, { color: c.textSecondary }]}>Personalizada</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Press onPress={() => step(-5)} accessibilityLabel="Restar 5 minutos" style={{ width: 48, height: 52, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="remove" size={20} color={c.text} />
              </Press>
              <Text style={[type.headline, { color: c.text, minWidth: 84, textAlign: 'center', fontVariant: ['tabular-nums'] }]}>
                {formatMinutes(minutes)}
              </Text>
              <Press onPress={() => step(5)} accessibilityLabel="Sumar 5 minutos" style={{ width: 48, height: 52, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add" size={20} color={c.text} />
              </Press>
            </View>
          </View>

          <Press
            onPress={submit}
            disabled={!canAdd}
            accessibilityRole="button"
            style={{
              marginTop: space.xl,
              height: 54,
              borderRadius: radius.pill,
              backgroundColor: c.ink,
              opacity: canAdd ? 1 : 0.3,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={[type.headline, { color: c.inkOnInk }]}>Agregar a hoy</Text>
          </Press>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
