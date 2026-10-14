/**
 * "Hay una versión nueva" (1.9). MRitmo isn't on Play Store yet, so nobody
 * tells the phone about updates: the app reads mritmo.com/version.json (written
 * by the "Web" flow from the newest release) and compares it with its own
 * version. Our own domain, no GitHub API calls, no third parties.
 *
 * Cheap and quiet: at most one request every few hours, a short timeout, and
 * any failure (offline, site down) just means "no news".
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const VERSION_URL = 'https://mritmo.com/version.json';
export const DOWNLOAD_URL = 'https://mritmo.com/descargar';
export const NEWS_URL = 'https://mritmo.com/novedades/';

const KEY = 'ritmo.update.v1';
const EVERY_MS = 6 * 60 * 60 * 1000;

export type Release = {
  version: string;
  bytes?: number;
  published?: string;
  sha256?: string;
  /** What changed, written for people (from site/novedades/notas.json). */
  title?: string;
  notes?: string[];
};

type Stored = { checkedAt: number; release: Release | null; dismissed?: string };

export const currentVersion = () => String(Constants.expoConfig?.version ?? '0');

/** "1.10" is newer than "1.9": compare number by number, not as text. */
export function isNewer(candidate: string, current: string) {
  const a = candidate.split('.').map((n) => parseInt(n, 10) || 0);
  const b = current.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

async function read(): Promise<Stored> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : { checkedAt: 0, release: null };
  } catch {
    return { checkedAt: 0, release: null };
  }
}

async function write(s: Stored) {
  await AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
}

export type UpdateInfo = {
  /** The newest published release, when known. */
  release: Release | null;
  /** That release is newer than this app. */
  available: boolean;
  /** You tapped "Ahora no" for this version (the banner stays hidden; Settings still shows it). */
  dismissed: boolean;
  checkedAt: number;
};

function info(s: Stored): UpdateInfo {
  const available = Boolean(s.release && isNewer(s.release.version, currentVersion()));
  return { release: s.release, available, dismissed: available && s.dismissed === s.release?.version, checkedAt: s.checkedAt };
}

/** What we know without the network. */
export async function cachedUpdate(): Promise<UpdateInfo> {
  return info(await read());
}

/** Ask mritmo.com, unless we asked recently (or `force`). Never throws. */
export async function checkForUpdate(force = false): Promise<UpdateInfo> {
  const s = await read();
  if (!force && Date.now() - s.checkedAt < EVERY_MS) return info(s);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as Partial<Release>;
    const release: Release | null =
      typeof j.version === 'string' && /^\d+(\.\d+)*$/.test(j.version)
        ? {
            version: j.version,
            bytes: typeof j.bytes === 'number' ? j.bytes : undefined,
            published: typeof j.published === 'string' ? j.published : undefined,
            sha256: typeof j.sha256 === 'string' ? j.sha256 : undefined,
            title: typeof j.title === 'string' ? j.title : undefined,
            notes: Array.isArray(j.notes) ? j.notes.filter((n): n is string => typeof n === 'string').slice(0, 8) : undefined,
          }
        : null;
    const next: Stored = { ...s, checkedAt: Date.now(), release: release ?? s.release };
    await write(next);
    return info(next);
  } catch {
    return info(s);
  } finally {
    clearTimeout(timer);
  }
}

/** "Ahora no": hide the banner for this version only. */
export async function dismissUpdate(version: string): Promise<UpdateInfo> {
  const s = await read();
  const next = { ...s, dismissed: version };
  await write(next);
  return info(next);
}
