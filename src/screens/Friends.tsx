import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../avatar/Avatar';
import { moodFor } from '../avatar/mood';
import type { ConfirmRequest } from '../components/ConfirmSheet';
import { FriendSheet } from '../components/FriendSheet';
import { NAV_HEIGHT } from '../components/NavBar';
import { Press } from '../components/Press';
import { SharedHabits } from '../components/SharedHabits';
import { UsernameField } from '../components/UsernameField';
import type { Gender } from '../data';
import { formatShort } from '../format';
import {
  accept,
  BoardRow,
  boardOf,
  claimUsername,
  DayProgress,
  FriendsState,
  loadDays,
  loadFriends,
  normalizeUsername,
  Profile,
  removeFriend,
  sendRequest,
  subscribeFriends,
  USERNAME_RE,
} from '../friends';
import * as Haptics from '../haptics';
import { friendName, SharedHabit } from '../shared';
import type { SharedApi } from '../store';
import { font, radius, space, type, useTheme } from '../theme';

type Props = {
  signedIn: boolean;
  name: string;
  gender: Gender;
  mine: { done: number; total: number; focusUntil: number | null };
  onAuth: (mode: 'signup' | 'signin') => void;
  onConfirm: (r: ConfirmRequest) => void;
  onProfileReady: () => void;
  /** Your own recent days, computed on this phone (for your own sheet). */
  history: DayProgress[];
  /** Open this friend's sheet as soon as they are on the board (from a notification). */
  openFriendId?: string | null;
  onFriendOpened?: () => void;
  /** Shared habits (1.7): on each friend's sheet and as invitations here. */
  sharedApi: SharedApi;
};

const empty: FriendsState = { me: null, friends: [], incoming: [], outgoing: [], progress: {} };

function Header({ title, right }: { title: string; right?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: space.xxl, marginBottom: space.sm }}>
      <Text style={[type.headline, { color: c.text }]}>{title}</Text>
      {right}
    </View>
  );
}

