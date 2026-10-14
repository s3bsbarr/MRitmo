import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, ScrollView, Share, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../avatar/Avatar';
import { Press } from '../components/Press';
import { UsernameField } from '../components/UsernameField';
import type { Gender } from '../data';
import { requestNotificationPermission } from '../effects';
import { claimUsername, normalizeUsername, sendRequest, USERNAME_RE } from '../friends';
import * as Haptics from '../haptics';
import { registerPush } from '../push';
import { font, radius, space, type, useTheme } from '../theme';

/** What the invitation link points to (same as the Amigos tab). */
const inviteLink = (username: string) => `https://mritmo.com/u/${username}`;

type Props = {
  name: string;
  gender: Gender;
  /** You already have a username (only the other steps are left). */
  username: string | null;
  /** Came from an invitation link: offer "Agregar a @usuario" first. */
  invitedBy: string | null;
  /** The username was saved: publish progress, refresh the Amigos tab. */
  onProfileReady: () => void;
  /** Finished or skipped. `toFriends` opens the Amigos tab. */
  onDone: (toFriends: boolean) => void;
};

/**
 * Right after creating an account (1.9): pick your @usuario, add your first
 * friend, turn on notifications. Three short steps; everything but the
 * username can be skipped, and the username can be left for later too.
 */
