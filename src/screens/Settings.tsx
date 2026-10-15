import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../avatar/Avatar';
import { Press } from '../components/Press';
import { TimeField } from '../components/TimeField';
import RitmoLive, { type LiveDiagnosis } from '../../modules/ritmo-live/src/RitmoLiveModule';
import { hhmmLabel } from '../format';
import type { DarkTone, Gender, LightTone, Settings as SettingsT, ThemePref } from '../data';
import { requestNotificationPermission } from '../effects';
import { font, radius, space, type, useTheme } from '../theme';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { PushStatus, pushStatusLabel } from '../push';
import { BlockedPerson, loadBlocked, loadHideProgress, setHideProgress, unblockUser } from '../privacy';
import { currentVersion, UpdateInfo } from '../update';
import { openDownload, openNews } from '../components/UpdateBanner';

export type AccountInfo = {
  email: string | null;
  lastSync?: number;
  syncing: boolean;
  error?: string | null;
};

type Props = {
  settings: SettingsT;
  update: (patch: Partial<SettingsT>) => void;
  onClose: () => void;
  account: AccountInfo;
  onAuth: (mode: 'signup' | 'signin') => void;
  onSignOut: () => void;
  onSyncNow: () => void;
  push: PushStatus;
  onPushRetry: () => void;
  /** Opens "¿Eliminar tu cuenta?" (1.9). */
  onDeleteAccount: () => void;
  /** Newest version on mritmo.com (1.9). */
  release: UpdateInfo | null;
  onCheckUpdate: () => Promise<void>;
  /** Blocking or unblocking changed who's on the boards. */
  onPrivacyChanged?: () => void;
};

function ago(ms?: number) {
  if (!ms) return 'aún no';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'hace un momento';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ marginTop: space.xxl }}>
      <Text style={[type.headline, { color: c.text, marginBottom: space.md }]}>{title}</Text>
      {children}
      {note ? <Text style={[type.footnote, { color: c.textTertiary, marginTop: space.sm }]}>{note}</Text> : null}
    </View>
  );
}

/** A reminder with an on/off switch and a time you can open and edit in place. */
function TimedToggle({ label, detail, on, time, onToggle, onTime }: { label: string; detail: string; on: boolean; time: string; onToggle: (v: boolean) => void; onTime: (t: string) => void }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: c.separator, marginLeft: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingRight: space.md }}>
        <View style={{ flex: 1, paddingVertical: space.sm }}>
          <Text style={[type.body, { color: c.text }]}>{label}</Text>
          <Press onPress={() => setOpen(!open)} disabled={!on} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`Cambiar hora de ${label}`} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 }}>
            <Text style={[type.footnote, { color: on ? c.text : c.textTertiary, fontFamily: 'Inter_600SemiBold', textDecorationLine: on ? 'underline' : 'none' }]}>{hhmmLabel(time)}</Text>
            <Text style={[type.footnote, { color: c.textSecondary }]}>· {detail}</Text>
          </Press>
        </View>
        <Switch
          value={on}
          onValueChange={(v) => {
            Haptics.selectionAsync().catch(() => {});
            onToggle(v);
            if (!v) setOpen(false);
          }}
          accessibilityLabel={label}
          trackColor={{ false: c.track, true: c.ink }}
          thumbColor={Platform.OS === 'android' ? c.bg : undefined}
          ios_backgroundColor={c.track}
        />
      </View>
      {open && on && (
        <View style={{ paddingRight: space.md, paddingBottom: space.md }}>
          <TimeField value={time} onChange={onTime} />
        </View>
      )}
    </View>
  );
}

