export const colors = {
  surface: '#111814',
  card: '#1a231d',
  cardAlt: '#232e26',
  text: '#f2f4ef',
  muted: '#9ca89f',
  faint: '#6b776e',
  border: '#2a362d',
  borderStrong: '#3c4a40',
  inputBg: '#1a231d',
  inputBorder: '#3c4a40',
  hover: '#232e26',
  primary: '#2fa162',
  primaryDark: '#1d7a46',
  primaryLight: '#47b878',
  gold: '#eab535',
  violet: '#8d54ff',
  danger: '#e07160',
  white: '#ffffff',
  black: '#000000',
} as const;

export type AppColor = keyof typeof colors;
