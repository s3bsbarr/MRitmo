import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../avatar/Avatar';
import { Press } from '../components/Press';
import { TimeField } from '../components/TimeField';
import { hhmmLabel } from '../format';
import type { Gender, Settings as SettingsT, ThemePref } from '../data';
import { requestNotificationPermission } from '../effects';
import { font, radius, space, type, useTheme } from '../theme';
import * as Notifications from 'expo-notifications';

type Props = {
  settings: SettingsT;
  update: (patch: Partial<SettingsT>) => void;
  onClose: () => void;
};

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

export function SettingsScreen({ settings, update, onClose }: Props) {
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

        <Text style={[type.caption, { color: c.textTertiary, textAlign: 'center', marginTop: space.xxxl }]}>Ritmo 1.2</Text>
      </ScrollView>
    </View>
  );
}
