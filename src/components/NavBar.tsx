import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, type, useTheme } from '../theme';
import { Glass } from './Glass';
import { Press } from './Press';

export type Tab = 'hoy' | 'foco' | 'resumen';

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'hoy', label: 'Hoy', icon: 'sunny-outline', iconActive: 'sunny' },
  { key: 'foco', label: 'Foco', icon: 'timer-outline', iconActive: 'timer' },
  { key: 'resumen', label: 'Resumen', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
];

export const NAV_HEIGHT = 64;

/** Floating glass tab bar plus a separate glass action button, iOS 26 style. */
export function NavBar({ tab, onTab, onAdd }: { tab: Tab; onTab: (t: Tab) => void; onAdd: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: space.lg,
        right: space.lg,
        bottom: Math.max(insets.bottom, space.md) + space.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
      }}
    >
      <Glass weight="thick" radius={radius.pill} style={{ flex: 1, height: NAV_HEIGHT }}>
        <View style={{ flex: 1, flexDirection: 'row', padding: 6 }} accessibilityRole="tablist">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Press
                key={t.key}
                onPress={() => onTab(t.key)}
                scaleTo={0.94}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.label}
                style={{
                  flex: 1,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? c.track : 'transparent',
                }}
              >
                <Ionicons name={active ? t.iconActive : t.icon} size={20} color={active ? c.text : c.textSecondary} />
                <Text style={[type.caption, { fontSize: 11, marginTop: 2, color: active ? c.text : c.textSecondary }]}>{t.label}</Text>
              </Press>
            );
          })}
        </View>
      </Glass>

      <Press onPress={onAdd} accessibilityRole="button" accessibilityLabel="Nueva tarea" scaleTo={0.92}>
        <Glass weight="thick" radius={NAV_HEIGHT / 2} style={{ width: NAV_HEIGHT, height: NAV_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={28} color={c.text} />
        </Glass>
      </Press>
    </View>
  );
}
