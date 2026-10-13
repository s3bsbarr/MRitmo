import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../haptics';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../avatar/Avatar';
import { Press } from '../components/Press';
import { TimeField } from '../components/TimeField';
import RitmoLive, { type LiveDiagnosis } from '../../modules/ritmo-live/src/RitmoLiveModule';
import { hhmmLabel } from '../format';
import type { Gender, Settings as SettingsT, ThemePref } from '../data';
import { requestNotificationPermission } from '../effects';
import { font, radius, space, type, useTheme } from '../theme';
import * as Notifications from 'expo-notifications';

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
        ]
    : [];

  return (
    <Section
      title="Temporizador en vivo"
      note="Con un foco en curso, el temporizador debe aparecer en la barra de estado y en la Now Bar. Si dice “No” en Promovido, envía una captura de esta sección."
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
          <Text style={[type.body, { color: c.text, flex: 1 }]}>Ajustes de Live Updates de Ritmo</Text>
          <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
        </Press>
      </View>
    </Section>
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

export function SettingsScreen({ settings, update, onClose, account, onAuth, onSignOut, onSyncNow }: Props) {
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
    if (ok) update({}); // re-applies reminders now that they can be shown
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
              ? account.error ?? `Respaldo ${account.syncing ? 'en curso…' : ago(account.lastSync)}. Se respalda solo después de cada cambio.`
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
              <Press onPress={onSignOut} scaleTo={0.99} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space.lg, gap: space.md }}>
                <Ionicons name="log-out-outline" size={20} color={c.danger} />
                <Text style={[type.body, { color: c.danger }]}>Cerrar sesión</Text>
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

        <Section title="Apariencia">
          <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: radius.md, padding: 4 }} accessibilityRole="radiogroup">
            {themes.map((t) => {
              const active = settings.theme === t.key;
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
        </Section>

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
            <ToggleRow label="Descanso" detail="15 min después de cerrar un día al 100 %" value={settings.remindRest} onChange={(v) => update({ remindRest: v })} last />
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
              <Text style={[type.body, { color: c.text }]}>Mantén presionado un espacio vacío de tu pantalla de inicio, toca Widgets y busca Ritmo.</Text>
              <Text style={[type.footnote, { color: c.textSecondary }]}>
                Estado: tu personaje y el avance del día. Pequeño muestra solo al personaje; ancho añade el porcentaje.{'\n'}
                Foco: inicia tu próxima tarea, pausa o márcala como hecha sin abrir la app.
              </Text>
            </View>
          </Section>
        )}

        <Text style={[type.caption, { color: c.textTertiary, textAlign: 'center', marginTop: space.xxxl }]}>Ritmo 1.4</Text>
      </ScrollView>
    </View>
  );
}
