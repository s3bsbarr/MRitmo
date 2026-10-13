import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text, View } from 'react-native';
import { radius, space, type, useTheme } from '../theme';
import { Press } from './Press';
import { Sheet } from './Sheet';

export type ConfirmRequest = {
  title: string;
  /** The thing being acted on, shown as a card so it is clear what will change. */
  subject: string;
  detail?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
};

/** Designed replacement for the system alert: names the item, one clear destructive action. */
export function ConfirmSheet({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const { c } = useTheme();
  return (
    <Sheet visible={request !== null} onClose={onClose}>
      {request && (
        <View>
          <Text style={[type.title, { color: c.text }]}>{request.title}</Text>
          <View
            style={{
              marginTop: space.lg,
              backgroundColor: c.surface,
              borderRadius: radius.md,
              paddingHorizontal: space.lg,
              paddingVertical: space.md + 2,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
            }}
          >
            <Ionicons name={request.destructive ? 'trash-outline' : 'information-circle-outline'} size={20} color={c.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { color: c.text }]} numberOfLines={2}>
                {request.subject}
              </Text>
              {request.detail ? <Text style={[type.footnote, { color: c.textSecondary }]}>{request.detail}</Text> : null}
            </View>
          </View>
          {request.destructive && (
            <Text style={[type.footnote, { color: c.textTertiary, marginTop: space.sm }]}>No se puede deshacer.</Text>
          )}
          <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.xl }}>
            <Press
              onPress={onClose}
              accessibilityRole="button"
              style={{ flex: 1, height: 54, borderRadius: radius.pill, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={[type.headline, { color: c.text }]}>Cancelar</Text>
            </Press>
            <Press
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                request.onConfirm();
                onClose();
              }}
              accessibilityRole="button"
              style={{
                flex: 1,
                height: 54,
                borderRadius: radius.pill,
                backgroundColor: request.destructive ? c.danger : c.ink,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={[type.headline, { color: request.destructive ? '#FFFFFF' : c.inkOnInk }]}>{request.confirmLabel}</Text>
            </Press>
          </View>
        </View>
      )}
    </Sheet>
  );
}
