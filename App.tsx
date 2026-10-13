import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { BlurTargetView } from 'expo-blur';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AddSheet } from './src/components/AddSheet';
import { BlurTargetContext } from './src/components/Glass';
import { NavBar, Tab } from './src/components/NavBar';
import { defaultSettings, emptyFocus, FocusState, loadFocus, loadSettings, saveFocus, saveSettings, Settings, ThemePref } from './src/data';
import { configureNotifications, refreshWidgets, syncFocus, syncReminders } from './src/effects';
import { Focus } from './src/screens/Focus';
import { SettingsScreen } from './src/screens/Settings';
import { Summary } from './src/screens/Summary';
import { Today } from './src/screens/Today';
import { Welcome } from './src/screens/Welcome';
import { useTasks } from './src/store';
import { palettes, ThemeContext } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotifications();

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const system = useColorScheme();
  const api = useTasks();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('hoy');
  const [adding, setAdding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [focus, setFocusState] = useState<FocusState>(emptyFocus);
  const target = useRef<View>(null);
  const tasksRef = useRef(api.tasks);
  tasksRef.current = api.tasks;

  useEffect(() => {
    Promise.all([loadSettings(), loadFocus()]).then(([s, f]) => {
      setSettings(s);
      setFocusState(f);
      setSettingsLoaded(true);
      syncReminders(s);
    });
  }, []);

  /** Every focus change is persisted and mirrored to the live notification and widgets. */
  const setFocus = useCallback((f: FocusState) => {
    setFocusState(f);
    saveFocus(f).then(() => {
      syncFocus(f, tasksRef.current);
      refreshWidgets();
    });
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next).then(() => {
        syncReminders(next);
        refreshWidgets();
      });
      return next;
    });
  }, []);

  // A widget can start, pause or finish a task while the app is closed: re-read on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      const [tasks, f] = await Promise.all([api.reload(), loadFocus()]);
      setFocusState(f);
      syncFocus(f, tasks);
    });
    return () => sub.remove();
  }, [api]);

  // Keep the live notification honest when a task is completed or deleted from a list.
  useEffect(() => {
    if (settingsLoaded && api.ready) syncFocus(focus, api.tasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.tasks]);

  // ritmo://hoy, ritmo://foco and ritmo://nueva come from widgets and notifications.
  useEffect(() => {
    const route = (url: string | null | undefined) => {
      if (!url) return;
      const path = url.replace(/^ritmo:\/\//, '').split(/[?#/]/)[0];
      setShowSettings(false);
      if (path === 'foco') setTab('foco');
      else if (path === 'resumen') setTab('resumen');
      else if (path === 'nueva') {
        setTab('hoy');
        setAdding(true);
      } else if (path === 'hoy') setTab('hoy');
    };
    Linking.getInitialURL().then(route).catch(() => {});
    const linkSub = Linking.addEventListener('url', (e) => route(e.url));
    let notifSub: { remove: () => void } | null = null;
    if (Platform.OS !== 'web') {
      notifSub = Notifications.addNotificationResponseReceivedListener((r) => {
        route(r.notification.request.content.data?.url as string | undefined);
      });
    }
    return () => {
      linkSub.remove();
      notifSub?.remove();
    };
  }, []);

  const scheme = settings.theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : settings.theme;
  const c = palettes[scheme];

  const theme = useMemo(
    () => ({ c, pref: settings.theme, setPref: (p: ThemePref) => update({ theme: p }) }),
    [c, settings.theme, update],
  );

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c.bg]);

  const ready = fontsLoaded && api.ready && settingsLoaded;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  const openFocus = (id: string) => {
    const t = api.tasks.find((x) => x.id === id);
    if (!t) return;
    if (focus.taskId !== id) setFocus({ taskId: id, endsAt: null, remaining: t.minutes * 60_000 });
    setTab('foco');
  };

  if (!settings.onboarded) {
    return (
      <SafeAreaProvider>
        <ThemeContext.Provider value={theme}>
          <Welcome initial={settings} onDone={update} />
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
              {tab === 'hoy' && <Today api={api} gender={settings.gender} name={settings.name} onAdd={() => setAdding(true)} onFocus={openFocus} />}
              {tab === 'foco' && <Focus api={api} focus={focus} setFocus={setFocus} />}
              {tab === 'resumen' && <Summary api={api} name={settings.name} onOpenSettings={() => setShowSettings(true)} />}
            </BlurTargetView>
            {!showSettings && <NavBar tab={tab} onTab={setTab} onAdd={() => setAdding(true)} />}
            {showSettings && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <SettingsScreen settings={settings} update={update} onClose={() => setShowSettings(false)} />
              </View>
            )}
            <AddSheet visible={adding} onClose={() => setAdding(false)} onAdd={api.add} />
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          </View>
        </BlurTargetContext.Provider>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}
