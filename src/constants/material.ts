import type { ViewStyle } from 'react-native';

/**
 * Material Design 3 tokens for AfriHex map surfaces.
 *
 * The rest of the app runs on the dark AfriHex palette in `colors.ts`. Map chrome
 * follows the Google Maps convention instead: a light surface stack so the map
 * itself stays the brightest thing on screen and floating chrome reads as paper
 * resting above it. Role names mirror the MD3 colour roles so they map 1:1 onto
 * the spec, and the primary family is derived from the AfriHex green rather than
 * Material's default purple.
 */

type ElevationStyle = Required<
  Pick<ViewStyle, 'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'>
>;

export const mapColors = {
  primary: '#1b6b42',
  onPrimary: '#ffffff',
  primaryContainer: '#a4f2c2',
  onPrimaryContainer: '#00210f',
  secondary: '#4d6355',
  onSecondary: '#ffffff',
  secondaryContainer: '#cfe9d6',
  onSecondaryContainer: '#0a1f14',
  /** Floating chrome: search bar, sheet, menus. */
  surface: '#ffffff',
  surfaceContainerLow: '#f5f7f4',
  surfaceContainer: '#eff2ee',
  surfaceContainerHigh: '#e9ede8',
  surfaceContainerHighest: '#e3e8e2',
  onSurface: '#191c1a',
  /** Secondary text and inactive icons — 5.8:1 on `surface`. */
  onSurfaceVariant: '#5c6660',
  outline: '#8c948e',
  outlineVariant: '#dfe4df',
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#410002',
  /** Non-error attention colour, e.g. an approximate-location notice. */
  warning: '#8a5300',
  warningContainer: '#ffddb3',
  scrim: 'rgba(0, 0, 0, 0.32)',
} as const;

export type MapColor = keyof typeof mapColors;

/** MD3 elevation levels 0-5 (0, 1, 3, 6, 8, 12dp) expressed for both platforms. */
export const mapElevation = {
  level0: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  level1: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 2,
    elevation: 1,
  },
  level2: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
  },
  level3: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 9,
    elevation: 6,
  },
  level4: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 11,
    elevation: 8,
  },
  level5: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 12,
  },
} as const satisfies Record<string, ElevationStyle>;

/** MD3 shape scale. `full` is the stadium shape used by search bars and chips. */
export const mapShape = {
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 28,
  full: 999,
} as const;

/** MD3 state-layer opacities, applied as an overlay tint on press. */
export const mapState = {
  hover: 0.08,
  focus: 0.1,
  pressed: 0.12,
  dragged: 0.16,
  disabled: 0.38,
} as const;

/** Minimum comfortable target for a list row or icon button. */
export const mapSize = {
  listRow: 56,
  iconButton: 40,
  searchBar: 52,
  fab: 56,
  /** Left inset used by dividers so they start at the row's text, not its icon. */
  rowTextInset: 56,
} as const;

/** MD3 motion durations, in milliseconds. */
export const mapMotion = {
  short: 150,
  medium: 250,
  long: 400,
} as const;

/** Translucent primary tint for a pressed state layer on a light surface. */
export const mapPressedLayer = 'rgba(25, 28, 26, 0.08)';
