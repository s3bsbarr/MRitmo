import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { BlurTargetView } from 'expo-blur';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AddSheet } from './src/components/AddSheet';
import { BlurTargetContext } from './src/components/Glass';
import { NavBar, Tab } from './src/components/NavBar';
import { emptyFocus, Focus, FocusState } from './src/screens/Focus';
import { Summary } from './src/screens/Summary';
import { Today } from './src/screens/Today';
import { Gender } from './src/avatar/Avatar';
import { readAvatar, readThemePref, useTasks, writeAvatar, writeThemePref } from './src/store';
import { palettes, ThemeContext, ThemePref } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');
  const [prefLoaded, setPrefLoaded] = useState(false);
  const api = useTasks();
  const [tab, setTab] = useState<Tab>('hoy');
  const [adding, setAdding] = useState(false);
  const [focus, setFocus] = useState<FocusState>(emptyFocus);
  const target = useRef<View>(null);
  const [gender, setGenderState] = useState<Gender>('m');

  useEffect(() => {
    Promise.all([readThemePref(), readAvatar()]).then(([p, g]) => {
      if (p) setPrefState(p);
      if (g) setGenderState(g);
      setPrefLoaded(true);
    });
  }, []);

  const setGender = (g: Gender) => {
    setGenderState(g);
    writeAvatar(g);
  };

  const scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const c = palettes[scheme];

  const theme = useMemo(
    () => ({
      c,
      pref,
      setPref: (p: ThemePref) => {
        setPrefState(p);
        writeThemePref(p);
      },
    }),
    [c, pref],
  );

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c.bg]);

  const ready = fontsLoaded && api.ready && prefLoaded;
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

  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={theme}>
        <BlurTargetContext.Provider value={target}>
          <View style={{ flex: 1, backgroundColor: c.bg }}>
            <BlurTargetView ref={target} style={{ flex: 1, backgroundColor: c.bg }}>
              {tab === 'hoy' && <Today api={api} gender={gender} onAdd={() => setAdding(true)} onFocus={openFocus} />}
              {tab === 'foco' && <Focus api={api} focus={focus} setFocus={setFocus} />}
              {tab === 'resumen' && <Summary api={api} gender={gender} setGender={setGender} />}
            </BlurTargetView>
            <NavBar tab={tab} onTab={setTab} onAdd={() => setAdding(true)} />
            <AddSheet visible={adding} onClose={() => setAdding(false)} onAdd={api.add} />
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          </View>
        </BlurTargetContext.Provider>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}
