import * as Haptics from '../haptics';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../avatar/Avatar';
import type { Mood } from '../avatar/sprites';
import { Press } from '../components/Press';
import type { Gender, Settings } from '../data';
import { requestNotificationPermission } from '../effects';
import { font, radius, space, type, useTheme } from '../theme';

const STAGES: { mood: Mood; pct: string; text: string }[] = [
  { mood: 'sueno', pct: '0 %', text: 'Duerme' },
  { mood: 'calma', pct: '1 %', text: 'Despierta' },
  { mood: 'foco', pct: '50 %', text: 'Se levanta' },
  { mood: 'fuerza', pct: '100 %', text: 'Celebra' },
];

/** First launch: how Ritmo measures a day, your name, your character. */
export function Welcome({ initial, onDone, onSignIn }: { initial: Settings; onDone: (patch: Partial<Settings>) => void; onSignIn: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial.name);
  const [gender, setGender] = useState<Gender>(initial.gender);

  const next = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    await requestNotificationPermission();
    onDone({ name: name.trim(), gender, onboarded: true });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space.xxxl, paddingHorizontal: space.xl, paddingBottom: space.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[type.footnote, { color: c.textTertiary, fontVariant: ['tabular-nums'] }]}>{step + 1} de 3</Text>

        <Animated.View key={step} entering={FadeIn.duration(240)} style={{ flex: 1 }}>
          {step === 0 && (
            <>
              <Text style={[type.largeTitle, { color: c.text, marginTop: space.md }]}>Tu día, medido en tiempo.</Text>
              <Text style={[type.body, { color: c.textSecondary, marginTop: space.md }]}>
                Cada tarea lleva lo que te va a tomar. Tu avance es la parte del tiempo planeado que ya cumpliste, así una tarea de dos horas pesa más que una de quince minutos.
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xxxl }}>
                {STAGES.map((s) => (
                  <View key={s.mood} style={{ alignItems: 'center' }}>
                    <Avatar gender={gender} mood={s.mood} px={3} />
                    <Text style={[type.headline, { color: c.text, marginTop: space.sm, fontVariant: ['tabular-nums'] }]}>{s.pct}</Text>
                    <Text style={[type.footnote, { color: c.textSecondary }]}>{s.text}</Text>
                  </View>
                ))}
              </View>
              <Text style={[type.footnote, { color: c.textTertiary, marginTop: space.xl }]}>
                Tu personaje refleja tu día. El temporizador de Foco corre con la duración de cada tarea, y te avisamos cuando termina.
              </Text>
            </>
          )}

          {step === 1 && (
            <>
              <Text style={[type.largeTitle, { color: c.text, marginTop: space.md }]}>¿Cómo te llamas?</Text>
              <Text style={[type.body, { color: c.textSecondary, marginTop: space.md }]}>Lo usamos en tus recordatorios y cuando compartes tu día.</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                autoFocus
                placeholder="Tu nombre"
                placeholderTextColor={c.textTertiary}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="next"
                onSubmitEditing={next}
                maxLength={40}
                selectionColor={c.ink}
                cursorColor={c.ink}
                style={{
                  marginTop: space.xl,
                  fontFamily: font.regular,
                  fontSize: 20,
                  letterSpacing: -0.3,
                  color: c.text,
                  backgroundColor: c.surface,
                  borderRadius: radius.md,
                  paddingHorizontal: space.lg,
                  paddingVertical: 16,
                }}
              />
            </>
          )}

          {step === 2 && (
            <>
              <Text style={[type.largeTitle, { color: c.text, marginTop: space.md }]}>Elige tu personaje</Text>
              <Text style={[type.body, { color: c.textSecondary, marginTop: space.md }]}>Puedes cambiarlo cuando quieras en Configuración.</Text>
              <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.xl }} accessibilityRole="radiogroup">
                {(
                  [
                    ['m', 'Hombre'],
                    ['f', 'Mujer'],
                  ] as [Gender, string][]
                ).map(([g, label]) => {
                  const active = gender === g;
                  return (
                    <Press
                      key={g}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setGender(g);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={label}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        paddingVertical: space.xl,
                        borderRadius: radius.lg,
                        backgroundColor: c.surface,
                        borderWidth: 1.5,
                        borderColor: active ? c.ink : 'transparent',
                      }}
                    >
                      <Avatar gender={g} mood="fuerza" px={4} />
                      <Text style={[type.headline, { color: active ? c.text : c.textSecondary, marginTop: space.md }]}>{label}</Text>
                    </Press>
                  );
                })}
              </View>
            </>
          )}
        </Animated.View>

        <Press
          onPress={next}
          accessibilityRole="button"
          style={{ height: 56, borderRadius: radius.pill, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', marginBottom: step === 0 ? 0 : insets.bottom }}
        >
          <Text style={[type.headline, { color: c.inkOnInk }]}>{step < 2 ? 'Siguiente' : 'Empezar'}</Text>
        </Press>
        {step === 0 && (
          <Press onPress={onSignIn} accessibilityRole="button" style={{ alignSelf: 'center', padding: space.md, marginTop: space.xs, marginBottom: insets.bottom }}>
            <Text style={[type.callout, { color: c.textSecondary }]}>
              ¿Ya tienes cuenta? <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold' }}>Inicia sesión</Text>
            </Text>
          </Press>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
