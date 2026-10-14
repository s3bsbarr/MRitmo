/**
 * Rooms (1.8): a named group with its own board, today and this week. Members
 * see each other's % and minutes even if they aren't friends with each other;
 * joining is agreeing to that. Only friends can be invited. Row Level Security
 * enforces all of it server-side (supabase/migrations/…_ritmo_1_8_rooms.sql).
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { dayKey } from './data';
import type { Profile } from './friends';
import { weekStartOf } from './friends';
import { getSession, supabase } from './sync';

export type RoomMember = { profile: Profile; status: 'invited' | 'joined' };

export type Room = {
  id: string;
  name: string;
  ownerId: string;
  /** You own it (rename, remove people, delete). */
  mine: boolean;
  myStatus: 'invited' | 'joined';
  /** Who invited you, while you are only invited. */
  invitedBy: Profile | null;
  members: RoomMember[];
};

export type RoomProgress = {
  today: Record<string, { done: number; total: number; focusUntil: number | null }>;
  week: Record<string, { done: number; total: number }>;
};

function fail(e: { message?: string } | null, fallback: string): never {
  const m = e?.message ?? '';
  if (/network|fetch/i.test(m)) throw new Error('Sin conexión. Revisa tu internet.');
  // Rules raised by the database come in Spanish: show them as they are.
  if (/sala|salas|personas/i.test(m)) throw new Error(m);
  throw new Error(fallback);
}

async function myId() {
  return (await getSession())?.user.id ?? null;
}

export async function fetchRooms(): Promise<Room[]> {
  const me = await myId();
  if (!me) return [];
  const { data: rooms, error } = await supabase.from('rooms').select('id, name, owner, created_at').order('created_at', { ascending: true });
  if (error) fail(error, 'No se pudieron cargar tus salas.');
  if (!rooms?.length) return [];

  const ids = rooms.map((r) => r.id);
  const { data: members, error: mErr } = await supabase.from('room_members').select('room_id, user_id, status, invited_by, created_at').in('room_id', ids);
  if (mErr) fail(mErr, 'No se pudieron cargar las salas.');

  const people = [...new Set((members ?? []).flatMap((m) => [m.user_id, m.invited_by].filter(Boolean) as string[]))];
  const profiles: Record<string, Profile> = {};
  if (people.length) {
    const { data } = await supabase.from('profiles').select('id, username, display_name, gender').in('id', people);
    for (const p of (data ?? []) as Profile[]) profiles[p.id] = p;
  }

  return rooms
    .map((r) => {
      const rows = (members ?? []).filter((m) => m.room_id === r.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
      const mineRow = rows.find((m) => m.user_id === me);
      if (!mineRow) return null;
      return {
        id: r.id,
        name: r.name,
        ownerId: r.owner,
        mine: r.owner === me,
        myStatus: mineRow.status,
        invitedBy: mineRow.invited_by ? (profiles[mineRow.invited_by] ?? null) : null,
        members: rows.filter((m) => profiles[m.user_id]).map((m) => ({ profile: profiles[m.user_id], status: m.status })),
      } as Room;
    })
    .filter((r): r is Room => r !== null);
}

/** Today's and this week's minutes for a set of people (friends or room mates). */
export async function loadProgress(userIds: string[], today = dayKey()): Promise<RoomProgress> {
  const out: RoomProgress = { today: {}, week: {} };
  if (!userIds.length) return out;
  const { data, error } = await supabase
    .from('day_progress')
    .select('user_id, day, done_minutes, total_minutes, focus_until')
    .in('user_id', userIds)
    .gte('day', weekStartOf(today))
    .lte('day', today);
  if (error) fail(error, 'No se pudo cargar el avance.');
  for (const r of data ?? []) {
    const w = (out.week[r.user_id] ??= { done: 0, total: 0 });
    w.done += r.done_minutes;
    w.total += r.total_minutes;
    if (r.day === today) {
      out.today[r.user_id] = {
        done: r.done_minutes,
        total: r.total_minutes,
        focusUntil: r.focus_until ? new Date(r.focus_until).getTime() : null,
      };
    }
  }
  return out;
}

export async function createRoom(name: string, inviteIds: string[]) {
  const n = name.trim();
  if (!n) throw new Error('Ponle un nombre a la sala.');
  const { data, error } = await supabase.rpc('create_room', { p_name: n.slice(0, 40) });
  if (error) fail(error, 'No se pudo crear la sala.');
  const id = data as string;
  if (inviteIds.length) await inviteToRoom(id, inviteIds);
  return id;
}

export async function inviteToRoom(roomId: string, userIds: string[]) {
  const me = await myId();
  if (!me) throw new Error('Inicia sesión primero.');
  const { error } = await supabase
    .from('room_members')
    .upsert(userIds.map((user_id) => ({ room_id: roomId, user_id, invited_by: me })), { onConflict: 'room_id,user_id', ignoreDuplicates: true });
  if (error) fail(error, 'No se pudo invitar. Solo puedes invitar a tus amigos.');
}

export async function joinRoom(roomId: string) {
  const me = await myId();
  if (!me) return;
  const { error } = await supabase.from('room_members').update({ status: 'joined' }).eq('room_id', roomId).eq('user_id', me);
  if (error) fail(error, 'No se pudo entrar a la sala.');
}

/** Decline an invitation or leave. If you owned it, it passes to the longest member. */
export async function leaveRoom(roomId: string) {
  const me = await myId();
  if (!me) return;
  const { error } = await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', me);
  if (error) fail(error, 'No se pudo salir de la sala.');
}

export async function removeFromRoom(roomId: string, userId: string) {
  const { error } = await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId);
  if (error) fail(error, 'No se pudo sacar a esa persona.');
}

export async function renameRoom(roomId: string, name: string) {
  const n = name.trim().slice(0, 40);
  if (!n) return;
  const { error } = await supabase.from('rooms').update({ name: n }).eq('id', roomId);
  if (error) fail(error, 'No se pudo cambiar el nombre.');
}

export async function deleteRoom(roomId: string) {
  const { error } = await supabase.from('rooms').delete().eq('id', roomId);
  if (error) fail(error, 'No se pudo eliminar la sala.');
}

/** Live: someone joining, leaving or being invited reloads the list. */
export function subscribeRooms(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const ping = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 400);
  };
  const channel: RealtimeChannel = supabase
    .channel('ritmo-rooms')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, ping)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members' }, ping)
    .subscribe();
  return () => {
    if (timer) clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
