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
  const [hText, setHText] = useState('0');
  const [mText, setMText] = useState('30');
  const input = useRef<TextInput>(null);
  const minutes = clampInt(hText, 0, 23) * 60 + clampInt(mText, 0, 59);
  const setMinutes = (total: number) => {
    setHText(String(Math.floor(total / 60)));
    setMText(String(total % 60));
  };

  const y = useSharedValue(600);
  const scrim = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setTitle('');
      setHText('0');
      setMText('30');
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

  const canAdd = title.trim().length > 0 && minutes > 0;
  const submit = () => {
    if (!canAdd) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onAdd(title, minutes);
    onClose();
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
              paddingRight: space.sm,
              height: 56,
            }}
          >
            <Text style={[type.callout, { color: c.textSecondary }]}>Personalizada</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <NumberField value={hText} onChange={setHText} max={23} label="Horas" />
              <Text style={[type.callout, { color: c.textSecondary, marginRight: space.sm }]}>h</Text>
              <NumberField value={mText} onChange={setMText} max={59} label="Minutos" />
              <Text style={[type.callout, { color: c.textSecondary, marginRight: space.xs }]}>min</Text>
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
            <Text style={[type.headline, { color: c.inkOnInk }]}>{minutes > 0 ? `Agregar · ${formatMinutes(minutes)}` : 'Agregar a hoy'}</Text>
          </Press>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function clampInt(text: string, min: number, max: number) {
  const n = parseInt(text, 10);
  if (Number.isNaN(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

/** Free numeric entry: any hour from 0 to 23 and any minute from 0 to 59. */
function NumberField({ value, onChange, max, label }: { value: string; onChange: (v: string) => void; max: number; label: string }) {
  const { c } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={(t) => {
        const digits = t.replace(/[^0-9]/g, '').slice(0, 2);
        onChange(digits === '' ? '' : String(Math.min(max, parseInt(digits, 10))));
      }}
      onBlur={() => value === '' && onChange('0')}
      keyboardType="number-pad"
      inputMode="numeric"
      selectTextOnFocus
      maxLength={2}
      accessibilityLabel={label}
      selectionColor={c.ink}
      cursorColor={c.ink}
      style={{
        fontFamily: font.semibold,
        fontSize: 18,
        letterSpacing: -0.3,
        color: c.text,
        backgroundColor: c.bg,
        borderRadius: radius.sm,
        width: 52,
        height: 40,
        textAlign: 'center',
        paddingVertical: 0,
        fontVariant: ['tabular-nums'],
      }}
    />
  );
}
