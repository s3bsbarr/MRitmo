import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, TextInput, View } from 'react-native';
import * as Haptics from '../haptics';
import { font, radius, space, type, useTheme } from '../theme';
import { Press } from './Press';
import { Sheet } from './Sheet';

const WORD = 'ELIMINAR';

const GOES: [React.ComponentProps<typeof Ionicons>['name'], string][] = [
  ['mail-outline', 'Tu cuenta y tu correo'],
  ['cloud-outline', 'Tu respaldo: tareas, hábitos, rachas y ajustes'],
  ['at-outline', 'Tu @usuario, tu nombre y tu personaje'],
  ['stats-chart-outline', 'Tu avance de cada día'],
  ['people-outline', 'Tus amistades, solicitudes y bloqueos'],
  ['flame-outline', 'Tus hábitos juntos y sus rachas'],
  ['notifications-outline', 'Tus avisos y los teléfonos registrados'],
];

/**
 * "Eliminar cuenta" (1.9). Says plainly what goes, what happens to your rooms
 * and what stays on the phone, and asks you to type ELIMINAR so it can't
 * happen by accident. `onDelete` does the work and throws a readable error.
 */
export function DeleteAccountSheet({
  visible,
  email,
  ownsRooms,
  onClose,
  onDelete,
}: {
  visible: boolean;
  email: string | null;
  /** How many rooms you own (they pass to their oldest member). */
  ownsRooms: number;
  onClose: () => void;
  onDelete: (word: string) => Promise<void>;
}) {
  const { c } = useTheme();
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setWord('');
    setBusy(false);
    setError(null);
    setDone(false);
  }, [visible]);

  const ready = word.trim().toUpperCase() === WORD;

  const run = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    try {
      await onDelete(WORD);
      setDone(true);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Sheet visible={visible} onClose={onClose}>
        <View>
          <Ionicons name="checkmark-circle-outline" size={34} color={c.text} />
          <Text style={[type.title, { color: c.text, marginTop: space.md }]}>Tu cuenta fue eliminada</Text>
          <Text style={[type.body, { color: c.textSecondary, marginTop: space.sm }]}>
            Borramos tu cuenta y todo lo que había en el servidor. Lo que está en este teléfono sigue aquí, sin respaldo. Si quieres, puedes crear otra cuenta cuando quieras.
          </Text>
          <Press
            onPress={onClose}
            accessibilityRole="button"
            style={{ marginTop: space.xl, height: 54, borderRadius: radius.pill, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={[type.headline, { color: c.inkOnInk }]}>Listo</Text>
          </Press>
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={busy ? () => {} : onClose}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
        <Text style={[type.title, { color: c.text }]}>¿Eliminar tu cuenta?</Text>
        {email ? <Text style={[type.callout, { color: c.textSecondary, marginTop: 2 }]}>{email}</Text> : null}

        <Text style={[type.callout, { color: c.text, marginTop: space.xl, marginBottom: space.sm, fontFamily: font.semibold }]}>Se borra del servidor</Text>
        <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, paddingVertical: space.xs }}>
          {GOES.map(([icon, label]) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm }}>
              <Ionicons name={icon} size={18} color={c.textSecondary} />
              <Text style={[type.callout, { color: c.text, flex: 1 }]}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <Text style={[type.footnote, { color: c.textSecondary }]}>
            {ownsRooms > 0
              ? `Tus salas (${ownsRooms}) no desaparecen: cada una pasa a quien lleva más tiempo en ella. Una sala donde no hay nadie más se elimina.`
              : 'Si estás en salas, sales de ellas. Las salas que crees pasan a quien lleva más tiempo en cada una.'}
          </Text>
          <Text style={[type.footnote, { color: c.textSecondary }]}>
            En este teléfono tus tareas y hábitos se quedan, sin respaldo, hasta que los borres o desinstales MRitmo.
          </Text>
          <Text style={[type.footnote, { color: c.textSecondary }]}>
            Es inmediato y no se puede deshacer.{' '}
            <Text
              onPress={() => Linking.openURL('https://mritmo.com/eliminar-cuenta/').catch(() => {})}
              style={{ color: c.text, textDecorationLine: 'underline' }}
              accessibilityRole="link"
            >
              Más detalles
            </Text>
          </Text>
        </View>

        <Text style={[type.callout, { color: c.text, marginTop: space.xl, marginBottom: space.sm }]}>
          Escribe <Text style={{ fontFamily: font.bold }}>{WORD}</Text> para confirmar
        </Text>
        <TextInput
          value={word}
          onChangeText={(t) => {
            setWord(t);
            setError(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          editable={!busy}
          placeholder={WORD}
          placeholderTextColor={c.textTertiary}
          returnKeyType="done"
          onSubmitEditing={run}
          selectionColor={c.ink}
          cursorColor={c.ink}
          accessibilityLabel={`Escribe ${WORD} para confirmar`}
          style={{
            fontFamily: font.semibold,
            fontSize: 17,
            letterSpacing: 1,
            color: c.text,
            backgroundColor: c.surface,
            borderRadius: radius.md,
            paddingHorizontal: space.lg,
            paddingVertical: 14,
          }}
        />
        {error ? <Text style={[type.footnote, { color: c.danger, marginTop: space.sm }]}>{error}</Text> : null}

        <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.xl }}>
          <Press
            onPress={onClose}
            disabled={busy}
            accessibilityRole="button"
            style={{ flex: 1, height: 54, borderRadius: radius.pill, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={[type.headline, { color: c.text }]}>Cancelar</Text>
          </Press>
          <Press
            onPress={run}
            disabled={!ready || busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready || busy }}
            style={{ flex: 1, height: 54, borderRadius: radius.pill, backgroundColor: c.danger, opacity: ready ? 1 : 0.35, alignItems: 'center', justifyContent: 'center' }}
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[type.headline, { color: '#FFFFFF' }]}>Eliminar</Text>}
          </Press>
        </View>
      </ScrollView>
    </Sheet>
  );
}
