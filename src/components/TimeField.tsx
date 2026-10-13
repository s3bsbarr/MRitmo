import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { font, radius, space, type, useTheme } from '../theme';
import { Press } from './Press';

function split(value: string) {
  const [h, m] = value.split(':').map(Number);
  const h24 = Number.isFinite(h) ? h : 9;
  return { h12: String(h24 % 12 || 12), mm: String(Number.isFinite(m) ? m : 0).padStart(2, '0'), pm: h24 >= 12 };
}

/**
 * Time entry in the app's own style: hour and minute as free fields plus an
 * a. m. / p. m. switch. Value is "HH:MM" in 24 h.
 */
export function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { c } = useTheme();
  const init = split(value);
  const [h, setH] = useState(init.h12);
  const [m, setM] = useState(init.mm);
  const [pm, setPm] = useState(init.pm);
  const lastEmitted = useRef(value);

  // Only adopt outside changes; our own emits must not rewrite what is being typed.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const s = split(value);
    setH(s.h12);
    setM(s.mm);
    setPm(s.pm);
  }, [value]);

  const emit = (hText: string, mText: string, isPm: boolean) => {
    const h12 = Math.min(12, Math.max(1, parseInt(hText, 10) || 12));
    const min = Math.min(59, Math.max(0, parseInt(mText, 10) || 0));
    const h24 = (h12 % 12) + (isPm ? 12 : 0);
    const next = `${String(h24).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    lastEmitted.current = next;
    onChange(next);
  };

  const field = (val: string, set: (v: string) => void, max: number, label: string, which: 'h' | 'm') => (
    <TextInput
      value={val}
      onChangeText={(t) => {
        const digits = t.replace(/[^0-9]/g, '').slice(0, 2);
        const next = digits === '' ? '' : String(Math.min(max, parseInt(digits, 10)));
        set(next);
        // Emit as you type, so the value is current even if the field never blurs.
        if (next !== '') emit(which === 'h' ? next : h, which === 'm' ? next : m, pm);
      }}
      onBlur={() => {
        if (which === 'm' && m.length === 1) setM(m.padStart(2, '0'));
        emit(h, m, pm);
      }}
      onSubmitEditing={() => emit(h, m, pm)}
      keyboardType="number-pad"
      inputMode="numeric"
      selectTextOnFocus
      maxLength={2}
      accessibilityLabel={label}
      selectionColor={c.ink}
      cursorColor={c.ink}
      style={{
        fontFamily: font.semibold,
        fontSize: 22,
        letterSpacing: -0.4,
        color: c.text,
        backgroundColor: c.bg,
        borderRadius: radius.sm,
        width: 58,
        height: 48,
        textAlign: 'center',
        paddingVertical: 0,
        fontVariant: ['tabular-nums'],
      }}
    />
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.md, padding: space.sm, gap: space.xs }}>
      {field(h, setH, 12, 'Hora', 'h')}
      <Text style={[type.title, { color: c.textSecondary }]}>:</Text>
      {field(m, setM, 59, 'Minutos', 'm')}
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', backgroundColor: c.bg, borderRadius: radius.sm, padding: 3 }} accessibilityRole="radiogroup">
        {[false, true].map((isPm) => {
          const active = pm === isPm;
          return (
            <Press
              key={String(isPm)}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setPm(isPm);
                emit(h, m, isPm);
              }}
              scaleTo={0.95}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={{ paddingHorizontal: space.md, height: 40, borderRadius: radius.sm - 2, justifyContent: 'center', backgroundColor: active ? c.ink : 'transparent' }}
            >
              <Text style={[type.callout, { color: active ? c.inkOnInk : c.textSecondary }]}>{isPm ? 'p. m.' : 'a. m.'}</Text>
            </Press>
          );
        })}
      </View>
    </View>
  );
}
