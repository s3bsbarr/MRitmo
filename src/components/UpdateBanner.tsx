import { Ionicons } from '@expo/vector-icons';
import { Linking, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from '../haptics';
import { font, radius, space, type, useTheme } from '../theme';
import { DOWNLOAD_URL, NEWS_URL, Release, UpdateInfo } from '../update';
import { Press } from './Press';

export const openDownload = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  Linking.openURL(DOWNLOAD_URL).catch(() => {});
};

export const openNews = (r?: Release | null) =>
  Linking.openURL(`${NEWS_URL}${r ? `#v${r.version.replace(/\./g, '-')}` : ''}`).catch(() => {});

/**
 * "MRitmo 1.10 está disponible" on Hoy (1.9). One quiet card: what's new in a
 * line, Descargar (opens mritmo.com/descargar) and Ahora no (hides it for that
 * version; Configuración keeps showing it).
 */
export function UpdateBanner({ update, onDismiss }: { update: UpdateInfo | null; onDismiss: (version: string) => void }) {
  const { c } = useTheme();
  const r = update?.release;
  if (!update?.available || update.dismissed || !r) return null;
  const mb = r.bytes ? `${Math.round(r.bytes / 1048576)} MB` : '';
  return (
    <Animated.View entering={FadeIn.duration(220)} style={{ marginTop: space.xl, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Ionicons name="arrow-down-circle-outline" size={20} color={c.text} />
        <Text style={[type.headline, { color: c.text, flex: 1 }]}>MRitmo {r.version} está disponible</Text>
      </View>
      <Text style={[type.footnote, { color: c.textSecondary, marginTop: 4 }]} numberOfLines={3}>
        {r.title ?? r.notes?.[0] ?? 'Hay una versión nueva.'} Se instala encima: no pierdes nada.
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md }}>
        <Press
          onPress={openDownload}
          accessibilityRole="button"
          accessibilityLabel={`Descargar MRitmo ${r.version}${mb ? `, ${mb}` : ''}`}
          style={{ height: 38, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={[type.callout, { color: c.inkOnInk, fontFamily: font.semibold }]}>Descargar{mb ? ` · ${mb}` : ''}</Text>
        </Press>
        <Press onPress={() => openNews(r)} accessibilityRole="link" style={{ height: 38, paddingHorizontal: space.md, justifyContent: 'center' }}>
          <Text style={[type.callout, { color: c.text }]}>Novedades</Text>
        </Press>
        <View style={{ flex: 1 }} />
        <Press
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onDismiss(r.version);
          }}
          accessibilityRole="button"
          style={{ height: 38, paddingHorizontal: space.sm, justifyContent: 'center' }}
        >
          <Text style={[type.callout, { color: c.textSecondary }]}>Ahora no</Text>
        </Press>
      </View>
    </Animated.View>
  );
}
