import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { BlurTargetView } from 'expo-blur';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyAction, resyncAll } from './src/actions';
import { ActionsSheet, ItemActions } from './src/components/ActionsSheet';
import { AddSheet, Editing, NewItem } from './src/components/AddSheet';
import { AuthSheet, AuthStep } from './src/components/AuthSheet';
import { ConfirmRequest, ConfirmSheet } from './src/components/ConfirmSheet';
import { DeleteAccountSheet } from './src/components/DeleteAccountSheet';
import { UpdateBanner } from './src/components/UpdateBanner';
import { BlurTargetContext } from './src/components/Glass';
import { NavBar, Tab } from './src/components/NavBar';
import { defaultSettings, emptyFocus, FocusState, loadFocus, loadMeta, loadSettings, progressOf, saveFocus, saveSettings, Settings, ThemePref } from './src/data';
import { configureNotifications, onAppBackground, onAppForeground, requestNotificationPermission } from './src/effects';
import { Focus } from './src/screens/Focus';
import { Friends } from './src/screens/Friends';
import { clearFriendsCache, getMyProfile, historyOf, publishProgress, syncProfile } from './src/friends';
import { forgetPush, PushStatus, registerPush, savePushPrefs, unregisterPush } from './src/push';
import { countOwnedRooms } from './src/rooms';
import { Onboarding } from './src/screens/Onboarding';
import { cachedUpdate, checkForUpdate, dismissUpdate, UpdateInfo } from './src/update';
import { AccountInfo, SettingsScreen } from './src/screens/Settings';
import { Summary } from './src/screens/Summary';
import { Today } from './src/screens/Today';
import { Welcome } from './src/screens/Welcome';
import { clearSharedCache } from './src/shared';
import { useHabits, useShared, useTasks } from './src/store';
import { deleteAccount, forgetSession, getSession, handleAuthUrl, scheduleSync, signOut, supabase, syncNow } from './src/sync';
import { paletteFor, ThemeContext } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotifications();

