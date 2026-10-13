import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../avatar/Avatar';
import { moodFor } from '../avatar/mood';
import type { ConfirmRequest } from '../components/ConfirmSheet';
import { NAV_HEIGHT } from '../components/NavBar';
import { Press } from '../components/Press';
import type { Gender } from '../data';
import { formatShort } from '../format';
import {
  accept,
  boardOf,
  claimUsername,
  FriendsState,
  loadFriends,
  normalizeUsername,
  Profile,
  removeFriend,
  sendRequest,
  subscribeFriends,
  USERNAME_RE,
} from '../friends';
import * as Haptics from '../haptics';
import { font, radius, space, type, useTheme } from '../theme';

type Props = {
  signedIn: boolean;
  name: string;
  gender: Gender;
  mine: { done: number; total: number; focusUntil: number | null };
  onAuth: (mode: 'signup' | 'signin') => void;
  onConfirm: (r: ConfirmRequest) => void;
  onProfileReady: () => void;
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

function useField() {
  const { c } = useTheme();
  return {
    fontFamily: font.regular,
    fontSize: 17,
    letterSpacing: -0.2,
    color: c.text,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  } as const;
}

export function Friends({ signedIn, name, gender, mine, onAuth, onConfirm, onProfileReady }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const field = useField();
  const [st, setSt] = useState<FriendsState>(empty);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [addName, setAddName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

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
          <TextInput
            value={username}
            onChangeText={(t) => setUsername(t.replace(/\s/g, '').toLowerCase())}
            placeholder="@usuario"
            placeholderTextColor={c.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            maxLength={21}
            returnKeyType="done"
            onSubmitEditing={claim}
            selectionColor={c.ink}
            cursorColor={c.ink}
            style={field}
          />
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

  const askRemove = (p: Profile) =>
    onConfirm({
      title: '¿Eliminar amigo?',
      subject: p.display_name || `@${p.username}`,
      detail: `@${p.username} dejará de ver tu avance y tú el suyo.`,
      confirmLabel: 'Eliminar',
      destructive: true,
      onConfirm: async () => {
        await removeFriend(p.id);
        load();
      },
    });

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
            Share.share({ message: `Agrégame en Ritmo: @${me.username}` }).catch(() => {});
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
                onLongPress={r.me ? undefined : () => askRemove(r.profile)}
                delayLongPress={400}
                scaleTo={r.me ? 1 : 0.99}
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

      <Header title="Agregar amigo" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1, minWidth: 0 }}>
        <TextInput
          value={addName}
          onChangeText={(t) => setAddName(t.replace(/\s/g, '').toLowerCase())}
          placeholder="@usuario"
          placeholderTextColor={c.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={21}
          returnKeyType="send"
          onSubmitEditing={add}
          selectionColor={c.ink}
          cursorColor={c.ink}
          style={[field, { width: '100%' }]}
        />
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
        Solo compartes el % del día y si estás en foco. Mantén presionado a un amigo para eliminarlo.
      </Text>
    </ScrollView>
  );
}