export function Onboarding({ name, gender, username: existing, invitedBy, onProfileReady, onDone }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(existing ? 1 : 0);
  const [username, setUsername] = useState(existing ?? '');
  const [mine, setMine] = useState<string | null>(existing);
  const [friend, setFriend] = useState(invitedBy ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [notif, setNotif] = useState<'granted' | 'ask' | 'blocked'>('ask');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.getPermissionsAsync()
      .then((p) => setNotif(p.granted ? 'granted' : p.canAskAgain ? 'ask' : 'blocked'))
      .catch(() => {});
  }, [step]);

  const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

  const claim = async () => {
    const u = normalizeUsername(username);
    if (!USERNAME_RE.test(u) || busy) return;
    setBusy(true);
    setError(null);
    try {
      await claimUsername(u, name, gender);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setMine(u);
      onProfileReady();
      setStep(1);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const u = normalizeUsername(friend);
    if (!u || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await sendRequest(u);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setAdded((prev) => [...prev, r === 'accepted' ? `Ahora eres amigo de @${u}.` : `Solicitud enviada a @${u}.`]);
      setFriend('');
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const enable = async () => {
    if (notif === 'blocked') {
      Linking.openSettings().catch(() => {});
      return;
    }
    setBusy(true);
    const ok = await requestNotificationPermission();
    setNotif(ok ? 'granted' : 'blocked');
    if (ok) await registerPush(true).catch(() => {});
    setBusy(false);
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const next = () => {
    tap();
    setError(null);
    if (step < 2) setStep(step + 1);
    else onDone(added.length > 0 || Boolean(mine));
  };

  const valid = USERNAME_RE.test(normalizeUsername(username));
  const primary = (label: string, onPress: () => void, disabled = false) => (
    <Press
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      style={{ height: 56, borderRadius: radius.pill, backgroundColor: c.ink, opacity: disabled ? 0.3 : 1, alignItems: 'center', justifyContent: 'center' }}
    >
      {busy ? <ActivityIndicator color={c.inkOnInk} /> : <Text style={[type.headline, { color: c.inkOnInk }]}>{label}</Text>}
    </Press>
  );
  const secondary = (label: string, onPress: () => void) => (
    <Press onPress={onPress} accessibilityRole="button" style={{ alignSelf: 'center', padding: space.md, marginTop: space.xs }}>
      <Text style={[type.callout, { color: c.textSecondary }]}>{label}</Text>
    </Press>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space.xxl, paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.lg }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[type.footnote, { color: c.textTertiary, fontVariant: ['tabular-nums'] }]}>
          Tu cuenta · {step + 1} de 3
        </Text>

        <Animated.View key={step} entering={FadeIn.duration(220)} style={{ flex: 1 }}>
          {step === 0 && (
            <>
              <Text style={[type.largeTitle, { color: c.text, marginTop: space.md }]}>Elige tu usuario</Text>
              <Text style={[type.body, { color: c.textSecondary, marginTop: space.md }]}>
                Es como te encuentran tus amigos. Letras minúsculas, números, punto o guion bajo. Tus tareas siguen siendo privadas: con amigos solo compartes tu avance.
              </Text>
              <View style={{ marginTop: space.xl }}>
                <UsernameField value={username} onChange={setUsername} onSubmit={claim} autoFocus accessibilityLabel="Tu usuario" />
              </View>
              {valid ? (
                <Text style={[type.footnote, { color: c.textTertiary, marginTop: space.sm }]}>Tu enlace será mritmo.com/u/{normalizeUsername(username)}</Text>
              ) : null}
            </>
          )}

          {step === 1 && (
            <>
              <Text style={[type.largeTitle, { color: c.text, marginTop: space.md }]}>Tu primer amigo</Text>
              <Text style={[type.body, { color: c.textSecondary, marginTop: space.md }]}>
                Avanzar con alguien ayuda. Envíale tu enlace o escribe su @usuario.
              </Text>
              <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xl }}>
                <Avatar gender={gender} mood="foco" px={3} still />
                <Avatar gender={gender === 'm' ? 'f' : 'm'} mood="calma" px={3} still />
              </View>
              {mine ? (
                <Press
                  onPress={() => {
                    tap();
                    Share.share({ message: `Agrégame en MRitmo: ${inviteLink(mine)}` }).catch(() => {});
                  }}
                  accessibilityRole="button"
                  style={{ marginTop: space.xl, minHeight: 56, borderRadius: radius.lg, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg }}
                >
                  <Ionicons name="share-outline" size={20} color={c.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.body, { color: c.text }]}>Compartir mi enlace</Text>
                    <Text style={[type.footnote, { color: c.textSecondary }]}>mritmo.com/u/{mine}</Text>
                  </View>
                </Press>
              ) : null}
              <Text style={[type.callout, { color: c.text, marginTop: space.xl, marginBottom: space.sm }]}>O agrégalo con su usuario</Text>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <UsernameField value={friend} onChange={setFriend} onSubmit={add} returnKeyType="send" accessibilityLabel="Usuario de tu amigo" />
                </View>
                <Press
                  onPress={add}
                  disabled={!friend || busy || !mine}
                  accessibilityRole="button"
                  style={{ height: 52, paddingHorizontal: space.xl, borderRadius: radius.md, backgroundColor: c.ink, opacity: friend && mine ? 1 : 0.3, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={[type.headline, { color: c.inkOnInk }]}>Agregar</Text>
                </Press>
              </View>
              {!mine ? (
                <Text style={[type.footnote, { color: c.textTertiary, marginTop: space.sm }]}>Para agregar amigos primero elige tu usuario (en la pestaña Amigos).</Text>
              ) : null}
              {added.map((m) => (
                <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm }}>
                  <Ionicons name="checkmark" size={16} color={c.text} />
                  <Text style={[type.footnote, { color: c.text }]}>{m}</Text>
                </View>
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <Text style={[type.largeTitle, { color: c.text, marginTop: space.md }]}>Activa las notificaciones</Text>
              <Text style={[type.body, { color: c.textSecondary, marginTop: space.md }]}>
                Te avisamos cuando alguien te agrega o acepta tu solicitud, te invita a un hábito o a una sala, y cuando tu amigo ya marcó el hábito de hoy. También cuando termina un bloque de foco. Llegan aunque MRitmo esté cerrada.
              </Text>
              <View style={{ marginTop: space.xl, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
                {[
                  ['person-add-outline', 'Ana te envió una solicitud'],
                  ['flame-outline', 'Ana ya marcó «Leer 20 min». Faltas tú.'],
                  ['timer-outline', 'Tiempo cumplido'],
                ].map(([icon, text]) => (
                  <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <Ionicons name={icon as React.ComponentProps<typeof Ionicons>['name']} size={18} color={c.textSecondary} />
                    <Text style={[type.callout, { color: c.text, flex: 1 }]}>{text}</Text>
                  </View>
                ))}
              </View>
              {notif === 'granted' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.lg }}>
                  <Ionicons name="checkmark-circle" size={18} color={c.text} />
                  <Text style={[type.callout, { color: c.text }]}>Activadas. Puedes elegir cuáles en Configuración.</Text>
                </View>
              ) : notif === 'blocked' ? (
                <Text style={[type.footnote, { color: c.textSecondary, marginTop: space.lg }]}>
                  Android las tiene bloqueadas para MRitmo. Actívalas en los ajustes del teléfono.
                </Text>
              ) : null}
            </>
          )}
        </Animated.View>

        {error ? <Text style={[type.footnote, { color: c.danger, marginBottom: space.md }]}>{error}</Text> : null}

        {step === 0 && (
          <>
            {primary('Guardar usuario', claim, !valid)}
            {secondary('Más tarde', () => {
              tap();
              setError(null);
              setStep(2);
            })}
          </>
        )}
        {step === 1 && (
          <>
            {primary('Siguiente', next)}
          </>
        )}
        {step === 2 && (
          <>
            {notif === 'granted'
              ? primary('Listo', next)
              : primary(notif === 'blocked' ? 'Abrir ajustes del teléfono' : 'Activar notificaciones', enable)}
            {notif !== 'granted' ? secondary('Ahora no', next) : null}
          </>
        )}
        <Text style={[type.caption, { color: c.textTertiary, textAlign: 'center', marginTop: space.sm, fontFamily: font.medium }]}>
          {step === 0
            ? 'Puedes cambiar tu nombre y personaje en Configuración.'
            : step === 1
              ? 'Puedes agregar amigos cuando quieras en la pestaña Amigos.'
              : 'Cada aviso tiene su interruptor en Configuración.'}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
