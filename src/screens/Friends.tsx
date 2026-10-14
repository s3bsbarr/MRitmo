import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../avatar/Avatar';
import { BoardList, PeriodSwitch } from '../components/BoardList';
import type { ConfirmRequest } from '../components/ConfirmSheet';
import { FriendSheet } from '../components/FriendSheet';
import { NAV_HEIGHT } from '../components/NavBar';
import { Press } from '../components/Press';
import { RoomSheet } from '../components/RoomSheet';
import { SharedHabits } from '../components/SharedHabits';
import { UsernameField } from '../components/UsernameField';
import type { Gender } from '../data';
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
  Period,
  Profile,
  rankRows,
  removeFriend,
  sendRequest,
  subscribeFriends,
  USERNAME_RE,
  weekOfMine,
} from '../friends';
import * as Haptics from '../haptics';
import { createRoom, deleteRoom, fetchRooms, inviteToRoom, joinRoom, leaveRoom, loadProgress, removeFromRoom, Room, RoomProgress, subscribeRooms } from '../rooms';
import { friendName, SharedHabit } from '../shared';
import { getSession, supabase } from '../sync';
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
  /** Open this room (from a notification: ritmo://salas/<id>). */
  openRoomId?: string | null;
  onRoomOpened?: () => void;
  /** From an invitation link (mritmo.com/u/<usuario>): show "Agregar a @usuario". */
  addUsername?: string | null;
  onAddHandled?: () => void;
};

const empty: FriendsState = { me: null, friends: [], incoming: [], outgoing: [], progress: {}, week: {} };
const noProgress: RoomProgress = { today: {}, week: {} };

/** What the invitation link points to: mritmo.com/u/<usuario>. */
export const inviteLink = (username: string) => `https://mritmo.com/u/${username}`;

function Header({ title, right }: { title: string; right?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: space.xxl, marginBottom: space.sm }}>
      <Text style={[type.headline, { color: c.text }]}>{title}</Text>
      {right}
    </View>
  );
}

