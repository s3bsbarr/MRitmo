import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextLayoutLine, View } from 'react-native';
import Animated, { interpolate, SharedValue, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { formatShort, timeLabel } from '../format';
import type { Task } from '../store';
import { DUR, EASE_OUT } from '../motion';
import { space, type, useTheme } from '../theme';
import { Press } from './Press';

type RowProps = {
  checked: boolean;
  title: string;
  /** Secondary line under the title: a scheduled time, a day, a reminder. */
  meta?: string;
  right?: React.ReactNode;
  last: boolean;
  checkLabel: string;
  /** Square checks mark habits; round checks mark tasks. */
  square?: boolean;
  onToggle: () => void;
  onPress?: () => void;
  onLongPress: () => void;
};

/**
 * One drawn strike over a line of the title. The line draws from the left when
 * the row is checked and retracts when unchecked; with several lines they draw
 * one after the other within the same 220 ms.
 */
function StrikeLine({ line, index, count, progress, color }: { line: TextLayoutLine; index: number; count: number; progress: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const from = index / count;
    const to = (index + 1) / count;
    return { transform: [{ scaleX: interpolate(progress.get(), [from, to], [0, 1], 'clamp') }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: line.x,
          top: line.y + line.height * 0.52,
          width: line.width,
          height: 1.5,
          borderRadius: 1,
          backgroundColor: color,
          transformOrigin: 'left',
        },
        style,
      ]}
    />
  );
}

/** One row of a grouped list with a check, shared by tasks and habits. */
export function CheckRow({ checked, title, meta, right, last, checkLabel, square, onToggle, onPress, onLongPress }: RowProps) {
  const { c } = useTheme();
  // 1.9.2: the strike is drawn (not a text style) so it can grow across the title.
  const [lines, setLines] = useState<TextLayoutLine[]>([]);
  const strike = useSharedValue(checked ? 1 : 0);
  const pop = useSharedValue(1);
  const was = useRef(checked);
  useEffect(() => {
    if (was.current === checked) return;
    strike.set(withTiming(checked ? 1 : 0, { duration: 220, easing: EASE_OUT }));
    // Habits: the check gives a small, quick bounce when marked (no overshoot past 1.14).
    if (checked && square) {
      pop.set(withSequence(withTiming(1.14, { duration: 110, easing: EASE_OUT }), withTiming(1, { duration: DUR.quick, easing: EASE_OUT })));
    }
    was.current = checked;
  }, [checked, square, strike, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 60 }}>
      <Press
        onPress={() => {
          if (!checked) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          else Haptics.selectionAsync().catch(() => {});
          onToggle();
        }}
        scaleTo={0.88}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={checkLabel}
        style={{ width: 52, minHeight: 60, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View
          style={[popStyle, {
            width: 24,
            height: 24,
            borderRadius: square ? 7 : 12,
            borderWidth: checked ? 0 : 1.6,
            borderColor: c.textTertiary,
            backgroundColor: checked ? c.ink : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }]}
        >
          {checked && <Ionicons name="checkmark" size={15} color={c.inkOnInk} />}
        </Animated.View>
      </Press>

      <Pressable
        onPress={onPress ?? onToggle}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onLongPress();
        }}
        delayLongPress={380}
        android_ripple={null}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'stretch',
          paddingVertical: space.sm + 2,
          paddingRight: space.lg,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: c.separator,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View style={{ flex: 1 }}>
          <View>
            <Text
              numberOfLines={2}
              onTextLayout={(e) => setLines(e.nativeEvent.lines.slice(0, 2))}
              style={[type.body, { color: checked ? c.textTertiary : c.text }]}
            >
              {title}
            </Text>
            {lines.map((l, i) => (
              <StrikeLine key={i} line={l} index={i} count={lines.length} progress={strike} color={c.textTertiary} />
            ))}
          </View>
          {meta ? <Text style={[type.footnote, { color: checked ? c.textTertiary : c.textSecondary, fontVariant: ['tabular-nums'] }]}>{meta}</Text> : null}
        </View>
        {right}
      </Pressable>
    </View>
  );
}

type Props = {
  task: Task;
  last: boolean;
  meta?: string;
  onToggle: (id: string) => void;
  onRequestRemove: (task: Task) => void;
  onFocus: (id: string) => void;
};

export function TaskRow({ task, last, meta, onToggle, onRequestRemove, onFocus }: Props) {
  const { c } = useTheme();
  return (
    <CheckRow
      checked={task.done}
      title={task.title}
      meta={meta ?? (task.at ? timeLabel(task.at) : undefined)}
      last={last}
      checkLabel={task.done ? `Marcar ${task.title} como pendiente` : `Completar ${task.title}`}
      onToggle={() => onToggle(task.id)}
      onPress={() => (task.done ? onToggle(task.id) : onFocus(task.id))}
      onLongPress={() => onRequestRemove(task)}
      right={
        <Text style={[type.callout, { color: task.done ? c.textTertiary : c.textSecondary, marginLeft: space.md, fontVariant: ['tabular-nums'] }]}>
          {formatShort(task.minutes)}
        </Text>
      }
    />
  );
}
