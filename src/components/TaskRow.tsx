import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../haptics';
import { Pressable, Text, View } from 'react-native';
import { formatShort, timeLabel } from '../format';
import type { Task } from '../store';
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

/** One row of a grouped list with a check, shared by tasks and habits. */
export function CheckRow({ checked, title, meta, right, last, checkLabel, square, onToggle, onPress, onLongPress }: RowProps) {
  const { c } = useTheme();
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
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: square ? 7 : 12,
            borderWidth: checked ? 0 : 1.6,
            borderColor: c.textTertiary,
            backgroundColor: checked ? c.ink : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked && <Ionicons name="checkmark" size={15} color={c.inkOnInk} />}
        </View>
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
          <Text
            numberOfLines={2}
            style={[type.body, { color: checked ? c.textTertiary : c.text, textDecorationLine: checked ? 'line-through' : 'none' }]}
          >
            {title}
          </Text>
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
