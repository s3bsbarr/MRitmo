import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { BlurTargetView } from 'expo-blur';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyAction, resyncAll } from './src/actions';
import { AddSheet, NewItem } from './src/components/AddSheet';
import { AuthSheet } from './src/components/AuthSheet';
import { ConfirmRequest, ConfirmSheet } from './src/components/ConfirmSheet';
import { BlurTargetContext } from './src/components/Glass';
import { NavBar, Tab } from './src/components/NavBar';
import { defaultSettings, emptyFocus, FocusState, loadFocus, loadMeta, loadSettings, saveFocus, saveSettings, Settings, ThemePref } from './src/data';
import { configureNotifications, onAppBackground, onAppForeground, requestNotificationPermission } from './src/effects';
import { Focus } from './src/screens/Focus';
import { AccountInfo, SettingsScreen } from './src/screens/Settings';
import { Summary } from './src/screens/Summary';
import { Today } from './src/screens/Today';
import { Welcome } from './src/screens/Welcome';
import { useHabits, useTasks } from './src/store';
import { getSession, handleAuthUrl, scheduleSync, signOut, supabase, syncNow } from './src/sync';
import { palettes, ThemeContext } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotifications();

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
  const [focus, setFocusState] = useState<FocusState>(emptyFocus);
  const target = useRef<View>(null);
  const [account, setAccount] = useState<AccountInfo>({ email: null, syncing: false });
  const [authMode, setAuthMode] = useState<'signup' | 'signin' | null>(null);

  const snapRef = useRef({ tasks: api.tasks, habits: habitsApi.habits, focus, settings });
  snapRef.current = { tasks: api.tasks, habits: habitsApi.habits, focus, settings };

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
  }, [ready, api.tasks, habitsApi.habits, focus, settings]);

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
  const reloaders = useRef({ tasks: api.reload, habits: habitsApi.reload });
  reloaders.current = { tasks: api.reload, habits: habitsApi.reload };

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
        if (await getSession()) runSync();
      } else if (state === 'background') {
        onAppBackground(snapRef.current);
      }
    });
    return () => sub.remove();
  }, [reloadAll, runSync]);

  // ritmo://hoy, ritmo://foco, ritmo://resumen and ritmo://nueva come from widgets and notifications.
  const route = useCallback((url: string | null | undefined) => {
    if (!url || !url.startsWith('ritmo://')) return;
    if (url.startsWith('ritmo://auth')) {
      // Email confirmation or password reset link opened the app.
      handleAuthUrl(url).then((ok) => {
        if (ok) runSync();
      });
      return;
    }
    const path = url.replace(/^ritmo:\/\//, '').split(/[?#/]/)[0];
    setShowSettings(false);
    if (path === 'foco') setTab('foco');
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
    if (Platform.OS !== 'web') {
      const onResponse = async (r: Notifications.NotificationResponse) => {
        const data = (r.notification.request.content.data ?? {}) as { url?: string; taskId?: string; habitId?: string };
        if (r.actionIdentifier && r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
          await applyAction(r.actionIdentifier, data);
          await reloadAll();
          Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(() => {});
        } else route(data.url);
      };
      Notifications.getLastNotificationResponseAsync()
        .then((r) => r && r.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER && route((r.notification.request.content.data as { url?: string })?.url))
        .catch(() => {});
      notifSub = Notifications.addNotificationResponseReceivedListener(onResponse);
    }
    return () => {
      linkSub.remove();
      notifSub?.remove();
    };
  }, [route, reloadAll]);

  const scheme = settings.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : settings.theme;
  const c = palettes[scheme];

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
            onClose={() => setAuthMode(null)}
            onSignedIn={async () => {
              await runSync();
              requestNotificationPermission();
            }}
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
                  gender={settings.gender}
                  name={settings.name}
                  onAdd={() => setAdding(true)}
                  onFocus={openFocus}
                  onConfirm={setConfirm}
                />
              )}
              {tab === 'foco' && <Focus api={api} focus={focus} setFocus={setFocus} />}
              {tab === 'resumen' && <Summary api={api} habits={habitsApi.habits} name={settings.name} onOpenSettings={() => setShowSettings(true)} />}
            </BlurTargetView>
            {!showSettings && <NavBar tab={tab} onTab={setTab} onAdd={() => setAdding(true)} />}
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
                      onConfirm: () => {
                        signOut();
                        setAccount({ email: null, syncing: false });
                      },
                    })
                  }
                  onSyncNow={runSync}
                />
              </View>
            )}
            <AddSheet visible={adding} onClose={() => setAdding(false)} onAdd={onAdd} />
            <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
            <AuthSheet visible={authMode !== null} initialMode={authMode ?? 'signup'} onClose={() => setAuthMode(null)} onSignedIn={runSync} />
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          </View>
        </BlurTargetContext.Provider>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}