export function Friends({ signedIn, name, gender, mine, onAuth, onConfirm, onProfileReady, history, openFriendId, onFriendOpened, sharedApi }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [st, setSt] = useState<FriendsState>(empty);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [addName, setAddName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDays, setSheetDays] = useState<DayProgress[] | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const lastSheetRow = useRef<BoardRow | null>(null);
  const sheetReq = useRef(0);

  const load = useCallback(async () => {
    try {
      setSt(await loadFriends());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setSt(empty);
      setLoading(false);
      return;
    }
    setLoading(true);
    load();
    const unsub = subscribeFriends(load);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      unsub();
      clearInterval(id);
    };
  }, [signedIn, load]);

  const openSheet = useCallback(
    (r: BoardRow) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      lastSheetRow.current = r;
      setSheetId(r.profile.id);
      setSheetOpen(true);
      setSheetError(null);
      const req = ++sheetReq.current;
      if (r.me) {
        setSheetDays(history);
        return;
      }
      setSheetDays(null);
      loadDays(r.profile.id)
        .then((d) => req === sheetReq.current && setSheetDays(d))
        .catch((e) => req === sheetReq.current && setSheetError((e as Error).message));
    },
    [history],
  );

  // A notification ("X aceptó tu solicitud") asked to open someone's sheet.
  useEffect(() => {
    if (!openFriendId || loading || !st.me) return;
    const row = boardOf(st, mine).find((r) => r.profile.id === openFriendId);
    if (row) openSheet(row);
    onFriendOpened?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFriendId, loading, st]);

  const pad = {
    paddingTop: insets.top + space.xl,
    paddingBottom: insets.bottom + NAV_HEIGHT + space.xxxl,
    paddingHorizontal: space.xl,
  };

  const title = (
    <Text style={[type.largeTitle, { color: c.text }]} accessibilityRole="header">
      Amigos
    </Text>
  );

  // 1. No account yet.
  if (!signedIn) {
    return (
      <ScrollView contentContainerStyle={pad} showsVerticalScrollIndicator={false}>
        {title}
        <View style={{ marginTop: space.xxxl }}>
          <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.xl }}>
            <Avatar gender="m" mood="foco" px={3} />
            <Avatar gender="f" mood="fuerza" px={3} />
          </View>
          <Text style={[type.title, { color: c.text }]}>Avanza con tus amigos.</Text>
          <Text style={[type.body, { color: c.textSecondary, marginTop: space.sm }]}>
            Mira en vivo el % del día de cada uno y quién está en foco. Solo se comparte el avance: tus tareas siguen siendo privadas.
          </Text>
          <Press
            onPress={() => onAuth('signup')}
            accessibilityRole="button"
            style={{ marginTop: space.xl, height: 52, borderRadius: radius.pill, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={[type.headline, { color: c.inkOnInk }]}>Crear cuenta</Text>
          </Press>
          <Press onPress={() => onAuth('signin')} style={{ alignSelf: 'center', padding: space.md, marginTop: space.xs }}>
            <Text style={[type.callout, { color: c.textSecondary }]}>Ya tengo cuenta</Text>
          </Press>
        </View>
      </ScrollView>
    );
  }

  if (loading) {
    return (
      <View style={[pad, { flex: 1 }]}>
        {title}
        <ActivityIndicator color={c.textSecondary} style={{ marginTop: space.xxxl }} />
      </View>
    );
  }

  // 2. Signed in, no username yet.
  if (!st.me) {
    const valid = USERNAME_RE.test(normalizeUsername(username));
    const claim = async () => {
      if (!valid || busy) return;
      setBusy(true);
      setError(null);
      try {
        await claimUsername(username, name, gender);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        await load();
        onProfileReady();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    };
    return (
      <ScrollView contentContainerStyle={pad} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {title}
        <Text style={[type.title, { color: c.text, marginTop: space.xxxl }]}>Elige tu usuario</Text>
        <Text style={[type.body, { color: c.textSecondary, marginTop: space.sm }]}>Es como te encuentran tus amigos. Letras minúsculas, números, punto o guion bajo.</Text>
        <View style={{ marginTop: space.xl }}>
          <UsernameField value={username} onChange={setUsername} onSubmit={claim} autoFocus accessibilityLabel="Tu usuario" />
        </View>
        {error ? <Text style={[type.footnote, { color: c.danger, marginTop: space.md }]}>{error}</Text> : null}
        <Press
          onPress={claim}
          disabled={!valid || busy}
          accessibilityRole="button"
          style={{ marginTop: space.xl, height: 52, borderRadius: radius.pill, backgroundColor: c.ink, opacity: valid ? 1 : 0.3, alignItems: 'center', justifyContent: 'center' }}
        >
          {busy ? <ActivityIndicator color={c.inkOnInk} /> : <Text style={[type.headline, { color: c.inkOnInk }]}>Guardar usuario</Text>}
        </Press>
      </ScrollView>
    );
  }

  // 3. Board, requests and add.
  const board = boardOf(st, mine);
  const me = st.me;

  const add = async () => {
    const u = normalizeUsername(addName);
    if (!u || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await sendRequest(u);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setNotice(r === 'accepted' ? `Ahora eres amigo de @${u}.` : `Solicitud enviada a @${u}.`);
      setAddName('');
      await load();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const askRemove = (p: Profile) => {
    setSheetOpen(false);
    onConfirm({
      title: '¿Eliminar amigo?',
      subject: p.display_name || `@${p.username}`,
      detail: `@${p.username} dejará de ver tu avance y tú el suyo. También se quitan los hábitos que tienen juntos.`,
      confirmLabel: 'Eliminar',
      destructive: true,
      onConfirm: async () => {
        await removeFriend(p.id);
        load();
        sharedApi.reload();
      },
    });
  };

  /** Decline or cancel an invitation at once; leaving an active habit asks first. */
  const removeShared = (h: SharedHabit) => {
    if (h.status === 'pending') {
      sharedApi.remove(h.id).catch(() => {});
      return;
    }
    setSheetOpen(false);
    onConfirm({
      title: '¿Dejar el hábito?',
      subject: h.title,
      detail: `Se quita para ti y para ${friendName(h.friend)}, y se pierde la racha compartida.`,
      confirmLabel: 'Dejar hábito',
      destructive: true,
      onConfirm: () => sharedApi.remove(h.id).catch(() => {}),
    });
  };

  const habitInvites = sharedApi.habits.filter((h) => h.status === 'pending' && !h.mine);

  const liveSheetRow = board.find((r) => r.profile.id === sheetId) ?? null;
  if (liveSheetRow) lastSheetRow.current = liveSheetRow;
  const sheetRow = liveSheetRow ?? lastSheetRow.current;

  return (
    <ScrollView
      contentContainerStyle={pad}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={c.textSecondary}
          colors={[c.text]}
          progressBackgroundColor={c.surface}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {title}
        <Press
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            Share.share({ message: `Agrégame en MRitmo: @${me.username}` }).catch(() => {});
          }}
          accessibilityRole="button"
          accessibilityLabel={`Compartir tu usuario @${me.username}`}
          style={{ height: 36, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Text style={[type.callout, { color: c.text }]}>@{me.username}</Text>
          <Ionicons name="share-outline" size={16} color={c.text} />
        </Press>
      </View>
      <Text style={[type.callout, { color: c.textSecondary, marginTop: 2 }]}>Hoy, en vivo</Text>

      {error ? <Text style={[type.footnote, { color: c.danger, marginTop: space.lg }]}>{error}</Text> : null}

      <Header title="Ranking del día" right={<Text style={[type.footnote, { color: c.textSecondary }]}>{board.length} {board.length === 1 ? 'persona' : 'personas'}</Text>} />
      <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
        {board.map((r, i) => {
          const pct = Math.round(r.ratio * 100);
          const inFocus = r.focusUntil !== null && r.focusUntil > now;
          return (
              <Press
                key={r.profile.id}
                onPress={() => openSheet(r)}
                onLongPress={r.me ? undefined : () => askRemove(r.profile)}
                delayLongPress={400}
                scaleTo={0.99}
                accessibilityRole="button"
                accessibilityHint="Abre su avance de la semana"
                accessibilityLabel={`${r.me ? 'Tú' : r.profile.display_name || r.profile.username}, puesto ${i + 1}, ${pct} por ciento${inFocus ? ', en foco' : ''}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: 72,
                  paddingHorizontal: space.lg,
                  gap: space.md,
                  borderBottomWidth: i === board.length - 1 ? 0 : 1,
                  borderBottomColor: c.separator,
                }}
              >
                <Text style={[type.headline, { color: c.textTertiary, width: 20, fontVariant: ['tabular-nums'] }]}>{i + 1}</Text>
                <Avatar gender={r.profile.gender} mood={moodFor(r.ratio, r.total > 0)} px={2} still />
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: c.text, fontFamily: r.me ? font.semibold : font.regular }]} numberOfLines={1}>
                    {r.me ? 'Tú' : r.profile.display_name || `@${r.profile.username}`}
                  </Text>
                  <Text style={[type.footnote, { color: c.textSecondary, fontVariant: ['tabular-nums'] }]} numberOfLines={1}>
                    {r.total > 0 ? `${formatShort(r.done)} de ${formatShort(r.total)}` : 'Sin plan todavía'}
                    {inFocus ? '  ·  en foco' : ''}
                  </Text>
                </View>
                <Text style={[type.title, { color: c.text, fontVariant: ['tabular-nums'] }]}>
                  {pct}
                  <Text style={[type.footnote, { color: c.textSecondary }]}> %</Text>
                </Text>
              </Press>
          );
        })}
      </View>
      {st.friends.length === 0 && (
        <Text style={[type.footnote, { color: c.textTertiary, marginTop: space.md }]}>
          Aún no tienes amigos aquí. Comparte tu usuario o agrega el de alguien abajo.
        </Text>
      )}

      {st.incoming.length > 0 && (
        <>
          <Header title="Solicitudes" />
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
            {st.incoming.map((p, i) => (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: 64,
                  paddingHorizontal: space.lg,
                  gap: space.md,
                  borderBottomWidth: i === st.incoming.length - 1 ? 0 : 1,
                  borderBottomColor: c.separator,
                }}
              >
                <Avatar gender={p.gender} mood="foco" px={2} still />
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: c.text }]} numberOfLines={1}>{p.display_name || `@${p.username}`}</Text>
                  <Text style={[type.footnote, { color: c.textSecondary }]}>@{p.username}</Text>
                </View>
                <Press
                  onPress={async () => {
                    await removeFriend(p.id);
                    load();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Rechazar a @${p.username}`}
                  style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}
                >
                  <Ionicons name="close" size={20} color={c.text} />
                </Press>
                <Press
                  onPress={async () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                    await accept(p.id);
                    load();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Aceptar a @${p.username}`}
                  style={{ height: 40, paddingHorizontal: space.lg, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.ink }}
                >
                  <Text style={[type.callout, { color: c.inkOnInk, fontFamily: font.semibold }]}>Aceptar</Text>
                </Press>
              </View>
            ))}
          </View>
        </>
      )}

      {habitInvites.length > 0 && (
        <>
          <Header title="Hábitos juntos" />
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
            {habitInvites.map((h, i) => (
              <View
                key={h.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: 64,
                  paddingHorizontal: space.lg,
                  gap: space.md,
                  borderBottomWidth: i === habitInvites.length - 1 ? 0 : 1,
                  borderBottomColor: c.separator,
                }}
              >
                <Avatar gender={h.friend.gender} mood="foco" px={2} still />
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: c.text }]} numberOfLines={1}>{h.title}</Text>
                  <Text style={[type.footnote, { color: c.textSecondary }]} numberOfLines={1}>{friendName(h.friend)} te invita</Text>
                </View>
                <Press
                  onPress={() => sharedApi.remove(h.id).catch(() => {})}
                  accessibilityRole="button"
                  accessibilityLabel={`Rechazar ${h.title}`}
                  style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}
                >
                  <Ionicons name="close" size={20} color={c.text} />
                </Press>
                <Press
                  onPress={async () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                    await sharedApi.accept(h.id).catch(() => {});
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Aceptar ${h.title}`}
                  style={{ height: 40, paddingHorizontal: space.lg, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.ink }}
                >
                  <Text style={[type.callout, { color: c.inkOnInk, fontFamily: font.semibold }]}>Aceptar</Text>
                </Press>
              </View>
            ))}
          </View>
        </>
      )}

      <Header title="Agregar amigo" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <UsernameField value={addName} onChange={setAddName} onSubmit={add} returnKeyType="send" accessibilityLabel="Usuario de tu amigo" />
        </View>
        <Press
          onPress={add}
          disabled={!addName || busy}
          accessibilityRole="button"
          style={{ height: 52, paddingHorizontal: space.xl, borderRadius: radius.md, backgroundColor: c.ink, opacity: addName ? 1 : 0.3, alignItems: 'center', justifyContent: 'center' }}
        >
          {busy ? <ActivityIndicator color={c.inkOnInk} /> : <Text style={[type.headline, { color: c.inkOnInk }]}>Agregar</Text>}
        </Press>
      </View>
      {notice ? <Text style={[type.footnote, { color: c.textSecondary, marginTop: space.sm }]}>{notice}</Text> : null}

      {st.outgoing.length > 0 && (
        <>
          <Header title="Enviadas" />
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
            {st.outgoing.map((p, i) => (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: 56,
                  paddingHorizontal: space.lg,
                  borderBottomWidth: i === st.outgoing.length - 1 ? 0 : 1,
                  borderBottomColor: c.separator,
                }}
              >
                <Text style={[type.body, { color: c.text, flex: 1 }]} numberOfLines={1}>@{p.username}</Text>
                <Press
                  onPress={async () => {
                    await removeFriend(p.id);
                    load();
                  }}
                  accessibilityRole="button"
                  style={{ padding: space.sm }}
                >
                  <Text style={[type.callout, { color: c.textSecondary }]}>Cancelar</Text>
                </Press>
              </View>
            ))}
          </View>
        </>
      )}

      <Text style={[type.footnote, { color: c.textTertiary, marginTop: space.xxl, textAlign: 'center' }]}>
        Solo compartes el % del día y si estás en foco. Toca a alguien para ver su semana.
      </Text>

      <FriendSheet
        visible={sheetOpen}
        row={sheetRow}
        days={sheetDays}
        error={sheetError}
        now={now}
        onClose={() => setSheetOpen(false)}
        onRemove={sheetRow && !sheetRow.me ? () => askRemove(sheetRow.profile) : undefined}
      >
        {sheetRow && !sheetRow.me ? (
          <SharedHabits
            friend={sheetRow.profile}
            habits={sharedApi.habits.filter((h) => h.friend.id === sheetRow.profile.id)}
            onToggle={sharedApi.toggleToday}
            onInvite={(title) => sharedApi.invite(sheetRow.profile.id, title)}
            onAccept={sharedApi.accept}
            onRemove={removeShared}
          />
        ) : null}
      </FriendSheet>
    </ScrollView>
  );
}
