import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { Avatar } from '../avatar/Avatar';
import type { BoardRow, Period, Profile } from '../friends';
import * as Haptics from '../haptics';
import type { Room } from '../rooms';
import { font, radius, space, type, useTheme } from '../theme';
import { BoardList, PeriodSwitch } from './BoardList';
import { Press } from './Press';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  /** null with `creating` = the "Crear sala" form. Kept after closing so the sheet doesn't empty while it slides away. */
  room: Room | null;
  creating: boolean;
  /** The room's board for a period (joined members only). */
  rowsFor: (room: Room, period: Period) => BoardRow[];
  friends: Profile[];
  now: number;
  onClose: () => void;
  onCreate: (name: string, inviteIds: string[]) => Promise<void>;
  onInvite: (room: Room, ids: string[]) => Promise<void>;
  onJoin: (room: Room) => Promise<void>;
  /** Leave, decline, delete or remove: the caller confirms where needed. */
  onLeave: (room: Room) => void;
  onDelete: (room: Room) => void;
  onRemoveMember: (room: Room, p: Profile) => void;
};

/**
 * A room up close: its own board (today or this week), who is invited, invite
 * more friends, leave or delete. In create mode: name + which friends to invite.
 */
export function RoomSheet({ visible, room, creating, rowsFor, friends, now, onClose, onCreate, onInvite, onJoin, onLeave, onDelete, onRemoveMember }: Props) {
  const { c } = useTheme();
  const [period, setPeriod] = useState<Period>('day');
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setPicked([]);
    setInviting(false);
    setError(null);
    setBusy(false);
  }, [visible, room?.id, creating]);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const inRoom = new Set(room?.members.map((m) => m.profile.id) ?? []);
  const candidates = friends.filter((f) => !inRoom.has(f.id));
  const toggle = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const primary = (label: string, onPress: () => void, enabled = true) => (
    <Press
      onPress={onPress}
      disabled={!enabled || busy}
      accessibilityRole="button"
      style={{ marginTop: space.lg, height: 52, borderRadius: radius.pill, backgroundColor: c.ink, opacity: enabled ? 1 : 0.3, alignItems: 'center', justifyContent: 'center' }}
    >
      {busy ? <ActivityIndicator color={c.inkOnInk} /> : <Text style={[type.headline, { color: c.inkOnInk }]}>{label}</Text>}
    </Press>
  );

  const friendPicker = (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden', marginTop: space.md }}>
      {candidates.length === 0 ? (
        <Text style={[type.footnote, { color: c.textSecondary, padding: space.lg }]}>
          {friends.length === 0 ? 'Aún no tienes amigos para invitar. Agrégalos desde Amigos.' : 'Todos tus amigos ya están en la sala.'}
        </Text>
      ) : (
        candidates.map((f, i) => {
          const on = picked.includes(f.id);
          return (
            <Press
              key={f.id}
              onPress={() => toggle(f.id)}
              scaleTo={0.99}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space.lg, gap: space.md, borderBottomWidth: i === candidates.length - 1 ? 0 : 1, borderBottomColor: c.separator }}
            >
              <Avatar gender={f.gender} mood="calma" px={2} still />
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { color: c.text }]} numberOfLines={1}>{f.display_name || `@${f.username}`}</Text>
                <Text style={[type.footnote, { color: c.textSecondary }]}>@{f.username}</Text>
              </View>
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: on ? 0 : 1.6, borderColor: c.textTertiary, backgroundColor: on ? c.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {on && <Ionicons name="checkmark" size={15} color={c.inkOnInk} />}
              </View>
            </Press>
          );
        })
      )}
    </View>
  );

  const errorText = error ? <Text style={[type.footnote, { color: c.danger, marginTop: space.md }]}>{error}</Text> : null;

  let body: React.ReactNode = null;
  if (creating) {
    body = (
      <>
        <Text style={[type.title, { color: c.text }]}>Nueva sala</Text>
        <Text style={[type.callout, { color: c.textSecondary, marginTop: space.xs }]}>
          Un ranking propio, del día y de la semana, con quien tú elijas. Dentro se ve solo el % y los minutos de cada uno.
        </Text>
        <TextInput
          value={name}
          onChangeText={(t) => setName(t.slice(0, 40))}
          placeholder="Nombre de la sala"
          placeholderTextColor={c.textTertiary}
          maxLength={40}
          returnKeyType="done"
          accessibilityLabel="Nombre de la sala"
          selectionColor={c.ink}
          cursorColor={c.ink}
          style={{ marginTop: space.xl, fontFamily: font.regular, fontSize: 17, letterSpacing: -0.2, color: c.text, backgroundColor: c.surface, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 14 }}
        />
        <Text style={[type.headline, { color: c.text, marginTop: space.xl }]}>Invitar amigos</Text>
        {friendPicker}
        {errorText}
        {primary(picked.length ? `Crear e invitar a ${picked.length}` : 'Crear sala', () => run(() => onCreate(name, picked)), name.trim().length > 0)}
      </>
    );
  } else if (room) {
    const invited = room.members.filter((m) => m.status === 'invited');
    if (room.myStatus === 'invited') {
      const by = room.invitedBy ? room.invitedBy.display_name || `@${room.invitedBy.username}` : 'Alguien';
      body = (
        <>
          <Text style={[type.title, { color: c.text }]} numberOfLines={2}>{room.name}</Text>
          <Text style={[type.callout, { color: c.textSecondary, marginTop: space.xs }]}>
            {by} te invitó. Al entrar, los de la sala ven tu % y tus minutos del día y de la semana (nunca tus tareas), y tú los suyos.
          </Text>
          <Text style={[type.footnote, { color: c.textSecondary, marginTop: space.lg }]}>
            En la sala: {room.members.filter((m) => m.status === 'joined').map((m) => `@${m.profile.username}`).join(', ')}
          </Text>
          {errorText}
          {primary('Unirme', () => run(() => onJoin(room)))}
          <Press onPress={() => onLeave(room)} accessibilityRole="button" style={{ alignSelf: 'center', padding: space.md, marginTop: space.xs }}>
            <Text style={[type.callout, { color: c.textSecondary }]}>Rechazar</Text>
          </Press>
        </>
      );
    } else {
      const rows = rowsFor(room, period);
      body = (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
            <Text style={[type.title, { color: c.text, flex: 1 }]} numberOfLines={2}>{room.name}</Text>
            <PeriodSwitch value={period} onChange={setPeriod} />
          </View>
          <Text style={[type.footnote, { color: c.textSecondary, marginTop: space.xs, marginBottom: space.md }]}>
            {rows.length} {rows.length === 1 ? 'persona' : 'personas'}
            {period === 'week' ? ' · de lunes a hoy' : ' · hoy, en vivo'}
          </Text>
          <BoardList rows={rows} period={period} now={now} onLongPress={room.mine ? (r) => onRemoveMember(room, r.profile) : undefined} />

          {invited.length > 0 && (
            <Text style={[type.footnote, { color: c.textSecondary, marginTop: space.md }]}>
              Invitados: {invited.map((m) => `@${m.profile.username}`).join(', ')}
            </Text>
          )}

          {inviting ? (
            <>
              <Text style={[type.headline, { color: c.text, marginTop: space.xl }]}>Invitar amigos</Text>
              {friendPicker}
              {errorText}
              {primary(
                picked.length ? `Invitar a ${picked.length}` : 'Elige a quién invitar',
                () =>
                  run(async () => {
                    await onInvite(room, picked);
                    setPicked([]);
                    setInviting(false);
                  }),
                picked.length > 0,
              )}
            </>
          ) : (
            <>
              {errorText}
              <Press
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setInviting(true);
                }}
                accessibilityRole="button"
                style={{ marginTop: space.xl, height: 50, borderRadius: radius.pill, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm }}
              >
                <Ionicons name="person-add-outline" size={18} color={c.text} />
                <Text style={[type.headline, { color: c.text }]}>Invitar amigos</Text>
              </Press>
            </>
          )}

          <Text style={[type.footnote, { color: c.textTertiary, marginTop: space.lg, textAlign: 'center' }]}>
            {room.mine ? 'Mantén presionado a alguien para sacarlo de la sala.' : 'Solo se ve el % y los minutos, nunca las tareas.'}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.xl, marginTop: space.sm }}>
            <Press onPress={() => onLeave(room)} accessibilityRole="button" style={{ padding: space.md }}>
              <Text style={[type.callout, { color: c.danger }]}>Salir de la sala</Text>
            </Press>
            {room.mine && (
              <Press onPress={() => onDelete(room)} accessibilityRole="button" style={{ padding: space.md }}>
                <Text style={[type.callout, { color: c.danger }]}>Eliminar sala</Text>
              </Press>
            )}
          </View>
        </>
      );
    }
  }

  return (
    <Sheet visible={visible && (creating || room !== null)} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
    </Sheet>
  );
}