/** Shows what Android decided about the focus timer and links to the per-app Live Updates switch. */
function LiveSection() {
  const { c } = useTheme();
  const [d, setD] = useState<LiveDiagnosis | null>(null);
  const refresh = () => {
    try {
      setD(RitmoLive?.diagnose() ?? null);
    } catch {
      setD(null);
    }
  };
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);

  const yes = (v: boolean | null | undefined, ok: string, no: string, unknown = '—') => (v === null || v === undefined ? unknown : v ? ok : no);
  const rows: [string, string][] = d
    ? d.sdk < 36
      ? [['Android', `Versión ${d.sdk}: no tiene Live Updates`]]
      : [
          ['Permitido por el sistema', yes(d.canPost, 'Sí', 'No: actívalo abajo')],
          ['Temporizador visible', d.active ? 'Sí' : 'No hay foco en curso'],
          ['Cumple los requisitos', yes(d.promotable, 'Sí', 'No', d.active ? '—' : 'Inicia un foco')],
          ['Promovido a Live Update', d.active ? yes(d.promoted, 'Sí', 'No') : '—'],
          [
            'Plantilla',
            !d.active
              ? d.sdk >= 37
                ? 'Números grandes (Android 17)'
                : 'Barra de progreso (Android 16)'
              : d.style === 'metric'
                ? 'Números grandes'
                : d.style === 'progress'
                  ? d.sdk >= 37
                    ? 'Barra (falló la de números)'
                    : 'Barra de progreso'
                  : 'Estándar',
          ],
        ]
    : [];

  return (
    <Section
      title="Temporizador en vivo"
      note="Con un foco en curso, el temporizador debe aparecer en la barra de estado y en la Now Bar. En Android 17 (One UI 9) se expande con la cuenta regresiva en grande; al tocarlo se abre a pantalla completa. Si dice “No” en Promovido, envía una captura de esta sección."
    >
      <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
        {rows.map(([label, value], i) => (
          <View
            key={label}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              minHeight: 48,
              marginLeft: space.lg,
              paddingRight: space.lg,
              borderBottomWidth: 1,
              borderBottomColor: c.separator,
            }}
          >
            <Text style={[type.callout, { color: c.text }]}>{label}</Text>
            <Text style={[type.callout, { color: c.textSecondary, flexShrink: 1, textAlign: 'right', marginLeft: space.md }]}>{value}</Text>
          </View>
        ))}
        <Press
          onPress={() => {
            try {
              RitmoLive?.openPromotionSettings();
            } catch {}
          }}
          scaleTo={0.99}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space.lg, gap: space.md }}
        >
          <Ionicons name="radio-outline" size={20} color={c.text} />
          <Text style={[type.body, { color: c.text, flex: 1 }]}>Ajustes de Live Updates de MRitmo</Text>
          <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
        </Press>
      </View>
    </Section>
  );
}

type ToneOption = { key: string; label: string; bg: string; surface: string; ink: string };

/**
 * Which white and which black (1.9.1): two small previews per mode. The choice
 * applies whenever that mode is on, also when the mode follows the system.
 */
