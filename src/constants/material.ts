import type { ViewStyle } from 'react-native';

/**
 * Material Design 3 tokens for AfriHex map surfaces.
 *
 * Role names mirror the MD3 colour roles so they map 1:1 onto the spec, but every
 * value resolves to the dark AfriHex palette in `colors.ts` — this is one theme,
 * expressed twice. Map chrome previously ran a light surface stack on the Google
 * Maps convention, which put a white header above a dark sheet on the same
 * screen; the map tiles are dark-styled instead (see `mapStyle.ts`) so the chrome
 * can stay on-brand and still read as floating above the map.
 *
 * Contrast ratios in the comments are measured against `surface` unless stated.
 */

type ElevationStyle = Required<
  Pick<ViewStyle, 'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'>
>;

export const mapColors = {
  /** Brand green lightened for dark surfaces — 6.5:1 as text or an icon. */
  primary: '#47b878',
  /** Content on a `primary` fill — 7.4:1. White would only reach 2.5:1. */
  onPrimary: '#0a1710',
  primaryContainer: '#17402a',
  onPrimaryContainer: '#a4f2c2',
  secondary: '#9fb3a6',
  onSecondary: '#12211a',
  secondaryContainer: '#232e26',
  onSecondaryContainer: '#cfe9d6',
  /** Floating chrome: search bar, sheet, menus. */
  surface: '#1a231d',
  /** Recessed within chrome, e.g. an input well. Darker than `surface`. */
  surfaceContainerLow: '#151d18',
  surfaceContainer: '#202a23',
  surfaceContainerHigh: '#26312a',
  surfaceContainerHighest: '#2d3931',
  /** Primary text on chrome — 14.6:1. */
  onSurface: '#f2f4ef',
  /** Secondary text and inactive icons — 6.6:1. */
  onSurfaceVariant: '#9ca89f',
  /** Control boundaries — 3.5:1, meeting the non-text contrast threshold. */
  outline: '#6b776e',
  /** Decorative dividers only; too low for anything that carries meaning. */
  outlineVariant: '#33413a',
  /** 5.2:1. The light-mode `#ba1a1a` measured 2.5:1 here. */
  error: '#e07160',
  onError: '#2a0d08',
  errorContainer: '#4a1d18',
  onErrorContainer: '#ffdad6',
  /** Non-error attention colour, e.g. an approximate-location notice — 8.6:1. */
  warning: '#eab535',
  warningContainer: '#4a3a10',
  /** Heavier than the light-mode 0.32: a dim scrim cannot separate two dark layers. */
  scrim: 'rgba(0, 0, 0, 0.6)',
} as const;

export type MapColor = keyof typeof mapColors;

/**
 * MD3 elevation levels 0-5 (0, 1, 3, 6, 8, 12dp) expressed for both platforms.
 *
 * Opacities run higher than the light-mode values: a black shadow cast onto a
 * near-black surface is close to invisible, so on dark the tonal ramp above does
 * most of the lifting and the shadow only sharpens the edge. Chrome that floats
 * directly over map tiles should sit on `surface` or higher, never on
 * `surfaceContainerLow`, or it reads as a hole rather than a raised panel.
 */
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
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1,
  },
  level2: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.36,
    shadowRadius: 5,
    elevation: 3,
  },
  level3: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.42,
    shadowRadius: 9,
    elevation: 6,
  },
  level4: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.48,
    shadowRadius: 11,
    elevation: 8,
  },
  level5: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.54,
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

/** Minimum comfortable target for a list row or icon button (>=44pt iOS / 48dp Android). */
export const mapSize = {
  listRow: 56,
  iconButton: 44,
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

/**
 * Translucent light tint for a pressed state layer on a dark surface. Darkening
 * a near-black surface produces no perceptible feedback, so press states lighten.
 */
export const mapPressedLayer = 'rgba(242, 244, 239, 0.1)';
