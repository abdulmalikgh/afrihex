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

  /**
   * Text/icon colour for content sitting ON a filled brand surface.
   *
   * Deliberately dark: `text` on `primary` measures 2.97:1, which fails AA for
   * body text and misses even the 3:1 large-text floor. This pairing measures
   * 5.6:1 on `primary` and 7.4:1 on `primaryLight`.
   */
  onPrimary: '#0a1710',
  /** Content on a `danger` fill — 5.8:1. White would only reach 3.1:1. */
  onDanger: '#2a0d08',
  /** Content on a `gold` fill — 8.6:1. */
  onGold: '#2a1f04',

  /**
   * Semantic status colours. Distinct from the brand green on purpose: route
   * polylines are tinted green→red by traffic severity, so a success state that
   * reused `primary` would read as "free-flowing traffic" on map surfaces.
   */
  success: '#54c98a',
  warning: '#eab535',

  /** Scrim behind modals and menus. Measured against `surface`, not white. */
  scrim: 'rgba(0, 0, 0, 0.6)',
  /**
   * Translucent light overlay for a pressed state on dark surfaces. Darkening a
   * near-black surface produces no visible feedback, so press states lighten.
   */
  pressedLayer: 'rgba(242, 244, 239, 0.1)',
} as const;

export type AppColor = keyof typeof colors;
