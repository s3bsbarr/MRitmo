import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Text, TextInput, View } from 'react-native';
import RitmoLive from '../../modules/ritmo-live/src/RitmoLiveModule';
import * as Haptics from '../haptics';
import {
  EmailCodeKind,
  emailHasCode,
  emailHasCodeCached,
  friendlyError,
  resendSignup,
  resetPassword,
  signIn,
  signInWithLink,
  signUp,
  updatePassword,
  verifyEmailCode,
} from '../sync';
import { font, radius, space, type, useTheme } from '../theme';
import { Press } from './Press';
import { Sheet } from './Sheet';

type Mode = 'signin' | 'signup';
export type AuthStep = 'form' | 'code' | 'newPassword';

const EMAIL_RE = /\S+@\S+\.\S+/;

/**
 * Create an account or sign in. Every email (activation, sign-in link, password
 * reset) carries a link; with MRitmo's own email it also carries a 6-digit
 * code, which works even when the link opens in a browser. Without it (Supabase's
 * default mailer, link only) the app never asks for a code it can't receive.
 * On success the caller restores and backs up data.
 */
export function AuthSheet({
  visible,
  initialMode = 'signup',
  initialStep = 'form',
  initialError = null,
  onClose,
  onSignedIn,
}: {
  visible: boolean;
  initialMode?: Mode;
  /** 'newPassword' when a password-reset link opened the app. */
  initialStep?: AuthStep;
  initialError?: string | null;
  onClose: () => void;
  onSignedIn: () => void;
}) {
  const { c } = useTheme();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<AuthStep>(initialStep);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<EmailCodeKind>('link');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [withCode, setWithCode] = useState(false);

  useEffect(() => {
    if (!visible) return;
    emailHasCodeCached().then(setWithCode);
    emailHasCode().then(setWithCode);
    setMode(initialMode);
    setStep(initialStep);
    setPassword('');
    setCode('');
    setError(initialError);
    setNotice(null);
    setBusy(false);
  }, [visible, initialMode, initialStep, initialError]);

  const emailOk = EMAIL_RE.test(email.trim());
  const [agreed, setAgreed] = useState(false);
  const valid = emailOk && password.length >= 6 && (mode !== 'signup' || agreed);

  const fail = (e: unknown) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setError(friendlyError(e));
  };

  const done = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSignedIn();
    onClose();
  };

  const toCode = (kind: EmailCodeKind, message: string) => {
    setPending(kind);
    setCode('');
    setError(null);
    setNotice(message);
    setStep('code');
  };

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signup') {
        const r = await signUp(email, password);
        if (r === 'confirm') {
          toCode('signup', withCode ? `Te enviamos un enlace y un código a ${email.trim()} para activar tu cuenta.` : `Te enviamos un enlace a ${email.trim()} para activar tu cuenta.`);
          return;
        }
      } else {
        await signIn(email, password);
      }
      done();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const sendLink = async () => {
    if (!emailOk) {
      setError('Escribe tu correo arriba y vuelve a tocar "Entrar sin contraseña".');
      return;
    }
    setBusy(true);
    try {
      await signInWithLink(email);
      toCode('link', withCode ? `Te enviamos un enlace y un código a ${email.trim()}. Toca el enlace desde este teléfono o escribe el código.` : `Te enviamos un enlace a ${email.trim()} para entrar.`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!emailOk) {
      setError('Escribe tu correo arriba y vuelve a tocar "Olvidé mi contraseña".');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email);
      toCode('recovery', withCode ? `Te enviamos un enlace y un código a ${email.trim()} para elegir una contraseña nueva.` : `Te enviamos un enlace a ${email.trim()} para elegir una contraseña nueva.`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (pending === 'recovery') await resetPassword(email);
      else if (pending === 'link') await signInWithLink(email);
      else await resendSignup(email);
      setNotice(withCode ? `Listo, revisa otra vez ${email.trim()}. Usa el código del correo más reciente.` : `Listo, revisa otra vez ${email.trim()}. Abre el enlace del correo más reciente.`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const token = code.replace(/\D/g, '');
    if (token.length < 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmailCode(email, token, pending);
      if (pending === 'recovery') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setPassword('');
        setNotice(null);
        setStep('newPassword');
      } else {
        done();
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    if (password.length < 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      done();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
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

  const passwordField = (placeholder: string, onGo: () => void, isNew: boolean) => (
    <View>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder={placeholder}
        placeholderTextColor={c.textTertiary}
        secureTextEntry={!showPw}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={isNew ? 'new-password' : 'current-password'}
        textContentType={isNew ? 'newPassword' : 'password'}
        returnKeyType="go"
        onSubmitEditing={onGo}
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
  );

  const primary = (label: string, onPress: () => void, enabled: boolean) => (
    <Press
      onPress={onPress}
      disabled={!enabled || busy}
      accessibilityRole="button"
      style={{ marginTop: space.xl, height: 54, borderRadius: radius.pill, backgroundColor: c.ink, opacity: enabled ? 1 : 0.3, alignItems: 'center', justifyContent: 'center' }}
    >
      {busy ? <ActivityIndicator color={c.inkOnInk} /> : <Text style={[type.headline, { color: c.inkOnInk }]}>{label}</Text>}
    </Press>
  );

  const messages = (
    <>
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
    </>
  );

  const textLink = (label: string, onPress: () => void) => (
    <Press onPress={onPress} disabled={busy} style={{ alignSelf: 'center', padding: space.sm, marginTop: space.xs }}>
      <Text style={[type.callout, { color: c.textSecondary }]}>{label}</Text>
    </Press>
  );

  if (step === 'code') {
    const back = () => {
      setStep('form');
      setNotice(null);
      setError(null);
    };

    // Link only (no own email yet): open it from this phone and MRitmo finishes by itself.
    if (!withCode) {
      const canOpenMail = Platform.OS === 'android' && Boolean(RitmoLive?.openEmailApp);
      return (
        <Sheet visible={visible} onClose={onClose}>
          <Text style={[type.title, { color: c.text }]}>Revisa tu correo</Text>
          {messages}
          <View style={{ marginTop: space.lg, gap: space.md }}>
            {[
              ['mail-open-outline', 'Abre el correo desde este teléfono. Llega de Supabase Auth, en inglés.'],
              ['link-outline', pending === 'recovery' ? 'Toca el enlace: MRitmo se abre y te pide la contraseña nueva.' : 'Toca el enlace: MRitmo se abre y entras solo.'],
              ['time-outline', 'Si no llega en unos minutos, revisa spam o promociones.'],
            ].map(([icon, text]) => (
              <View key={icon} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
                <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={c.text} />
                <Text style={[type.callout, { color: c.textSecondary, flex: 1 }]}>{text}</Text>
              </View>
            ))}
          </View>
          {canOpenMail ? primary('Abrir el correo', () => {
            try {
              RitmoLive?.openEmailApp();
            } catch {
              setError('No encontramos una app de correo. Ábrelo como siempre.');
            }
          }, true) : null}
          {textLink('Reenviar correo', resend)}
          {textLink('Usar otro correo', back)}
        </Sheet>
      );
    }

    const digits = code.replace(/\D/g, '');
    return (
      <Sheet visible={visible} onClose={onClose}>
        <Text style={[type.title, { color: c.text }]}>Revisa tu correo</Text>
        {messages}
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 8))}
          placeholder="Código de 6 dígitos"
          placeholderTextColor={c.textTertiary}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={8}
          returnKeyType="go"
          onSubmitEditing={verify}
          accessibilityLabel="Código del correo"
          selectionColor={c.ink}
          cursorColor={c.ink}
          style={[input, { marginTop: space.lg, textAlign: 'center', fontFamily: font.semibold, fontSize: digits ? 26 : 17, letterSpacing: digits ? 6 : -0.2 }]}
        />
        {primary(pending === 'recovery' ? 'Continuar' : 'Entrar', verify, digits.length >= 6)}
        {textLink('Reenviar correo', resend)}
        {textLink('Usar otro correo', back)}
      </Sheet>
    );
  }

  if (step === 'newPassword') {
    return (
      <Sheet visible={visible} onClose={onClose}>
        <Text style={[type.title, { color: c.text }]}>Nueva contraseña</Text>
        <Text style={[type.callout, { color: c.textSecondary, marginTop: space.xs }]}>
          Elige la contraseña con la que vas a entrar desde ahora. Tus datos siguen intactos.
        </Text>
        <View style={{ marginTop: space.xl }}>{passwordField('Contraseña nueva (mínimo 6)', savePassword, true)}</View>
        {messages}
        {primary('Guardar contraseña', savePassword, password.length >= 6)}
      </Sheet>
    );
  }

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
        {passwordField(mode === 'signup' ? 'Contraseña (mínimo 6)' : 'Contraseña', submit, mode === 'signup')}
      </View>

      {mode === 'signup' && (
        <Press
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setAgreed(!agreed);
          }}
          scaleTo={0.99}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          accessibilityLabel="Acepto los Términos y autorizo el tratamiento de mis datos según la Política de privacidad"
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginTop: space.lg }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              borderWidth: agreed ? 0 : 1.6,
              borderColor: c.textTertiary,
              backgroundColor: agreed ? c.ink : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 1,
            }}
          >
            {agreed && <Ionicons name="checkmark" size={16} color={c.inkOnInk} />}
          </View>
          <Text style={[type.footnote, { color: c.textSecondary, flex: 1 }]}>
            Acepto los{' '}
            <Text style={{ color: c.text, textDecorationLine: 'underline' }} onPress={() => Linking.openURL('https://mritmo.com/terminos/').catch(() => {})} accessibilityRole="link">
              Términos
            </Text>{' '}
            y autorizo el tratamiento de mis datos según la{' '}
            <Text style={{ color: c.text, textDecorationLine: 'underline' }} onPress={() => Linking.openURL('https://mritmo.com/privacidad/').catch(() => {})} accessibilityRole="link">
              Política de privacidad
            </Text>
            . Si eres menor de 18, necesitas el permiso de tu padre, madre o acudiente.
          </Text>
        </Press>
      )}

      {messages}

      {primary(mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión', submit, valid)}

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
          {textLink('Olvidé mi contraseña', forgot)}
        </>
      )}
    </Sheet>
  );
}