export function Friends({
  signedIn,
  name,
  gender,
  mine,
  onAuth,
  onConfirm,
  onProfileReady,
  history,
  openFriendId,
  onFriendOpened,
  sharedApi,
  openRoomId,
  onRoomOpened,
  addUsername,
  onAddHandled,
}: Props) {
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
  const [period, setPeriod] = useState<Period>('day');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomProgress, setRoomProgress] = useState<RoomProgress>(noProgress);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomOpen, setRoomOpen] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const lastRoom = useRef<Room | null>(null);
  /** From an invitation link; kept until you have an account and a username. */
  const [pendingAdd, setPendingAdd] = useState<string | null>(null);
  const [linkTarget, setLinkTarget] = useState<{ username: string; profile: Profile | null; state: 'loading' | 'found' | 'missing' } | null>(null);

  const load = useCallback(async () => {
    try {
      const [friends, myRooms] = await Promise.all([loadFriends(), fetchRooms().catch(() => [] as Room[])]);
      setSt(friends);
      setRooms(myRooms);
      // Room mates who aren't friends: their progress comes from the room (RLS allows it once joined).
      const meId = friends.me?.id;
      const mates = [...new Set(myRooms.filter((r) => r.myStatus === 'joined').flatMap((r) => r.members.filter((m) => m.status === 'joined').map((m) => m.profile.id)))].filter(
        (id) => id !== meId,
      );
      setRoomProgress(mates.length ? await loadProgress(mates) : noProgress);
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
    const unsubRooms = subscribeRooms(load);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      unsub();
      unsubRooms();
      clearInterval(id);
    };
  }, [signedIn, load]);

  const openSheet = useCallback(
    (r: BoardRow) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      // The sheet is always about today, also when the board shows the week.
      r = boardOf(st, mine).find((x) => x.profile.id === r.profile.id) ?? r;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, st, mine.done, mine.total, mine.focusUntil],
  );

  const openRoom = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCreatingRoom(false);
    setRoomId(id);
    setRoomOpen(true);
  }, []);

  // A notification ("X te invitó a una sala") asked to open a room.
  useEffect(() => {
    if (!openRoomId || loading || !st.me) return;
    if (rooms.some((r) => r.id === openRoomId)) openRoom(openRoomId);
    onRoomOpened?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRoomId, loading, rooms]);

  // An invitation link (mritmo.com/u/<usuario>) opened the app.
  useEffect(() => {
    if (!addUsername) return;
    const u = normalizeUsername(addUsername);
    onAddHandled?.();
    if (USERNAME_RE.test(u)) setPendingAdd(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addUsername]);

  // Look the person up once there is a session (the link may have come before the account).
  const myId = st.me?.id ?? null;
  useEffect(() => {
    if (!pendingAdd || !signedIn) return;
    const u = pendingAdd;
    setLinkTarget({ username: u, profile: null, state: 'loading' });
    (async () => {
      if (!(await getSession())) return;
      const { data } = await supabase.from('profiles').select('id, username, display_name, gender').eq('username', u).maybeSingle();
      setLinkTarget({ username: u, profile: (data as Profile) ?? null, state: data ? 'found' : 'missing' });
    })().catch(() => setLinkTarget({ username: u, profile: null, state: 'missing' }));
  }, [pendingAdd, signedIn, myId]);

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
          <Text style={[type.title, { color: c.text }]}>{pendingAdd ? `@${pendingAdd} te invitó a MRitmo.` : 'Avanza con tus amigos.'}</Text>
          <Text style={[type.body, { color: c.textSecondary, marginTop: space.sm }]}>
            {pendingAdd
              ? `Crea tu cuenta o inicia sesión y te mostramos "Agregar a @${pendingAdd}". Solo se comparte el avance: tus tareas siguen siendo privadas.`
              : 'Mira en vivo el % del día de cada uno y quién está en foco. Solo se comparte el avance: tus tareas siguen siendo privadas.'}
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
  const me = st.me;
  const myWeek = weekOfMine(history, mine);
  const dayBoard = boardOf(st, mine);
  const board = period === 'day' ? dayBoard : boardOf(st, mine, 'week', myWeek);

  /** A room's board: its joined members, from friends' and room mates' progress. */
  const roomRows = (room: Room, p: Period) =>
    rankRows(
      room.members.filter((m) => m.status === 'joined').map((m) => m.profile),
      me,
      { today: mine, week: myWeek },
      { today: { ...roomProgress.today, ...st.progress }, week: { ...roomProgress.week, ...st.week } },
      p,
    );
  const joinedRooms = rooms.filter((r) => r.myStatus === 'joined');
  const roomInvites = rooms.filter((r) => r.myStatus === 'invited');
  const liveRoom = rooms.find((r) => r.id === roomId) ?? null;
  if (liveRoom) lastRoom.current = liveRoom;
  const sheetRoom = liveRoom ?? lastRoom.current;

  const closeRoom = () => setRoomOpen(false);
  const askLeaveRoom = (room: Room) => {
    if (room.myStatus === 'invited') {
      closeRoom();
      leaveRoom(room.id).then(load).catch(() => {});
      return;
    }
    const others = room.members.filter((m) => m.status === 'joined').length - 1;
    closeRoom();
    onConfirm({
      title: '¿Salir de la sala?',
      subject: room.name,
      detail: room.mine && others > 0 ? 'Dejas de ver su ranking y ellos el tuyo. La sala pasa a quien lleva más tiempo en ella.' : others > 0 ? 'Dejas de ver su ranking y ellos el tuyo.' : 'Eres la única persona: la sala se elimina.',
      confirmLabel: 'Salir',
      destructive: true,
      onConfirm: async () => {
        await leaveRoom(room.id).catch(() => {});
        load();
      },
    });
  };
  const askDeleteRoom = (room: Room) => {
    closeRoom();
    onConfirm({
      title: '¿Eliminar la sala?',
      subject: room.name,
      detail: 'Se elimina para todos. Nadie pierde su avance: solo desaparece este ranking.',
      confirmLabel: 'Eliminar',
      destructive: true,
      onConfirm: async () => {
        await deleteRoom(room.id).catch(() => {});
        load();
      },
    });
  };
  const askRemoveMember = (room: Room, p: Profile) => {
    closeRoom();
    onConfirm({
      title: '¿Sacar de la sala?',
      subject: p.display_name || `@${p.username}`,
      detail: `@${p.username} deja de estar en «${room.name}». Puedes volver a invitarlo.`,
      confirmLabel: 'Sacar',
      destructive: true,
      onConfirm: async () => {
        await removeFromRoom(room.id, p.id).catch(() => {});
        load();
      },
    });
  };

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

  const liveSheetRow = dayBoard.find((r) => r.profile.id === sheetId) ?? null;
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
            Share.share({ message: `Agrégame en MRitmo: ${inviteLink(me.username)}` }).catch(() => {});
          }}
          accessibilityRole="button"
          accessibilityLabel={`Compartir tu usuario @${me.username}`}
          style={{ height: 36, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Text style={[type.callout, { color: c.text }]}>@{me.username}</Text>
          <Ionicons name="share-outline" size={16} color={c.text} />
        </Press>
      </View>
      <Text style={[type.callout, { color: c.textSecondary, marginTop: 2 }]}>{period === 'day' ? 'Hoy, en vivo' : 'Esta semana, de lunes a hoy'}</Text>

      {error ? <Text style={[type.footnote, { color: c.danger, marginTop: space.lg }]}>{error}</Text> : null}

      {linkTarget && <LinkCard target={linkTarget} me={me} friends={st.friends} outgoing={st.outgoing} onDone={() => { setLinkTarget(null); setPendingAdd(null); load(); }} />}

      <Header title={period === 'day' ? 'Ranking del día' : 'Ranking de la semana'} right={<PeriodSwitch value={period} onChange={setPeriod} />} />
      <BoardList rows={board} period={period} now={now} onOpen={openSheet} onLongPress={(r) => askRemove(r.profile)} />
      {st.friends.length === 0 && (
        <Text style={[type.footnote, { color: c.textTertiary, marginTop: space.md }]}>
          Aún no tienes amigos aquí. Comparte tu enlace (arriba, junto a tu usuario) o agrega el de alguien abajo.
        </Text>
      )}

      <Header
        title="Salas"
        right={
          <Press
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setRoomId(null);
              setCreatingRoom(true);
              setRoomOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Crear sala"
            style={{ height: 30, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Ionicons name="add" size={16} color={c.text} />
            <Text style={[type.footnote, { color: c.text, fontFamily: font.semibold }]}>Crear</Text>
          </Press>
        }
      />
      {joinedRooms.length + roomInvites.length === 0 ? (
        <Text style={[type.footnote, { color: c.textTertiary }]}>
          Una sala es un ranking propio con un grupo: el equipo, la familia, los del gimnasio. Crea una e invita a tus amigos.
        </Text>
      ) : (
        <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
          {[...roomInvites, ...joinedRooms].map((room, i, list) => {
            const invited = room.myStatus === 'invited';
            const rows = invited ? [] : roomRows(room, period);
            const place = rows.findIndex((r) => r.me) + 1;
            const count = room.members.filter((m) => m.status === 'joined').length;
            return (
              <Press
                key={room.id}
                onPress={() => openRoom(room.id)}
                scaleTo={0.99}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: space.lg, gap: space.md, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: c.separator }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={invited ? 'mail-unread-outline' : 'people-outline'} size={20} color={c.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: c.text }]} numberOfLines={1}>{room.name}</Text>
                  <Text style={[type.footnote, { color: c.textSecondary }]} numberOfLines={1}>
                    {invited
                      ? `${room.invitedBy ? room.invitedBy.display_name || `@${room.invitedBy.username}` : 'Alguien'} te invitó`
                      : `${count} ${count === 1 ? 'persona' : 'personas'} · vas ${place}.º ${period === 'day' ? 'hoy' : 'esta semana'}`}
                  </Text>
                </View>
                {invited ? (
                  <Press
                    onPress={async () => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                      await joinRoom(room.id).catch(() => {});
                      load();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Unirme a ${room.name}`}
                    style={{ height: 36, paddingHorizontal: space.lg, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.ink }}
                  >
                    <Text style={[type.callout, { color: c.inkOnInk, fontFamily: font.semibold }]}>Unirme</Text>
                  </Press>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
                )}
              </Press>
            );
          })}
        </View>
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
        Solo compartes el % del día y de la semana, y si estás en foco. Toca a alguien para ver su semana.
      </Text>

      <RoomSheet
        visible={roomOpen}
        room={creatingRoom ? null : sheetRoom}
        creating={creatingRoom}
        rowsFor={roomRows}
        friends={st.friends}
        now={now}
        onClose={closeRoom}
        onCreate={async (n, ids) => {
          const id = await createRoom(n, ids);
          await load();
          setCreatingRoom(false);
          setRoomId(id);
        }}
        onInvite={async (room, ids) => {
          await inviteToRoom(room.id, ids);
          await load();
        }}
        onJoin={async (room) => {
          await joinRoom(room.id);
          await load();
        }}
        onLeave={askLeaveRoom}
        onDelete={askDeleteRoom}
        onRemoveMember={askRemoveMember}
      />

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

/** "Agregar a @usuario", from an invitation link (mritmo.com/u/<usuario>). */
function LinkCard({
  target,
  me,
  friends,
  outgoing,
  onDone,
}: {
  target: { username: string; profile: Profile | null; state: 'loading' | 'found' | 'missing' };
  me: Profile;
  friends: Profile[];
  outgoing: Profile[];
  onDone: () => void;
}) {
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const p = target.profile;
  const isMe = p?.id === me.id;
  const already = p ? friends.some((f) => f.id === p.id) : false;
  const sent = p ? outgoing.some((f) => f.id === p.id) : false;

  const add = async () => {
    if (!p || busy) return;
    setBusy(true);
    try {
      const r = await sendRequest(p.username);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setMessage(r === 'accepted' ? `Ahora eres amigo de @${p.username}.` : `Solicitud enviada a @${p.username}.`);
      setTimeout(onDone, 1600);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ marginTop: space.xl, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar gender={p?.gender ?? 'm'} mood={p ? 'fuerza' : 'calma'} px={3} still />
        <View style={{ flex: 1 }}>
          <Text style={[type.footnote, { color: c.textSecondary }]}>Desde un enlace de invitación</Text>
          <Text style={[type.title, { color: c.text }]} numberOfLines={1}>
            {target.state === 'loading' ? `@${target.username}` : p ? p.display_name || `@${p.username}` : `@${target.username}`}
          </Text>
          {p && p.display_name ? <Text style={[type.footnote, { color: c.textSecondary }]}>@{p.username}</Text> : null}
        </View>
        <Press onPress={onDone} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
          <Ionicons name="close" size={18} color={c.text} />
        </Press>
      </View>
      {target.state === 'loading' ? (
        <ActivityIndicator color={c.textSecondary} style={{ marginTop: space.lg }} />
      ) : !p ? (
        <Text style={[type.callout, { color: c.textSecondary, marginTop: space.md }]}>No existe @{target.username}. Revisa el enlace con quien te lo envió.</Text>
      ) : isMe ? (
        <Text style={[type.callout, { color: c.textSecondary, marginTop: space.md }]}>Es tu propio enlace. Compártelo para que te agreguen.</Text>
      ) : already ? (
        <Text style={[type.callout, { color: c.textSecondary, marginTop: space.md }]}>Ya son amigos. Lo ves en el ranking de abajo.</Text>
      ) : sent ? (
        <Text style={[type.callout, { color: c.textSecondary, marginTop: space.md }]}>Ya le enviaste una solicitud. Falta que la acepte.</Text>
      ) : message ? (
        <Text style={[type.callout, { color: c.text, marginTop: space.md }]}>{message}</Text>
      ) : (
        <Press
          onPress={add}
          accessibilityRole="button"
          style={{ marginTop: space.lg, height: 50, borderRadius: radius.pill, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}
        >
          {busy ? <ActivityIndicator color={c.inkOnInk} /> : <Text style={[type.headline, { color: c.inkOnInk }]}>Agregar a @{p.username}</Text>}
        </Press>
      )}
    </View>
  );
}