function ToneRow({ title, value, options, onChange }: { title: string; value: string; options: ToneOption[]; onChange: (k: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ marginTop: space.lg }}>
      <Text style={[type.footnote, { color: c.textSecondary, marginBottom: space.sm }]}>{title}</Text>
      <View style={{ flexDirection: 'row', gap: space.md }} accessibilityRole="radiogroup" accessibilityLabel={title}>
        {options.map((o) => {
          const active = value === o.key;
          return (
            <Press
              key={o.key}
              onPress={() => {
                if (active) return;
                Haptics.selectionAsync().catch(() => {});
                onChange(o.key);
              }}
              scaleTo={0.97}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${title}: ${o.label}`}
              style={{ flex: 1, borderRadius: radius.lg, borderWidth: 2, borderColor: active ? c.ink : c.separator, padding: 4 }}
            >
              <View style={{ height: 64, borderRadius: radius.md, backgroundColor: o.bg, padding: 10, justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(128,128,128,0.18)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: o.ink }} />
                  <View style={{ width: 38, height: 6, borderRadius: 3, backgroundColor: o.ink, opacity: 0.85 }} />
                </View>
                <View style={{ height: 14, borderRadius: 5, backgroundColor: o.surface, justifyContent: 'center', paddingHorizontal: 5 }}>
                  <View style={{ width: '55%', height: 4, borderRadius: 2, backgroundColor: o.ink, opacity: 0.6 }} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 }}>
                <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={active ? c.ink : c.textTertiary} />
                <Text style={[type.callout, { color: active ? c.text : c.textSecondary }]}>{o.label}</Text>
              </View>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

function ToggleRow({ label, detail, value, onChange, last }: { label: string; detail: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 60,
        marginLeft: space.lg,
        paddingRight: space.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.separator,
      }}
    >
      <View style={{ flex: 1, paddingVertical: space.sm }}>
        <Text style={[type.body, { color: c.text }]}>{label}</Text>
        <Text style={[type.footnote, { color: c.textSecondary }]}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          Haptics.selectionAsync().catch(() => {});
          onChange(v);
        }}
        accessibilityLabel={label}
        trackColor={{ false: c.track, true: c.ink }}
        thumbColor={Platform.OS === 'android' ? c.bg : undefined}
        ios_backgroundColor={c.track}
      />
    </View>
  );
}

/** Ocultar mi avance and Bloqueados (1.9). Loads on its own; needs an account with a username. */
function PrivacySection({ signedIn, onChanged }: { signedIn: boolean; onChanged?: () => void }) {
  const { c } = useTheme();
  const [hide, setHide] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState<BlockedPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    Promise.all([loadHideProgress(), loadBlocked()])
      .then(([h, b]) => {
        if (!live) return;
        setHide(h);
        setBlocked(b);
        setError(null);
      })
      .catch((e) => live && setError((e as Error).message))
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [signedIn]);

  if (!signedIn) return null;

  const toggle = async (v: boolean) => {
    const before = hide;
    setHide(v);
    try {
      await setHideProgress(v);
      setError(null);
      onChanged?.();
    } catch (e) {
      setHide(before);
      setError((e as Error).message);
    }
  };

  const unblock = async (p: BlockedPerson) => {
    Haptics.selectionAsync().catch(() => {});
    try {
      await unblockUser(p.id);
      setBlocked((prev) => (prev ?? []).filter((x) => x.id !== p.id));
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const noProfile = loaded && hide === null && !error;
  return (
    <Section
      title="Privacidad"
      note={
        error ??
        (noProfile
          ? 'Elige tu @usuario en la pestaña Amigos para usar estos controles.'
          : 'Para bloquear a alguien, tócalo en el ranking de Amigos (o mantén presionada su solicitud) y elige Bloquear. No le avisamos.')
      }
    >
      <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
        <ToggleRow
          label="Ocultar mi avance"
          detail={hide ? 'Tus amigos y salas te ven sin % ni minutos' : 'Tus amigos y salas ven tu % y tus minutos'}
          value={Boolean(hide)}
          onChange={toggle}
          last={!blocked || blocked.length === 0}
        />
        {blocked && blocked.length > 0 && (
          <>
            <Text style={[type.footnote, { color: c.textSecondary, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs }]}>Bloqueados</Text>
            {blocked.map((p, i) => (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: 56,
                  marginLeft: space.lg,
                  paddingRight: space.md,
                  gap: space.md,
                  borderBottomWidth: i === blocked.length - 1 ? 0 : 1,
                  borderBottomColor: c.separator,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: c.text }]} numberOfLines={1}>{p.display_name || `@${p.username}`}</Text>
                  <Text style={[type.footnote, { color: c.textSecondary }]}>@{p.username}</Text>
                </View>
                <Press
                  onPress={() => unblock(p)}
                  accessibilityRole="button"
                  accessibilityLabel={`Desbloquear a @${p.username}`}
                  style={{ height: 34, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: c.bg, justifyContent: 'center' }}
                >
                  <Text style={[type.footnote, { color: c.text, fontFamily: font.semibold }]}>Desbloquear</Text>
                </Press>
              </View>
            ))}
          </>
        )}
      </View>
    </Section>
  );
}

/** "Tienes la última versión" or "MRitmo X está disponible" (1.9). */
function UpdateSection({ update, onCheck }: { update: UpdateInfo | null; onCheck: () => Promise<void> }) {
  const { c } = useTheme();
  const [checking, setChecking] = useState(false);
  const r = update?.release;
  const check = async () => {
    setChecking(true);
    await onCheck().catch(() => {});
    setChecking(false);
  };
  const mb = r?.bytes ? ` · ${Math.round(r.bytes / 1048576)} MB` : '';
  return (
    <Section
      title="Versión"
      note={update?.available ? 'Se descarga desde mritmo.com y se instala encima de esta: no pierdes nada.' : 'MRitmo revisa mritmo.com cada pocas horas. Si hay una versión nueva, te la muestra en Hoy.'}
    >
      <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingHorizontal: space.lg, gap: space.md, borderBottomWidth: 1, borderBottomColor: c.separator }}>
          <Ionicons name={update?.available ? 'arrow-down-circle-outline' : 'checkmark-circle-outline'} size={22} color={c.text} />
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { color: c.text }]}>{update?.available && r ? `MRitmo ${r.version} está disponible` : `MRitmo ${currentVersion()}`}</Text>
            <Text style={[type.footnote, { color: c.textSecondary }]}>
              {update?.available && r ? (r.title ?? 'Hay una versión nueva') : update?.release ? 'Tienes la última versión' : 'Aún no se ha revisado'}
            </Text>
          </View>
          {update?.available ? (
            <Press
              onPress={openDownload}
              accessibilityRole="button"
              style={{ height: 36, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: c.ink, justifyContent: 'center' }}
            >
              <Text style={[type.callout, { color: c.inkOnInk, fontFamily: font.semibold }]}>Descargar{mb}</Text>
            </Press>
          ) : (
            <Press onPress={check} disabled={checking} accessibilityRole="button" style={{ height: 36, paddingHorizontal: space.md, justifyContent: 'center' }}>
              {checking ? <ActivityIndicator color={c.textSecondary} /> : <Text style={[type.callout, { color: c.text }]}>Buscar</Text>}
            </Press>
          )}
        </View>
        <Press onPress={() => openNews(update?.available ? r : null)} scaleTo={0.99} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space.lg, gap: space.md }}>
          <Ionicons name="sparkles-outline" size={20} color={c.text} />
          <Text style={[type.body, { color: c.text, flex: 1 }]}>Novedades de cada versión</Text>
          <Ionicons name="open-outline" size={18} color={c.textTertiary} />
        </Press>
        <Press
          onPress={() => Linking.openURL('https://mritmo.com/ayuda/').catch(() => {})}
          scaleTo={0.99}
          accessibilityRole="link"
          style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space.lg, gap: space.md, borderTopWidth: 1, borderTopColor: c.separator }}
        >
          <Ionicons name="help-circle-outline" size={20} color={c.text} />
          <Text style={[type.body, { color: c.text, flex: 1 }]}>Ayuda</Text>
          <Ionicons name="open-outline" size={18} color={c.textTertiary} />
        </Press>
      </View>
    </Section>
  );
}

export function SettingsScreen({
  settings,
  update,
  onClose,
  account,
  onAuth,
  onSignOut,
  onSyncNow,
  push,
  onPushRetry,
  onDeleteAccount,
  release,
  onCheckUpdate,
  onPrivacyChanged,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(settings.name);
  const [notifState, setNotifState] = useState<'granted' | 'ask' | 'blocked'>('ask');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.getPermissionsAsync()
      .then((p) => setNotifState(p.granted ? 'granted' : p.canAskAgain ? 'ask' : 'blocked'))
      .catch(() => {});
  }, []);

  const enableNotifications = async () => {
    if (notifState === 'blocked') {
      Linking.openSettings().catch(() => {});
      return;
    }
    const ok = await requestNotificationPermission();
    setNotifState(ok ? 'granted' : 'blocked');
    if (ok) {
      update({}); // re-applies reminders now that they can be shown
      onPushRetry();
    }
  };

  const themes: { key: ThemePref; label: string }[] = [
    { key: 'system', label: 'Sistema' },
    { key: 'light', label: 'Claro' },
    { key: 'dark', label: 'Oscuro' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.md }}>
        <Press
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Volver a Resumen"
          style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', height: 44, paddingRight: space.md }}
        >
          <Ionicons name="chevron-back" size={24} color={c.text} />
          <Text style={[type.body, { color: c.text }]}>Resumen</Text>
        </Press>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.xxxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[type.largeTitle, { color: c.text, marginTop: space.sm }]} accessibilityRole="header">
          Configuración
        </Text>

        <Section
          title="Cuenta"
          note={
            account.email
              ? account.error
                ? /sin conexión/i.test(account.error)
                  ? `Sin conexión. Tus cambios quedan en este teléfono y se respaldan solos al volver la conexión. Último respaldo: ${ago(account.lastSync)}.`
                  : account.error
                : `Respaldo ${account.syncing ? 'en curso…' : ago(account.lastSync)}. Se respalda solo después de cada cambio.`
              : 'Sin cuenta, tus datos viven solo en este teléfono. Con cuenta, al reinstalar o cambiar de teléfono vuelve todo.'
          }
        >
          {account.email ? (
            <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingHorizontal: space.lg, gap: space.md, borderBottomWidth: 1, borderBottomColor: c.separator }}>
                <Ionicons name="person-circle-outline" size={26} color={c.text} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: c.text }]} numberOfLines={1}>{account.email}</Text>
                  <Text style={[type.footnote, { color: c.textSecondary }]}>Sesión iniciada</Text>
                </View>
              </View>
              <Press onPress={onSyncNow} disabled={account.syncing} scaleTo={0.99} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space.lg, gap: space.md, borderBottomWidth: 1, borderBottomColor: c.separator }}>
                <Ionicons name="cloud-upload-outline" size={20} color={c.text} />
                <Text style={[type.body, { color: c.text, flex: 1 }]}>{account.syncing ? 'Respaldando…' : 'Respaldar ahora'}</Text>
              </Press>
              <Press onPress={onSignOut} scaleTo={0.99} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space.lg, gap: space.md, borderBottomWidth: 1, borderBottomColor: c.separator }}>
                <Ionicons name="log-out-outline" size={20} color={c.text} />
                <Text style={[type.body, { color: c.text }]}>Cerrar sesión</Text>
              </Press>
              <Press onPress={onDeleteAccount} scaleTo={0.99} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space.lg, gap: space.md }}>
                <Ionicons name="trash-outline" size={20} color={c.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: c.danger }]}>Eliminar cuenta</Text>
                  <Text style={[type.footnote, { color: c.textSecondary }]}>Borra tu cuenta y tus datos del servidor</Text>
                </View>
              </Press>
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              <Press onPress={() => onAuth('signup')} accessibilityRole="button" style={{ height: 52, borderRadius: radius.pill, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[type.headline, { color: c.inkOnInk }]}>Crear cuenta</Text>
              </Press>
              <Press onPress={() => onAuth('signin')} accessibilityRole="button" style={{ height: 52, borderRadius: radius.pill, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[type.headline, { color: c.text }]}>Ya tengo cuenta</Text>
              </Press>
            </View>
          )}
        </Section>

        <Section title="Tu nombre" note="Aparece en los recordatorios y cuando compartes tu día.">
          <TextInput
            value={name}
            onChangeText={setName}
            onEndEditing={() => update({ name: name.trim() })}
            onSubmitEditing={() => update({ name: name.trim() })}
            placeholder="¿Cómo te llamas?"
            placeholderTextColor={c.textTertiary}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="givenName"
            returnKeyType="done"
            maxLength={40}
            selectionColor={c.ink}
            cursorColor={c.ink}
            style={{
              fontFamily: font.regular,
              fontSize: 17,
              letterSpacing: -0.2,
              color: c.text,
              backgroundColor: c.surface,
              borderRadius: radius.md,
              paddingHorizontal: space.lg,
              paddingVertical: 14,
            }}
          />
        </Section>

        <Section title="Personaje" note="Duerme hasta que avanzas, se sienta al empezar, se pone de pie al pasar la mitad y celebra al completar el día.">
          <View style={{ flexDirection: 'row', gap: space.md }} accessibilityRole="radiogroup">
            {(
              [
                ['m', 'Hombre'],
                ['f', 'Mujer'],
              ] as [Gender, string][]
            ).map(([g, label]) => {
              const active = settings.gender === g;
              return (
                <Press
                  key={g}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    update({ gender: g });
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={label}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingTop: space.lg,
                    paddingBottom: space.md,
                    borderRadius: radius.lg,
                    backgroundColor: c.surface,
                    borderWidth: 1.5,
                    borderColor: active ? c.ink : 'transparent',
                  }}
                >
                  <Avatar gender={g} mood="foco" px={3} />
                  <Text style={[type.callout, { color: active ? c.text : c.textSecondary, marginTop: space.sm }]}>{label}</Text>
                </Press>
              );
            })}
          </View>
        </Section>

        <Section title="Apariencia" note="Cada modo tiene dos tonos. Con Sistema, se usa el tono del claro cuando el teléfono está en modo claro y el del oscuro cuando está en oscuro. Los widgets también.">
          <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: radius.md, padding: 4 }} accessibilityRole="radiogroup">
            {themes.map((t) => {
              const active = (settings.theme === 'cream' ? 'light' : settings.theme) === t.key;
              return (
                <Press
                  key={t.key}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    update({ theme: t.key });
                  }}
                  scaleTo={0.96}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: radius.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? c.bg : 'transparent',
                    shadowColor: '#000',
                    shadowOpacity: active ? 0.08 : 0,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: active ? 2 : 0,
                  }}
                >
                  <Text style={[type.callout, { color: active ? c.text : c.textSecondary }]}>{t.label}</Text>
                </Press>
              );
            })}
          </View>
          <ToneRow
            title="Modo claro"
            value={settings.theme === 'cream' ? 'cream' : settings.lightTone}
            options={[
              { key: 'white', label: 'Blanco', bg: '#FFFFFF', surface: '#F4F4F6', ink: '#0A0A0B' },
              { key: 'cream', label: 'Crema', bg: '#F7F3EA', surface: '#ECE6DA', ink: '#18160F' },
            ]}
            onChange={(k) => update({ lightTone: k as LightTone, ...(settings.theme === 'cream' ? { theme: 'light' as const } : {}) })}
          />
          <ToneRow
            title="Modo oscuro"
            value={settings.darkTone}
            options={[
              { key: 'black', label: 'Negro', bg: '#000000', surface: '#1C1C1F', ink: '#F5F5F7' },
              { key: 'tinto', label: 'Tinto', bg: '#15120E', surface: '#2B261F', ink: '#F3ECDF' },
            ]}
            onChange={(k) => update({ darkTone: k as DarkTone })}
          />
        </Section>

        <PrivacySection signedIn={Boolean(account.email)} onChanged={onPrivacyChanged} />

        <Section
          title="Notificaciones"
          note={
            notifState === 'granted'
              ? 'Cuando un bloque de foco termina siempre suena un aviso, con botones para sumar tiempo o terminar. Toca una hora para cambiarla.'
              : 'Sin permiso no podemos avisarte cuando termina un bloque ni recordarte planear tu día.'
          }
        >
          {notifState !== 'granted' && Platform.OS !== 'web' && (
            <Press
              onPress={enableNotifications}
              accessibilityRole="button"
              style={{ height: 50, borderRadius: radius.pill, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', marginBottom: space.md }}
            >
              <Text style={[type.headline, { color: c.inkOnInk }]}>
                {notifState === 'blocked' ? 'Activar en ajustes del teléfono' : 'Activar notificaciones'}
              </Text>
            </Press>
          )}
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
            <TimedToggle label="Motivación" detail="Un mensaje para empezar" on={settings.remindMotivation} time={settings.motivationTime}
              onToggle={(v) => update({ remindMotivation: v })} onTime={(t) => update({ motivationTime: t })} />
            <TimedToggle label="Planear el día" detail="Tus tareas del día" on={settings.remindMorning} time={settings.planTime}
              onToggle={(v) => update({ remindMorning: v })} onTime={(t) => update({ planTime: t })} />
            <TimedToggle label="Cerrar el día" detail="Lo pendiente y tus hábitos" on={settings.remindEvening} time={settings.closeTime}
              onToggle={(v) => update({ remindEvening: v })} onTime={(t) => update({ closeTime: t })} />
            <ToggleRow label="Día libre" detail="A las 10:00 a. m. si no tienes tareas" value={settings.remindFreeDay} onChange={(v) => update({ remindFreeDay: v })} />
            <ToggleRow label="Tarea sin empezar" detail="5 minutos después de su hora" value={settings.remindOverdue} onChange={(v) => update({ remindOverdue: v })} />
            <ToggleRow label="Descanso" detail="15 min después de cerrar un día al 100 %" value={settings.remindRest} onChange={(v) => update({ remindRest: v })} />
            <ToggleRow
              label="Amigos"
              detail={settings.remindFriends ? pushStatusLabel(push) : 'Apagadas: no te avisamos de solicitudes'}
              value={settings.remindFriends}
              onChange={(v) => update({ remindFriends: v })}
            />
            <ToggleRow
              label="Hábitos juntos"
              detail={settings.remindShared ? pushStatusLabel(push, 'habits') : 'Apagadas: no te avisamos de invitaciones ni marcas'}
              value={settings.remindShared}
              onChange={(v) => update({ remindShared: v })}
              last
            />
          </View>
          <Text style={[type.callout, { color: c.text, marginTop: space.xl, marginBottom: space.sm }]}>Aviso antes de una tarea programada</Text>
          <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: radius.md, padding: 4 }} accessibilityRole="radiogroup">
            {[0, 5, 10, 15].map((m) => {
              const active = settings.taskLead === m;
              return (
                <Press
                  key={m}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    update({ taskLead: m });
                  }}
                  scaleTo={0.96}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={{ flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.bg : 'transparent' }}
                >
                  <Text style={[type.callout, { color: active ? c.text : c.textSecondary }]}>{m === 0 ? 'No' : `${m} min`}</Text>
                </Press>
              );
            })}
          </View>
        </Section>

        {Platform.OS === 'android' && RitmoLive && <LiveSection />}

        {Platform.OS === 'android' && (
          <Section title="Widgets">
            <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
              <Text style={[type.body, { color: c.text }]}>Mantén presionado un espacio vacío de tu pantalla de inicio, toca Widgets y busca MRitmo.</Text>
              <Text style={[type.footnote, { color: c.textSecondary }]}>
                Estado: tu personaje y el avance del día. Pequeño muestra solo al personaje; ancho añade el porcentaje.{'\n'}
                Foco: inicia tu próxima tarea, pausa o márcala como hecha sin abrir la app.
              </Text>
            </View>
          </Section>
        )}

        <UpdateSection update={release} onCheck={onCheckUpdate} />

        <Text style={[type.caption, { color: c.textTertiary, textAlign: 'center', marginTop: space.xxxl }]}>
          MRitmo {Constants.expoConfig?.version ?? ''}
        </Text>
      </ScrollView>
    </View>
  );
}
