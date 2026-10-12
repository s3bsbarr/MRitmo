import { BlurView } from 'expo-blur';
import { createContext, RefObject, useContext } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

/** The content layer that floating glass blurs on Android. */
export const BlurTargetContext = createContext<RefObject<View | null> | null>(null);

type Props = {
  style?: StyleProp<ViewStyle>;
  radius?: number;
  children?: React.ReactNode;
  /** Bigger surfaces read as thicker: stronger blur and deeper shadow. */
  weight?: 'thin' | 'regular' | 'thick';
};

/**
 * Liquid glass surface: a real blur of the content underneath, a translucent
 * fill for legibility, a hairline edge that catches light on top, and a soft
 * offset shadow so it floats above the page.
 */
export function Glass({ style, radius = 28, children, weight = 'regular' }: Props) {
  const { c } = useTheme();
  const target = useContext(BlurTargetContext);
  const intensity = weight === 'thin' ? 40 : weight === 'thick' ? 90 : 65;
  const shadow = weight === 'thick' ? 0.18 : weight === 'thin' ? 0.08 : 0.12;

  return (
    <View
      style={[
        {
          borderRadius: radius,
          shadowColor: c.shadow,
          shadowOpacity: c.scheme === 'dark' ? shadow * 2 : shadow,
          shadowRadius: weight === 'thick' ? 28 : 18,
          shadowOffset: { width: 0, height: weight === 'thick' ? 12 : 8 },
          elevation: weight === 'thick' ? 14 : 8,
        },
        style,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
        <BlurView
          tint={c.glassTint}
          intensity={intensity}
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={Platform.OS === 'android' ? target ?? undefined : undefined}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.glassFill }]} />
        {/* Specular top edge: light catching the material. */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: c.glassBorder,
              borderTopColor: c.glassEdge,
              borderTopWidth: 1,
            },
          ]}
        />
      </View>
      {children}
    </View>
  );
}
