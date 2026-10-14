import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { dayKey } from '../data';
import * as Haptics from '../haptics';
import { friendName, markedBy, SharedFriend, SharedHabit, sharedStreak } from '../shared';
import { font, radius, space, type, useTheme } from '../theme';
import { Press } from './Press';
import { CheckRow } from './TaskRow';

const IDEAS = ['Leer 20 min', 'Entrenar', 'Meditar 10 min', 'Dormir antes de las 11'];

type Props = {
  friend: SharedFriend;
  /** Every shared habit with this friend: active and pending, both ways. */
  habits: SharedHabit[];
  onToggle: (id: string) => void;
  onInvite: (title: string) => Promise<void>;
  onAccept: (id: string) => Promise<void>;
  /** Decline, cancel or leave (asks first for an active one). */
  onRemove: (h: SharedHabit) => void;
};

/**
 * "Hábitos juntos" on a friend's sheet: what you keep together with its shared
 * streak and today's marks, invitations both ways, and "Crear hábito juntos".
 */
export function SharedHabits({ friend, habits, onToggle, onInvite, onAccept, onRemove }: Props) {
  const { c } = useTheme();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const today = dayKey();
  const who = friendName(friend);

  // Opening another friend's sheet starts clean.
  useEffect(() => {
    setCreating(false);
    setTitle('');
    setError(null);
    setSent(null);
  }, [friend.id]);

  const active = habits.filter((h) => h.status === 'active');
  const incoming = habits.filter((h) => h.status === 'pending' && !h.mine);
  const outgoing = habits.filter((h) => h.status === 'pending' && h.mine);

  const act = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      await fn();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const invite = () =>
    title.trim() &&
    act('invite', async () => {
      await onInvite(title);
      setSent(`Invitación enviada. Cuando ${who} acepte, aparece en el Hoy de los dos.`);
      setTitle('');
      setCreating(false);
    });

  const card = { backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' as const };

  return (
    <View style={{ marginTop: space.xl }}>
      <Text style={[type.headline, { color: c.text, marginBottom: space.md }]}>Hábitos juntos</Text>

      {incoming.map((h) => (
        <View key={h.id} style={[card, { padding: space.lg, marginBottom: space.md }]}>
          <Text style={[type.footnote, { color: c.textSecondary }]}>{who} te invita</Text>
          <Text style={[type.body, { color: c.text, fontFamily: font.semibold, marginTop: 2 }]} numberOfLines={2}>
            {h.title}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            <Press
              onPress={() => act(h.id, () => onAccept(h.id))}
              accessibilityRole="button"
              accessibilityLabel={`Aceptar ${h.title} con ${who}`}
              style={{ flex: 1, height: 44, borderRadius: radius.pill, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}
            >
              {busy === h.id ? <ActivityIndicator color={c.inkOnInk} /> : <Text style={[type.callout, { color: c.inkOnInk, fontFamily: font.semibold }]}>Aceptar</Text>}
            </Press>
            <Press
              onPress={() => onRemove(h)}
              accessibilityRole="button"
              accessibilityLabel={`Rechazar ${h.title}`}
              style={{ height: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={[type.callout, { color: c.text }]}>Rechazar</Text>
            </Press>
          </View>
        </View>
      ))}

      {active.length > 0 && (
        <View style={[card, { marginBottom: space.md }]}>
          {active.map((h, i) => {
            const m = markedBy(h, today);
            const streak = sharedStreak(h, today);
            return (
              <CheckRow
                key={h.id}
                square
                checked={m.me}
                title={h.title}
                meta={`Tú ${m.me ? 'marcaste' : 'no has marcado'} · ${who} ${m.them ? 'marcó' : 'no ha marcado'}`}
                last={i === active.length - 1}
                checkLabel={m.me ? `Desmarcar ${h.title}` : `Marcar ${h.title} como hecho hoy`}
                onToggle={() => onToggle(h.id)}
                onLongPress={() => onRemove(h)}
                right={
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: space.md, opacity: streak === 0 && !(m.me && m.them) ? 0.45 : 1 }}
                    accessible
                    accessibilityLabel={`Racha compartida de ${streak} ${streak === 1 ? 'día' : 'días'}`}
                  >
                    <Ionicons name={m.me && m.them ? 'flame' : 'flame-outline'} size={18} color={c.text} />
                    <Text style={[type.callout, { color: c.text, fontVariant: ['tabular-nums'], fontFamily: font.semibold }]}>{streak}</Text>
                  </View>
                }
              />
            );
          })}
        </View>
      )}

      {outgoing.map((h) => (
        <View
          key={h.id}
          style={[card, { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingLeft: space.lg, marginBottom: space.md }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { color: c.text }]} numberOfLines={1}>
              {h.title}
            </Text>
            <Text style={[type.footnote, { color: c.textSecondary }]}>Esperando a {who}</Text>
          </View>
          <Press onPress={() => onRemove(h)} accessibilityRole="button" accessibilityLabel={`Cancelar invitación ${h.title}`} style={{ padding: space.md }}>
            <Text style={[type.callout, { color: c.textSecondary }]}>Cancelar</Text>
          </Press>
        </View>
      ))}

      {creating ? (
        <View style={[card, { padding: space.lg }]}>
          <TextInput
            value={title}
            onChangeText={(t) => setTitle(t.slice(0, 60))}
            placeholder="Qué van a hacer cada día"
            placeholderTextColor={c.textTertiary}
            autoFocus
            returnKeyType="send"
            onSubmitEditing={invite}
            maxLength={60}
            accessibilityLabel="Nombre del hábito compartido"
            selectionColor={c.ink}
            cursorColor={c.ink}
            style={{ fontFamily: font.regular, fontSize: 17, letterSpacing: -0.2, color: c.text, backgroundColor: c.bg, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 14 }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
            {IDEAS.map((idea) => (
              <Press
                key={idea}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setTitle(idea);
                }}
                scaleTo={0.96}
                accessibilityRole="button"
                style={{ height: 34, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: c.bg, justifyContent: 'center' }}
              >
                <Text style={[type.footnote, { color: c.text }]}>{idea}</Text>
              </Press>
            ))}
          </View>
          <Text style={[type.footnote, { color: c.textSecondary, marginTop: space.md }]}>
            La racha solo avanza el día que los dos lo marcan. Los dos ven el nombre del hábito.
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
            <Press
              onPress={invite}
              disabled={!title.trim() || busy !== null}
              accessibilityRole="button"
              style={{ flex: 1, height: 48, borderRadius: radius.pill, backgroundColor: c.ink, opacity: title.trim() ? 1 : 0.3, alignItems: 'center', justifyContent: 'center' }}
            >
              {busy === 'invite' ? <ActivityIndicator color={c.inkOnInk} /> : <Text style={[type.headline, { color: c.inkOnInk }]}>Invitar a {who}</Text>}
            </Press>
            <Press
              onPress={() => {
                setCreating(false);
                setError(null);
              }}
              accessibilityRole="button"
              style={{ height: 48, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={[type.callout, { color: c.text }]}>Cancelar</Text>
            </Press>
          </View>
        </View>
      ) : (
        <Press
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setSent(null);
            setCreating(true);
          }}
          accessibilityRole="button"
          style={{ height: 50, borderRadius: radius.pill, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm }}
        >
          <Ionicons name="people-outline" size={18} color={c.text} />
          <Text style={[type.headline, { color: c.text }]}>Crear hábito juntos</Text>
        </Press>
      )}

      {active.length === 0 && incoming.length === 0 && outgoing.length === 0 && !creating && !sent && (
        <Text style={[type.footnote, { color: c.textTertiary, marginTop: space.sm, textAlign: 'center' }]}>
          Un hábito que hacen los dos, con una racha que solo avanza si ambos cumplen.
        </Text>
      )}
      {sent ? <Text style={[type.footnote, { color: c.textSecondary, marginTop: space.sm }]}>{sent}</Text> : null}
      {error ? <Text style={[type.footnote, { color: c.danger, marginTop: space.sm }]}>{error}</Text> : null}
    </View>
  );
}
