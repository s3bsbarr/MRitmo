import type { BlurTint } from 'expo-blur';
import { createContext, useContext } from 'react';

export type Scheme = 'light' | 'dark';
export type ThemePref = 'system' | 'light' | 'dark';

/**
 * Monochrome palette. White leads in light mode, true black in dark mode.
 * Ink is the only "accent": primary actions and completed states use it,
 * so the interface reads like paper and pencil rather than a dashboard.
 */
const light = {
  scheme: 'light' as Scheme,
  bg: '#FFFFFF',
  surface: '#F4F4F6',
  surfaceStrong: '#EBEBEF',
  ink: '#0A0A0B',
  inkOnInk: '#FFFFFF',
  text: '#0A0A0B',
  textSecondary: '#6C6C72',
  textTertiary: '#A1A1A8',
  separator: 'rgba(10,10,11,0.08)',
  track: 'rgba(10,10,11,0.07)',
  danger: '#D92D20',
  glassFill: 'rgba(255,255,255,0.62)',
  glassEdge: 'rgba(255,255,255,0.9)',
  glassBorder: 'rgba(10,10,11,0.06)',
  glassTint: 'systemChromeMaterialLight' as BlurTint,
  scrim: 'rgba(10,10,11,0.28)',
  shadow: '#000000',
};

const dark: typeof light = {
  scheme: 'dark',
  bg: '#000000',
  surface: '#111113',
  surfaceStrong: '#1C1C1F',
  ink: '#F5F5F7',
  inkOnInk: '#0A0A0B',
  text: '#F5F5F7',
  textSecondary: '#8E8E95',
  textTertiary: '#5A5A60',
  separator: 'rgba(255,255,255,0.08)',
  track: 'rgba(255,255,255,0.10)',
  danger: '#FF6B5E',
  glassFill: 'rgba(28,28,31,0.55)',
  glassEdge: 'rgba(255,255,255,0.16)',
  glassBorder: 'rgba(255,255,255,0.06)',
  glassTint: 'systemChromeMaterialDark' as BlurTint,
  scrim: 'rgba(0,0,0,0.55)',
  shadow: '#000000',
};

export const palettes = { light, dark };
export type Palette = typeof light;

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

/**
 * Type scale with size-specific tracking: large text tightens,
 * small text opens up slightly, body stays near zero.
 */
export const type = {
  display: { fontFamily: font.semibold, fontSize: 64, lineHeight: 68, letterSpacing: -2.6 },
  largeTitle: { fontFamily: font.bold, fontSize: 34, lineHeight: 40, letterSpacing: -1.1 },
  title: { fontFamily: font.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.5 },
  headline: { fontFamily: font.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.25 },
  body: { fontFamily: font.regular, fontSize: 17, lineHeight: 24, letterSpacing: -0.2 },
  callout: { fontFamily: font.medium, fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },
  footnote: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
};

/** 4pt spacing grid. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };

export const ThemeContext = createContext<{
  c: Palette;
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
}>({ c: light, pref: 'system', setPref: () => {} });

export const useTheme = () => useContext(ThemeContext);
