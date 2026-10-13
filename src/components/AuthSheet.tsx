import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { friendlyError, resetPassword, signIn, signInWithLink, signUp } from '../sync';
import { font, radius, space, type, useTheme } from '../theme';
import { Press } from './Press';
import { Sheet } from './Sheet';

type Mode = 'signin' | 'signup';

/** Create an account or sign in. On success the caller restores and backs up data. */
export function AuthSheet({
  visible,
  initialMode = 'signup',
  onClose,
  onSignedIn,
}: {
  visible: boolean;
  initialMode?: Mode;
  onClose: () => void;
  onSignedIn: () => void;
}) {
  const { c } = useTheme();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setMode(initialMode);
    setPassword('');
    setError(null);
    setNotice(null);
    setBusy(false);
  }, [visible, initialMode]);

  const valid = /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 6;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signup') {
        const r = await signUp(email, password);
        if (r === 'confirm') {
          setNotice(`Te enviamos un enlace a ${email.trim()}. Ábrelo desde este teléfono para activar tu cuenta.`);
          setMode('signin');
          return;
        }
      } else {
        await signIn(email, password);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSignedIn();
      onClose();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const sendLink = async () => {
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setError('Escribe tu correo arriba y vuelve a tocar "Entrar sin contraseña".');
      return;
    }
    setBusy(true);
    try {
      await signInWithLink(email);
      setError(null);
      setNotice(`Te enviamos un enlace a ${email.trim()}. Ábrelo desde este teléfono y entras directo.`);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setError('Escribe tu correo arriba y vuelve a tocar "Olvidé mi contraseña".');
      return;
    }
    try {
      await resetPassword(email);
      setError(null);
      setNotice(`Te enviamos un enlace a ${email.trim()} para cambiar tu contraseña.`);
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const input = {
    fontFamily: font.regular,
    fontSize: 17,
    letterSpacing: -0.2,
    color: c.text,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  } as const;

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={[type.title, { color: c.text }]}>{mode === 'signup' ? 'Crea tu cuenta' : 'Inicia sesión'}</Text>
      <Text style={[type.callout, { color: c.textSecondary, marginTop: space.xs }]}>
        Tus tareas, hábitos y ajustes quedan respaldados. Si cambias de teléfono o reinstalas, inicias sesión y vuelve todo.
      </Text>

      <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: radius.md, padding: 4, marginTop: space.xl }}>
        {(['signup', 'signin'] as Mode[]).map((m) => {
          const active = mode === m;
          return (
            <Press
              key={m}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setMode(m);
                setError(null);
              }}
              scaleTo={0.97}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={{ flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.bg : 'transparent' }}
            >
              <Text style={[type.callout, { color: active ? c.text : c.textSecondary }]}>{m === 'signup' ? 'Crear cuenta' : 'Ya tengo cuenta'}</Text>
            </Press>
          );
        })}
      </View>

      <View style={{ gap: space.md, marginTop: space.lg }}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Correo"
          placeholderTextColor={c.textTertiary}
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          selectionColor={c.ink}
          cursorColor={c.ink}
          style={input}
        />
        <View>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'signup' ? 'Contraseña (mínimo 6)' : 'Contraseña'}
            placeholderTextColor={c.textTertiary}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            textContentType={mode === 'signup' ? 'newPassword' : 'password'}
            returnKeyType="go"
            onSubmitEditing={submit}
            selectionColor={c.ink}
            cursorColor={c.ink}
            style={[input, { paddingRight: 52 }]}
          />
          <Press
            onPress={() => setShowPw(!showPw)}
            accessibilityRole="button"
            accessibilityLabel={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            style={{ position: 'absolute', right: 4, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.textSecondary} />
          </Press>
        </View>
      </View>

      {error && (
        <Text style={[type.footnote, { color: c.danger, marginTop: space.md }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
      {notice && (
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, backgroundColor: c.surface, borderRadius: radius.md, padding: space.md }}>
          <Ionicons name="mail-outline" size={18} color={c.text} />
          <Text style={[type.footnote, { color: c.text, flex: 1 }]} accessibilityLiveRegion="polite">
            {notice}
          </Text>
        </View>
      )}

      <Press
        onPress={submit}
        disabled={!valid || busy}
        accessibilityRole="button"
        style={{
          marginTop: space.xl,
          height: 54,
          borderRadius: radius.pill,
          backgroundColor: c.ink,
          opacity: valid ? 1 : 0.3,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {busy ? (
          <ActivityIndicator color={c.inkOnInk} />
        ) : (
          <Text style={[type.headline, { color: c.inkOnInk }]}>{mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'}</Text>
        )}
      </Press>

      {mode === 'signin' && (
        <>
          <Press
            onPress={sendLink}
            disabled={busy}
            accessibilityRole="button"
            style={{ marginTop: space.md, height: 50, borderRadius: radius.pill, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm }}
          >
            <Ionicons name="link-outline" size={18} color={c.text} />
            <Text style={[type.headline, { color: c.text }]}>Entrar sin contraseña</Text>
          </Press>
          <Press onPress={forgot} style={{ alignSelf: 'center', padding: space.sm, marginTop: space.xs }}>
            <Text style={[type.callout, { color: c.textSecondary }]}>Olvidé mi contraseña</Text>
          </Press>
        </>
      )}
    </Sheet>
  );
}