/** Post-signup steps (1.9) done or skipped, per account. */
const onboardKey = (userId: string) => `ritmo.onboard.v1.${userId}`;

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const system = useColorScheme();
  const api = useTasks();
  const habitsApi = useHabits();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('hoy');
  const [adding, setAdding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [actions, setActions] = useState<ItemActions | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [focus, setFocusState] = useState<FocusState>(emptyFocus);
  const target = useRef<View>(null);
  const [account, setAccount] = useState<AccountInfo>({ email: null, syncing: false });
  const [authMode, setAuthMode] = useState<'signup' | 'signin' | null>(null);
  const [authStep, setAuthStep] = useState<AuthStep>('form');
  const [authError, setAuthError] = useState<string | null>(null);
  const [push, setPush] = useState<PushStatus>({ state: 'checking' });
  const [openFriendId, setOpenFriendId] = useState<string | null>(null);
  const [focusFull, setFocusFull] = useState(false);
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [addUsername, setAddUsername] = useState<string | null>(null);
  const sharedApi = useShared(Boolean(account.email));
  // 1.9: post-signup onboarding, delete account, new-version notice, reloads.
  const [onboarding, setOnboarding] = useState<{ userId: string; username: string | null } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [ownedRooms, setOwnedRooms] = useState(0);
  const [release, setRelease] = useState<UpdateInfo | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  /** The last invitation link (mritmo.com/u/<usuario>), offered again in onboarding. */
  const lastInvite = useRef<string | null>(null);

  const snapRef = useRef({ tasks: api.tasks, habits: habitsApi.habits, focus, settings, shared: sharedApi.active });
  snapRef.current = { tasks: api.tasks, habits: habitsApi.habits, focus, settings, shared: sharedApi.active };

  useEffect(() => {
    Promise.all([loadSettings(), loadFocus()]).then(([s, f]) => {
      setSettings(s);
      setFocusState(f);
      setSettingsLoaded(true);
    });
  }, []);

  const ready = fontsLoaded && api.ready && habitsApi.ready && settingsLoaded;

  // Any change in tasks, habits, focus or settings re-plans notifications, the
  // live timer and widgets from the same state, a moment after the last edit.
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => resyncAll(snapRef.current), 450);
    return () => clearTimeout(id);
    // api.today: at midnight, re-plan notifications and redraw widgets for the new day (1.9).
  }, [ready, api.tasks, habitsApi.habits, focus, settings, sharedApi.active, api.today]);

  const setFocus = useCallback((f: FocusState) => {
    setFocusState(f);
    saveFocus(f);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // The task and habit hooks return new objects every render; keep their reload
  // functions in a ref so listeners below are registered exactly once.
  const reloaders = useRef({ tasks: api.reload, habits: habitsApi.reload, shared: sharedApi.reload });
  reloaders.current = { tasks: api.reload, habits: habitsApi.reload, shared: sharedApi.reload };

  /**
   * Something changed on the server (a push arrived or was tapped, or the app came
   * back): reload shared habits, friends and rooms now instead of waiting for the
   * live connection, which Android pauses in the background (1.9.1).
   */
  const refreshSocial = useCallback(() => {
    reloaders.current.shared().catch(() => {});
    setReloadKey((k) => k + 1);
  }, []);

  /** Re-read everything a widget, a notification button or a restore may have changed. */
  const reloadAll = useCallback(async () => {
    const [, , f, st] = await Promise.all([reloaders.current.tasks(), reloaders.current.habits(), loadFocus(), loadSettings()]);
    setFocusState(f);
    setSettings(st);
  }, []);

  /** Pull the backup, merge, push. Reloads the screen if the backup brought anything new. */
  const runSync = useCallback(async () => {
    setAccount((a) => ({ ...a, syncing: true }));
    const r = await syncNow();
    if (r.ok && r.changedLocal) await reloadAll();
    const meta = await loadMeta();
    setAccount((a) => ({
      ...a,
      syncing: false,
      lastSync: meta.lastSync,
      error: r.ok || r.reason === 'signed-out' ? null : `No se pudo respaldar: ${r.message}`,
    }));
  }, [reloadAll]);

  // Session: restore it on launch and follow sign-in / sign-out.
  useEffect(() => {
    getSession().then((sess) => {
      setAccount((a) => ({ ...a, email: sess?.user.email ?? null }));
      if (sess) runSync();
    });
    const { data } = supabase.auth.onAuthStateChange((_event, sess) => {
      setAccount((a) => ({ ...a, email: sess?.user.email ?? null }));
    });
    return () => data.subscription.unsubscribe();
  }, [runSync]);

  // Today's progress, shared with friends (only minutes, never task titles).
  const today = progressOf(api.todayTasks);
  const focusTask = api.tasks.find((t) => t.id === focus.taskId && !t.done);
  const focusUntil = focusTask && focus.endsAt !== null && focus.endsAt > Date.now() ? focus.endsAt : null;
  const mine = { done: today.done, total: today.total, focusUntil };
  // Your recent days as friends see them (minutes only). The key keeps the effect quiet when nothing changed.
  const history = useMemo(() => historyOf(api.tasks, undefined, api.today), [api.tasks, api.today]);
  const historyKey = useMemo(() => history.map((d) => `${d.day}:${d.done}/${d.total}`).join(','), [history]);
  const historyRef = useRef(history);
  historyRef.current = history;

  useEffect(() => {
    if (!ready || !account.email) return;
    const id = setTimeout(() => publishProgress(mine, historyRef.current), 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, account.email, mine.done, mine.total, mine.focusUntil, historyKey]);

  // Server push: register this phone under the account and keep the server's switch in step with Settings.
  const refreshPush = useCallback(async (force = false) => {
    setPush(await registerPush(force));
  }, []);

  useEffect(() => {
    if (!ready || !account.email) {
      setPush({ state: account.email ? 'checking' : 'signed-out' });
      return;
    }
    refreshPush();
  }, [ready, account.email, refreshPush]);

  useEffect(() => {
    if (!ready || !account.email) return;
    savePushPrefs({ friends: settings.remindFriends, habits: settings.remindShared }).catch(() => {});
  }, [ready, account.email, settings.remindFriends, settings.remindShared]);

  useEffect(() => {
    if (!ready || !account.email) return;
    syncProfile(settings.name, settings.gender).catch(() => {});
  }, [ready, account.email, settings.name, settings.gender]);

  // Right after an account appears (1.9): a new one without a username gets the
  // three onboarding steps; an existing one just gets the notification prompt.
  useEffect(() => {
    if (!ready || !account.email) {
      setOnboarding(null);
      return;
    }
    let live = true;
    (async () => {
      const session = await getSession();
      if (!session || !live) return;
      const key = onboardKey(session.user.id);
      if (await AsyncStorage.getItem(key).catch(() => null)) return;
      const profile = await getMyProfile().catch(() => undefined);
      if (!live || profile === undefined) return; // offline: ask again next time
      if (profile) {
        await AsyncStorage.setItem(key, 'existing').catch(() => {});
        requestNotificationPermission();
        return;
      }
      setOnboarding({ userId: session.user.id, username: null });
    })();
    return () => {
      live = false;
    };
  }, [ready, account.email]);

  // A newer MRitmo on mritmo.com (1.9): what we knew, then ask (at most every few hours).
  useEffect(() => {
    if (!ready) return;
    cachedUpdate().then(setRelease);
    checkForUpdate().then(setRelease);
  }, [ready]);

  // Back up a few seconds after any change, when signed in.
  useEffect(() => {
    if (!ready || !account.email) return;
    scheduleSync((r) => {
      loadMeta().then((m) => setAccount((a) => ({ ...a, lastSync: m.lastSync, error: r.ok ? null : a.error })));
    });
  }, [ready, account.email, api.tasks, habitsApi.habits, settings]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        await onAppForeground();
        await reloadAll();
        checkForUpdate().then(setRelease);
        refreshSocial();
        if (await getSession()) {
          runSync();
          refreshPush();
        }
      } else if (state === 'background') {
        onAppBackground(snapRef.current);
      }
    });
    return () => sub.remove();
  }, [reloadAll, runSync, refreshPush, refreshSocial]);

  // ritmo://hoy, ritmo://foco, ritmo://resumen and ritmo://nueva come from widgets and notifications.
  // https://mritmo.com/u/<usuario> (Android App Link) and ritmo://agregar/<usuario> open "Agregar a @usuario".
  const route = useCallback((url: string | null | undefined) => {
    if (!url) return;
    const web = url.match(/^https:\/\/(?:www\.)?mritmo\.com\/u\/([^/?#]+)/i);
    if (web) url = `ritmo://agregar/${web[1]}`;
    if (!url.startsWith('ritmo://')) return;
    if (url.startsWith('ritmo://auth')) {
      // A link from an account email opened the app: activation, sign-in, or password reset.
      handleAuthUrl(url).then((r) => {
        if (!r) return;
        if (r.ok) runSync();
        if (r.ok && !r.recovery) {
          // Activation or sign-in link: you're in. Close "Revisa tu correo" if it was open.
          setAuthMode(null);
          setAuthStep('form');
          setAuthError(null);
          // Notifications are asked for by onboarding (new accounts) or right after it's skipped.
          return;
        }
        setShowSettings(false);
        setAuthStep(r.ok ? 'newPassword' : 'form');
        setAuthError(r.ok ? null : r.message);
        setAuthMode('signin');
      });
      return;
    }
    const [path, param] = url.replace(/^ritmo:\/\//, '').split(/[?#]/)[0].split('/');
    setShowSettings(false);
    setFocusFull(false);
    if (path === 'foco') {
      setTab('foco');
      // ritmo://foco/completo comes from tapping the live timer (chip, Now Bar).
      if (param === 'completo') setFocusFull(true);
    }
    else if (path === 'amigos') {
      setTab('amigos');
      // ritmo://amigos/<id> opens that friend's sheet (e.g. "X aceptó tu solicitud").
      if (param && /^[0-9a-f-]{36}$/i.test(param)) setOpenFriendId(param);
    }
    else if (path === 'agregar' && param) {
      setTab('amigos');
      lastInvite.current = decodeURIComponent(param);
      setAddUsername(decodeURIComponent(param));
    } else if (path === 'salas' && param && /^[0-9a-f-]{36}$/i.test(param)) {
      setTab('amigos');
      setOpenRoomId(param);
    }
    else if (path === 'resumen') setTab('resumen');
    else if (path === 'nueva') {
      setTab('hoy');
      setAdding(true);
    } else if (path === 'hoy') setTab('hoy');
  }, [runSync]);

  useEffect(() => {
    Linking.getInitialURL().then(route).catch(() => {});
    const linkSub = Linking.addEventListener('url', (e) => route(e.url));
    let notifSub: { remove: () => void } | null = null;
    let receivedSub: { remove: () => void } | null = null;
    if (Platform.OS !== 'web') {
      const onResponse = async (r: Notifications.NotificationResponse) => {
        const data = (r.notification.request.content.data ?? {}) as { url?: string; taskId?: string; habitId?: string; sharedId?: string; roomId?: string };
        if (r.actionIdentifier && r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
          await applyAction(r.actionIdentifier, data);
          await reloadAll();
          Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(() => {});
        } else {
          refreshSocial();
          route(data.url);
        }
      };
      // A push from the server while MRitmo is open: show the change right away (1.9.1).
      receivedSub = Notifications.addNotificationReceivedListener((n) => {
        const kind = (n.request.content.data as { kind?: string } | undefined)?.kind ?? '';
        if (/^(habit_|friend_|room_)/.test(kind)) refreshSocial();
      });
      Notifications.getLastNotificationResponseAsync()
        .then((r) => r && r.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER && route((r.notification.request.content.data as { url?: string })?.url))
        .catch(() => {});
      notifSub = Notifications.addNotificationResponseReceivedListener(onResponse);
    }
    return () => {
      linkSub.remove();
      notifSub?.remove();
      receivedSub?.remove();
    };
  }, [route, reloadAll, refreshSocial]);

  // Light is white or cream, dark is black or tinto (1.9.1).
  const c = paletteFor(settings.theme, system === 'dark' ? 'dark' : 'light', settings.lightTone, settings.darkTone);
  const scheme = c.scheme;

  const theme = useMemo(
    () => ({ c, pref: settings.theme, setPref: (p: ThemePref) => update({ theme: p }) }),
    [c, settings.theme, update],
  );

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c.bg]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  const closeAuth = () => {
    setAuthMode(null);
    setAuthStep('form');
    setAuthError(null);
  };

  const openFocus = (id: string) => {
    const t = api.tasks.find((x) => x.id === id);
    if (!t) return;
    if (focus.taskId !== id) {
      const total = t.minutes * 60_000;
      setFocus({ taskId: id, endsAt: null, remaining: total, total, started: false });
    }
    setTab('foco');
  };

  const onAdd = (item: NewItem) => {
    if (item.kind === 'habit') habitsApi.add(item.title, item.time);
    else api.add(item.title, item.minutes, item.day, item.at);
  };

  if (!settings.onboarded) {
    return (
      <SafeAreaProvider>
        <ThemeContext.Provider value={theme}>
          <Welcome initial={settings} onDone={update} onSignIn={() => setAuthMode('signin')} />
          <AuthSheet
            visible={authMode !== null}
            initialMode={authMode ?? 'signin'}
            initialStep={authStep}
            initialError={authError}
            onClose={closeAuth}
            onSignedIn={runSync}
          />
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        </ThemeContext.Provider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={theme}>
        <BlurTargetContext.Provider value={target}>
          <View style={{ flex: 1, backgroundColor: c.bg }}>
            <BlurTargetView ref={target} style={{ flex: 1, backgroundColor: c.bg }}>
              {tab === 'hoy' && (
                <Today
                  api={api}
                  habitsApi={habitsApi}
                  sharedApi={sharedApi}
                  gender={settings.gender}
                  name={settings.name}
                  onAdd={() => setAdding(true)}
                  onFocus={openFocus}
                  onConfirm={setConfirm}
                  onActions={setActions}
                  onEdit={(e) => {
                    setEditing(e);
                    setAdding(true);
                  }}
                  banner={<UpdateBanner update={release} onDismiss={(v) => dismissUpdate(v).then(setRelease)} />}
                />
              )}
              {tab === 'foco' && <Focus api={api} focus={focus} setFocus={setFocus} full={focusFull} onFull={setFocusFull} />}
              {tab === 'amigos' && (
                <Friends
                  signedIn={Boolean(account.email)}
                  name={settings.name}
                  gender={settings.gender}
                  mine={mine}
                  onAuth={(m) => setAuthMode(m)}
                  onConfirm={setConfirm}
                  onProfileReady={() => publishProgress(mine, history)}
                  history={history}
                  openFriendId={openFriendId}
                  onFriendOpened={() => setOpenFriendId(null)}
                  sharedApi={sharedApi}
                  openRoomId={openRoomId}
                  onRoomOpened={() => setOpenRoomId(null)}
                  addUsername={addUsername}
                  onAddHandled={() => setAddUsername(null)}
                  today={api.today}
                  reloadKey={reloadKey}
                />
              )}
              {tab === 'resumen' && <Summary api={api} habits={habitsApi.habits} name={settings.name} onOpenSettings={() => setShowSettings(true)} />}
            </BlurTargetView>
            {!showSettings && !onboarding && (
              <NavBar
                tab={tab}
                onTab={setTab}
                onAdd={() => {
                  setEditing(null);
                  setAdding(true);
                }}
              />
            )}
            {showSettings && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <SettingsScreen
                  settings={settings}
                  update={update}
                  onClose={() => setShowSettings(false)}
                  account={account}
                  onAuth={(m) => setAuthMode(m)}
                  onSignOut={() =>
                    setConfirm({
                      title: '¿Cerrar sesión?',
                      subject: account.email ?? '',
                      detail: 'Tus datos se quedan en este teléfono y en tu respaldo.',
                      confirmLabel: 'Cerrar sesión',
                      destructive: true,
                      onConfirm: async () => {
                        await unregisterPush().catch(() => {});
                        await signOut();
                        await clearSharedCache();
                        await clearFriendsCache();
                        setAccount({ email: null, syncing: false });
                      },
                    })
                  }
                  onSyncNow={runSync}
                  push={push}
                  onPushRetry={() => refreshPush(true)}
                  onDeleteAccount={() => {
                    countOwnedRooms().then(setOwnedRooms).catch(() => {});
                    setDeleting(true);
                  }}
                  release={release}
                  onCheckUpdate={async () => setRelease(await checkForUpdate(true))}
                  onPrivacyChanged={() => setReloadKey((k) => k + 1)}
                />
              </View>
            )}
            {onboarding && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <Onboarding
                  name={settings.name}
                  gender={settings.gender}
                  username={onboarding.username}
                  invitedBy={lastInvite.current}
                  onProfileReady={() => {
                    publishProgress(mine, history);
                    setReloadKey((k) => k + 1);
                  }}
                  onDone={(toFriends) => {
                    AsyncStorage.setItem(onboardKey(onboarding.userId), 'done').catch(() => {});
                    setOnboarding(null);
                    setReloadKey((k) => k + 1);
                    if (toFriends) setTab('amigos');
                  }}
                />
              </View>
            )}
            <AddSheet
              visible={adding}
              editing={editing}
              onClose={() => {
                setAdding(false);
                setTimeout(() => setEditing(null), 260);
              }}
              onAdd={onAdd}
              onSave={(id, item) => {
                if (item.kind === 'habit') habitsApi.update(id, { title: item.title, time: item.time });
                else api.update(id, { title: item.title, minutes: item.minutes, day: item.day, at: item.at });
              }}
            />
            <ActionsSheet request={actions} onClose={() => setActions(null)} />
            <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
            <DeleteAccountSheet
              visible={deleting}
              email={account.email}
              ownsRooms={ownedRooms}
              onClose={() => setDeleting(false)}
              onDelete={async (word) => {
                const session = await getSession();
                await deleteAccount(word);
                // The server is clean; now this phone forgets the account (its tasks stay).
                await forgetPush();
                await forgetSession();
                await clearSharedCache();
                await clearFriendsCache();
                if (session) await AsyncStorage.removeItem(onboardKey(session.user.id)).catch(() => {});
                setAccount({ email: null, syncing: false });
              }}
            />
            <AuthSheet
              visible={authMode !== null}
              initialMode={authMode ?? 'signup'}
              initialStep={authStep}
              initialError={authError}
              onClose={closeAuth}
              onSignedIn={runSync}
            />
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          </View>
        </BlurTargetContext.Provider>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}
