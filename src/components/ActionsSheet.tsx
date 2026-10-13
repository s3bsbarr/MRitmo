import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import * as Haptics from '../haptics';
import { radius, space, type, useTheme } from '../theme';
import { Press } from './Press';
import { Sheet } from './Sheet';

export type ItemActions = {
  title: string;
  detail?: string;
  onEdit: () => void;
  onDelete: () => void;
};

/** Long-press menu for a task or habit: edit or delete, in the app's own style. */
export function ActionsSheet({ request, onClose }: { request: ItemActions | null; onClose: () => void }) {
  const { c } = useTheme();
  const row = (icon: keyof typeof Ionicons.glyphMap, label: string, color: string, onPress: () => void, last = false) => (
    <Press
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onClose();
        // Let this sheet slide away before the next one rises.
        setTimeout(onPress, 240);
      }}
      scaleTo={0.99}
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
        paddingHorizontal: space.lg,
        gap: space.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.separator,
      }}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[type.body, { color, flex: 1 }]}>{label}</Text>
    </Press>
  );

  return (
    <Sheet visible={request !== null} onClose={onClose}>
      {request && (
        <View>
          <Text style={[type.title, { color: c.text }]} numberOfLines={2}>
            {request.title}
          </Text>
          {request.detail ? <Text style={[type.callout, { color: c.textSecondary, marginTop: space.xs }]}>{request.detail}</Text> : null}
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden', marginTop: space.xl }}>
            {row('create-outline', 'Editar', c.text, request.onEdit)}
            {row('trash-outline', 'Eliminar', c.danger, request.onDelete, true)}
          </View>
          <Press
            onPress={onClose}
            accessibilityRole="button"
            style={{ marginTop: space.md, height: 52, borderRadius: radius.pill, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={[type.headline, { color: c.text }]}>Cancelar</Text>
          </Press>
        </View>
      )}
    </Sheet>
  );
}
