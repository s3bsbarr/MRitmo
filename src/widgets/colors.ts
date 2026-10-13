type Hex = `#${string}`;

export type WC = {
  scheme: 'light' | 'dark';
  bg: Hex;
  surface: Hex;
  ink: Hex;
  inkOnInk: Hex;
  text: Hex;
  secondary: Hex;
  track: Hex;
};

export const W: { light: WC; dark: WC } = {
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
};

export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};
