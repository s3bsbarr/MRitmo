/**
 * Privacy controls (1.9): hide your progress and block people.
 *
 * Hide: friends and rooms still see you on their boards, but with no %, no
 * minutes and no "en foco" (the database stops handing out your day_progress
 * rows). You keep publishing, so showing it again brings your history back.
 *
 * Block: removes the friendship or request (and your shared habits), pending
 * room invitations between you, and any notification between you. Neither sees
 * the other's progress, not even in a shared room, and the person you block can
 * no longer find you. They are never told. Rules live in the database
 * (supabase/migrations/…_ritmo_1_9_privacy.sql); this file only asks for them.
 */
import type { Profile } from './friends';
import { getSession, supabase } from './sync';

export type BlockedPerson = { id: string; username: string; display_name: string; gender: Profile['gender']; at: number };

function fail(e: { message?: string } | null, fallback: string): never {
  if (/network|fetch/i.test(e?.message ?? '')) throw new Error('Sin conexión. Revisa tu internet.');
  throw new Error(fallback);
}

async function myId() {
  return (await getSession())?.user.id ?? null;
}

/** Your own "Ocultar mi avance" switch, from your profile. Null when there's no profile yet. */
export async function loadHideProgress(): Promise<boolean | null> {
  const id = await myId();
  if (!id) return null;
  const { data, error } = await supabase.from('profiles').select('hide_progress').eq('id', id).maybeSingle();
  if (error) fail(error, 'No se pudo cargar tu privacidad.');
  return data ? Boolean((data as { hide_progress?: boolean }).hide_progress) : null;
}

export async function setHideProgress(hide: boolean) {
  const id = await myId();
  if (!id) throw new Error('Inicia sesión primero.');
  const { error } = await supabase.from('profiles').update({ hide_progress: hide }).eq('id', id);
  if (error) fail(error, 'No se pudo guardar.');
}

/** People you blocked, newest first (only you can see this list). */
export async function loadBlocked(): Promise<BlockedPerson[]> {
  const id = await myId();
  if (!id) return [];
  const { data, error } = await supabase.from('blocks').select('blocked, created_at').eq('blocker', id).order('created_at', { ascending: false });
  if (error) fail(error, 'No se pudo cargar tu lista de bloqueados.');
  const ids = (data ?? []).map((r) => r.blocked as string);
  if (!ids.length) return [];
  const { data: people } = await supabase.from('profiles').select('id, username, display_name, gender').in('id', ids);
  const byId = new Map(((people ?? []) as Profile[]).map((p) => [p.id, p]));
  return (data ?? [])
    .map((r) => {
      const p = byId.get(r.blocked as string);
      return p ? { id: p.id, username: p.username, display_name: p.display_name, gender: p.gender, at: new Date(r.created_at as string).getTime() } : null;
    })
    .filter((x): x is BlockedPerson => x !== null);
}

/** Ids only: enough to keep blocked people out of rooms on this phone. */
export async function loadBlockedIds(): Promise<string[]> {
  const id = await myId();
  if (!id) return [];
  const { data } = await supabase.from('blocks').select('blocked').eq('blocker', id);
  return (data ?? []).map((r) => r.blocked as string);
}

export async function blockUser(otherId: string) {
  const id = await myId();
  if (!id) throw new Error('Inicia sesión primero.');
  const { error } = await supabase.from('blocks').upsert({ blocker: id, blocked: otherId }, { onConflict: 'blocker,blocked', ignoreDuplicates: true });
  if (error) fail(error, 'No se pudo bloquear.');
}

export async function unblockUser(otherId: string) {
  const id = await myId();
  if (!id) return;
  const { error } = await supabase.from('blocks').delete().eq('blocker', id).eq('blocked', otherId);
  if (error) fail(error, 'No se pudo desbloquear.');
}
