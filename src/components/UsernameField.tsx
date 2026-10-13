import { useRef } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { font, radius, space, useTheme } from '../theme';

/**
 * Usernames are a–z, 0–9, "." and "_". Capitals become lowercase and accents
 * are dropped (é → e, ñ → n) so what you see is exactly what gets saved.
 */
export function cleanUsername(raw: string) {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 20);
}

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  returnKeyType?: 'done' | 'send' | 'go';
  autoFocus?: boolean;
  accessibilityLabel?: string;
};

/**
 * @usuario input. Why it is special: Android keyboards (One UI's included)
 * compose words while you type; if the app rewrites the text mid-word — here,
 * lowercasing a capital — the keyboard re-inserts its composing word and the
 * text duplicates. `visible-password` turns composition off for this field,
 * so the rewrite is invisible, and the caret is put back where it was.
 */
export function UsernameField({ value, onChange, onSubmit, returnKeyType = 'done', autoFocus, accessibilityLabel = 'Usuario' }: Props) {
  const { c } = useTheme();
  const ref = useRef<TextInput>(null);
  const caret = useRef(value.length);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.surface,
        borderRadius: radius.md,
        paddingLeft: space.lg,
      }}
    >
      <Text style={{ fontFamily: font.regular, fontSize: 17, letterSpacing: -0.2, color: c.textSecondary }}>@</Text>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(raw) => {
          const clean = cleanUsername(raw);
          if (clean === raw) {
            onChange(clean);
            return;
          }
          // Where the caret would be in the cleaned text: count what survives before it.
          const rawCaret = Math.max(0, Math.min(raw.length, caret.current + (raw.length - value.length)));
          const next = cleanUsername(raw.slice(0, rawCaret)).length;
          caret.current = next;
          onChange(clean);
          requestAnimationFrame(() => ref.current?.setSelection(next, next));
        }}
        onSelectionChange={(e) => {
          caret.current = e.nativeEvent.selection.end;
        }}
        placeholder="usuario"
        placeholderTextColor={c.textTertiary}
        keyboardType={Platform.OS === 'android' ? 'visible-password' : 'ascii-capable'}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        importantForAutofill="no"
        autoFocus={autoFocus}
        maxLength={24}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmit}
        accessibilityLabel={accessibilityLabel}
        selectionColor={c.ink}
        cursorColor={c.ink}
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: font.regular,
          fontSize: 17,
          letterSpacing: -0.2,
          color: c.text,
          paddingLeft: 2,
          paddingRight: space.lg,
          paddingVertical: 14,
        }}
      />
    </View>
  );
}
