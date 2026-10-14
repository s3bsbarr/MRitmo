import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Modal, Platform, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RitmoLive from '../../modules/ritmo-live/src/RitmoLiveModule';
import type { Task } from '../data';
import { formatClock, formatShort } from '../format';
import { font, radius, space } from '../theme';
import { Press } from './Press';

/** Always black on white, in light and dark mode: the timer reads from across the room. */
const PAPER = '#FFFFFF';
const INK = '#0A0A0B';
const MUTED = 'rgba(10,10,11,0.55)';
const TRACK = 'rgba(10,10,11,0.10)';

type Props = {
  visible: boolean;
  task: Task | null;
  /** ms left right now and whether it runs. */
  remaining: number;
  totalMs: number;
  running: boolean;
  started: boolean;
  onClose: () => void;
  onStartPause: () => void;
  onPlusFive: () => void;
  onDone: () => void;
};

/**
 * The focus timer filling the screen, opened by tapping the live notification
 * (chip, Now Bar) or from Foco. Same buttons as the notification: +5 min,
 * Pausar / Seguir, Terminé. Keeps the screen on while open.
 */
export function FocusFull({ visible, task, remaining, totalMs, running, started, onClose, onStartPause, onPlusFive, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [, tick] = useState(0);

  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    try {
      RitmoLive?.keepScreenOn(true);
    } catch {}
    return () => {
      try {
        RitmoLive?.keepScreenOn(false);
      } catch {}
    };
  }, [visible]);

  // The parent re-renders every 250 ms while running; this keeps a paused clock honest too.
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [visible]);

  const clock = formatClock(remaining / 1000);
  const finished = task !== null && remaining === 0;
  // As large as the width allows: five characters (24:13) or seven (1:24:13).
  const size = Math.min(Math.floor((width - space.xl * 2) / (clock.length > 5 ? 3.9 : 2.95)), Math.floor(height * 0.24));
  const ratio = totalMs === 0 ? 0 : Math.min(1, Math.max(0, 1 - remaining / totalMs));

  const pill = (label: string, icon: keyof typeof Ionicons.glyphMap, onPress: () => void, filled: boolean) => (
    <Press
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flex: 1,
        height: 58,
        borderRadius: radius.pill,
        backgroundColor: filled ? INK : PAPER,
        borderWidth: filled ? 0 : 1.5,
        borderColor: INK,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Ionicons name={icon} size={18} color={filled ? PAPER : INK} />
      <Text style={{ fontFamily: font.semibold, fontSize: 17, letterSpacing: -0.3, color: filled ? PAPER : INK }}>{label}</Text>
    </Press>
  );

  const buttons = !task
    ? []
    : finished
      ? [pill('+5 min', 'add', onPlusFive, false), pill('Terminé', 'checkmark', onDone, true)]
      : running
        ? [pill('+5 min', 'add', onPlusFive, false), pill('Pausar', 'pause', onStartPause, false), pill('Terminé', 'checkmark', onDone, true)]
        : [pill(started ? 'Seguir' : 'Empezar', 'play', onStartPause, true), pill('Terminé', 'checkmark', onDone, false)];

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PAPER, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.xl }}>
        <StatusBar style="dark" />
        <Press
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar pantalla completa"
          style={{ alignSelf: 'flex-start', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: TRACK }}
        >
          <Ionicons name="chevron-down" size={22} color={INK} />
        </Press>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          {task ? (
            <>
              <Text style={{ fontFamily: font.semibold, fontSize: 22, letterSpacing: -0.5, color: INK, textAlign: 'center' }} numberOfLines={2}>
                {task.title}
              </Text>
              <Text
                style={{
                  fontFamily: font.bold,
                  fontSize: size,
                  lineHeight: Math.round(size * 1.08),
                  letterSpacing: -size * 0.045,
                  color: INK,
                  textAlign: 'center',
                  fontVariant: ['tabular-nums'],
                  marginTop: space.lg,
                }}
                numberOfLines={1}
                adjustsFontSizeToFit
                accessibilityLabel={`Quedan ${clock}`}
                accessibilityLiveRegion="polite"
              >
                {clock}
              </Text>
              <View style={{ height: 5, borderRadius: 3, backgroundColor: TRACK, marginTop: space.lg, marginHorizontal: space.xl, overflow: 'hidden' }}>
                <View style={{ width: `${ratio * 100}%`, height: 5, backgroundColor: INK }} />
              </View>
              <Text style={{ fontFamily: font.medium, fontSize: 15, color: MUTED, textAlign: 'center', marginTop: space.md }}>
                {finished ? 'Tiempo cumplido' : running ? `de ${formatShort(Math.round(totalMs / 60000))}` : started ? 'En pausa' : `Bloque de ${formatShort(Math.round(totalMs / 60000))}`}
              </Text>
            </>
          ) : (
            <Text style={{ fontFamily: font.semibold, fontSize: 22, color: INK, textAlign: 'center' }}>No hay un foco en curso.</Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>{buttons}</View>
      </View>
    </Modal>
  );
}
