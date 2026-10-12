import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Alert, Pressable, Text, View } from 'react-native';
import { formatShort } from '../format';
import type { Task } from '../store';
import { space, type, useTheme } from '../theme';
import { Press } from './Press';

type Props = {
  task: Task;
  last: boolean;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onFocus: (id: string) => void;
};

export function TaskRow({ task, last, onToggle, onRemove, onFocus }: Props) {
  const { c } = useTheme();

  const toggle = () => {
    if (!task.done) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onToggle(task.id);
  };

  const askRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(task.title, undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar tarea', style: 'destructive', onPress: () => onRemove(task.id) },
    ]);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 60 }}>
      <Press
        onPress={toggle}
        scaleTo={0.88}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityLabel={task.done ? `Marcar ${task.title} como pendiente` : `Completar ${task.title}`}
        style={{ width: 52, height: 60, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: task.done ? 0 : 1.6,
            borderColor: c.textTertiary,
            backgroundColor: task.done ? c.ink : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {task.done && <Ionicons name="checkmark" size={15} color={c.inkOnInk} />}
        </View>
      </Press>

      <Pressable
        onPress={() => (task.done ? toggle() : onFocus(task.id))}
        onLongPress={askRemove}
        delayLongPress={380}
        android_ripple={null}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'stretch',
          paddingRight: space.lg,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: c.separator,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text
          numberOfLines={2}
          style={[
            type.body,
            {
              flex: 1,
              color: task.done ? c.textTertiary : c.text,
              textDecorationLine: task.done ? 'line-through' : 'none',
            },
          ]}
        >
          {task.title}
        </Text>
        <Text
          style={[
            type.callout,
            { color: task.done ? c.textTertiary : c.textSecondary, marginLeft: space.md, fontVariant: ['tabular-nums'] },
          ]}
        >
          {formatShort(task.minutes)}
        </Text>
      </Pressable>
    </View>
  );
}
