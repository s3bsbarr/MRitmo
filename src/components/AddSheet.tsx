import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { atTime, dayKey, shiftDay } from '../data';
import { dayChip, formatMinutes, hhmmLabel } from '../format';
import { font, radius, space, type, useTheme } from '../theme';
import { Press } from './Press';
import { Sheet } from './Sheet';
import { TimeField } from './TimeField';

const PRESETS = [15, 30, 45, 60, 90, 120];

export type NewItem =
  | { kind: 'task'; title: string; minutes: number; day: string; at?: number }
  | { kind: 'habit'; title: string; time?: string };

type Props = { visible: boolean; onClose: () => void; onAdd: (item: NewItem) => void };

/** Next half hour from now, "HH:MM". */
function nextSlot() {
  const d = new Date(Date.now() + 30 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function clampInt(text: string, min: number, max: number) {
  const n = parseInt(text, 10);
  if (Number.isNaN(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

function Label({ children }: { children: string }) {
  const { c } = useTheme();
  return <Text style={[type.caption, { color: c.textSecondary, marginTop: space.xl, marginBottom: space.md }]}>{children}</Text>;
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Press
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{ paddingHorizontal: space.lg, height: 40, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: active ? c.ink : c.surface }}
    >
      <Text style={[type.callout, { color: active ? c.inkOnInk : c.text, fontVariant: ['tabular-nums'] }]}>{label}</Text>
    </Press>
  );
}

export function AddSheet({ visible, onClose, onAdd }: Props) {
  const { c } = useTheme();
  const input = useRef<TextInput>(null);
  const today = dayKey();

  const [title, setTitle] = useState('');
  const [hText, setHText] = useState('0');
  const [mText, setMText] = useState('30');
  const [habit, setHabit] = useState(false);
  const [whenOpen, setWhenOpen] = useState(false);
  const [day, setDay] = useState(today);
  const [hasTime, setHasTime] = useState(false);
  const [time, setTime] = useState(nextSlot());

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setHText('0');
    setMText('30');
    setHabit(false);
    setWhenOpen(false);
    setDay(dayKey());
    setHasTime(false);
    setTime(nextSlot());
  }, [visible]);

  const minutes = clampInt(hText, 0, 23) * 60 + clampInt(mText, 0, 59);
  const setMinutes = (total: number) => {
    setHText(String(Math.floor(total / 60)));
    setMText(String(total % 60));
  };

  const isNow = day === today && !hasTime;
  const whenSummary = habit
    ? hasTime
      ? `Todos los días · ${hhmmLabel(time)}`
      : 'Sin recordatorio'
    : isNow
      ? 'Ahora'
      : `${dayChip(day, today)}${hasTime ? ` · ${hhmmLabel(time)}` : ''}`;

  const canAdd = title.trim().length > 0 && (habit || minutes > 0);
  const submit = () => {
    if (!canAdd) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (habit) onAdd({ kind: 'habit', title: title.trim(), time: hasTime ? time : undefined });
    else onAdd({ kind: 'task', title: title.trim(), minutes, day, at: hasTime ? atTime(day, time) : undefined });
    onClose();
  };

  const days = Array.from({ length: 7 }, (_, i) => shiftDay(today, i));

  return (
    <Sheet visible={visible} onClose={onClose} onOpened={() => input.current?.focus()}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[type.title, { color: c.text, marginBottom: space.lg }]}>{habit ? 'Nuevo hábito' : 'Nueva tarea'}</Text>

        <TextInput
          ref={input}
          value={title}
          onChangeText={setTitle}
          placeholder={habit ? '¿Qué quieres hacer cada día?' : '¿Qué vas a hacer?'}
          placeholderTextColor={c.textTertiary}
          selectionColor={c.ink}
          cursorColor={c.ink}
          returnKeyType="done"
          enterKeyHint="done"
          onSubmitEditing={submit}
          maxLength={120}
          style={{
            fontFamily: font.regular,
            fontSize: 18,
            letterSpacing: -0.25,
            color: c.text,
            backgroundColor: c.surface,
            borderRadius: radius.md,
            paddingHorizontal: space.lg,
            paddingVertical: 14,
          }}
        />

        <Press
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setHabit(!habit);
          }}
          scaleTo={0.99}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: habit }}
          style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.lg, paddingVertical: space.sm, gap: space.md }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              borderWidth: habit ? 0 : 1.6,
              borderColor: c.textTertiary,
              backgroundColor: habit ? c.ink : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {habit && <Ionicons name="checkmark" size={16} color={c.inkOnInk} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { color: c.text }]}>Repetir todos los días</Text>
            <Text style={[type.footnote, { color: c.textSecondary }]}>Se vuelve un hábito con racha. No cuenta en el % del día.</Text>
          </View>
        </Press>

        {!habit && (
          <Animated.View entering={FadeIn.duration(180)}>
            <Label>DURACIÓN</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {PRESETS.map((p) => (
                <Pill key={p} label={formatMinutes(p)} active={p === minutes} onPress={() => setMinutes(p)} />
              ))}
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: space.md,
                backgroundColor: c.surface,
                borderRadius: radius.md,
                paddingLeft: space.lg,
                paddingRight: space.sm,
                height: 56,
              }}
            >
              <Text style={[type.callout, { color: c.textSecondary }]}>Personalizada</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <NumberField value={hText} onChange={setHText} max={23} label="Horas" />
                <Text style={[type.callout, { color: c.textSecondary, marginRight: space.sm }]}>h</Text>
                <NumberField value={mText} onChange={setMText} max={59} label="Minutos" />
                <Text style={[type.callout, { color: c.textSecondary, marginRight: space.xs }]}>min</Text>
              </View>
            </View>
          </Animated.View>
        )}

        <Label>{habit ? 'RECORDATORIO' : 'CUÁNDO'}</Label>
        <Press
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setWhenOpen(!whenOpen);
          }}
          scaleTo={0.99}
          accessibilityRole="button"
          accessibilityState={{ expanded: whenOpen }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: c.surface,
            borderRadius: radius.md,
            paddingHorizontal: space.lg,
            height: 52,
          }}
        >
          <Ionicons name={habit ? 'notifications-outline' : 'time-outline'} size={19} color={c.textSecondary} />
          <Text style={[type.body, { color: c.text, flex: 1, marginLeft: space.md }]}>{whenSummary}</Text>
          <Ionicons name={whenOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.textTertiary} />
        </Press>

        {whenOpen && (
          <Animated.View entering={FadeIn.duration(180)} style={{ marginTop: space.md, gap: space.md }}>
            {!habit && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                {days.map((d) => (
                  <Pill key={d} label={dayChip(d, today)} active={d === day} onPress={() => setDay(d)} />
                ))}
              </ScrollView>
            )}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Pill label={habit ? 'Sin recordatorio' : 'Sin hora'} active={!hasTime} onPress={() => setHasTime(false)} />
              <Pill label={habit ? 'Recordarme' : 'A una hora'} active={hasTime} onPress={() => setHasTime(true)} />
            </View>
            {hasTime && <TimeField value={time} onChange={setTime} />}
          </Animated.View>
        )}

        <Press
          onPress={submit}
          disabled={!canAdd}
          accessibilityRole="button"
          style={{
            marginTop: space.xl,
            height: 54,
            borderRadius: radius.pill,
            backgroundColor: c.ink,
            opacity: canAdd ? 1 : 0.3,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={[type.headline, { color: c.inkOnInk }]}>
            {habit ? 'Crear hábito' : minutes > 0 ? `${isNow ? 'Agregar' : 'Programar'} · ${formatMinutes(minutes)}` : 'Agregar'}
          </Text>
        </Press>
      </ScrollView>
    </Sheet>
  );
}

/** Free numeric entry: any hour from 0 to 23 and any minute from 0 to 59. */
function NumberField({ value, onChange, max, label }: { value: string; onChange: (v: string) => void; max: number; label: string }) {
  const { c } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={(t) => {
        const digits = t.replace(/[^0-9]/g, '').slice(0, 2);
        onChange(digits === '' ? '' : String(Math.min(max, parseInt(digits, 10))));
      }}
      onBlur={() => value === '' && onChange('0')}
      keyboardType="number-pad"
      inputMode="numeric"
      selectTextOnFocus
      maxLength={2}
      accessibilityLabel={label}
      selectionColor={c.ink}
      cursorColor={c.ink}
      style={{
        fontFamily: font.semibold,
        fontSize: 18,
        letterSpacing: -0.3,
        color: c.text,
        backgroundColor: c.bg,
        borderRadius: radius.sm,
        width: 52,
        height: 40,
        textAlign: 'center',
        paddingVertical: 0,
        fontVariant: ['tabular-nums'],
      }}
    />
  );
}
