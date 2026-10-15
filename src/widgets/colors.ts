type Hex = `#${string}`;

export type WC = {
  scheme: 'light' | 'dark';
  /** Character colors for this tone (cream, tinto); absent uses the scheme's. */
  sprite?: Record<string, string>;
  bg: Hex;
  surface: Hex;
  ink: Hex;
  inkOnInk: Hex;
  text: Hex;
  secondary: Hex;
  track: Hex;
};

export const W: { light: WC; dark: WC; cream: WC; tinto: WC } = {
  light: {
    scheme: 'light',
    bg: '#FFFFFF',
    surface: '#F2F2F4',
    ink: '#0A0A0B',
    inkOnInk: '#FFFFFF',
    text: '#0A0A0B',
    secondary: '#6C6C72',
    track: '#E8E8EB',
  },
  dark: {
    scheme: 'dark',
    bg: '#0A0A0B',
    surface: '#1C1C1F',
    ink: '#F5F5F7',
    inkOnInk: '#0A0A0B',
    text: '#F5F5F7',
    secondary: '#8E8E95',
    track: '#2A2A2E',
  },
  // Crema (light tone) and Tinto (dark tone), 1.9.1: same colors as the app.
  cream: {
    scheme: 'light',
    sprite: { B: '#E2DBCC', Z: '#9F9888' },
    bg: '#F7F3EA',
    surface: '#ECE6DA',
    ink: '#18160F',
    inkOnInk: '#F7F3EA',
    text: '#18160F',
    secondary: '#5E594D',
    track: '#E2DBCC',
  },
  tinto: {
    scheme: 'dark',
    sprite: { O: '#D6CEBF', C: '#1D1913', D: '#EFE8DB', K: '#EFE8DB', B: '#2E2921', Z: '#A69D8C' },
    bg: '#15120E',
    surface: '#211D17',
    ink: '#F3ECDF',
    inkOnInk: '#15120E',
    text: '#F3ECDF',
    secondary: '#A69D8C',
    track: '#2E2921',
  },
};

export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};
