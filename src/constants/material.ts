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
 * Route line colours, for the map rather than for chrome.
 *
 * Contrast is measured against the tile colours in `mapStyle.ts`, because that is
 * what the line actually sits on — not against `surface`. The binding constraint
 * is `road.highway` at `#3c4a40`, the brightest thing a route can cross.
 *
 * ## Why not Google's navigation blue
 *
 * `#4285f4` — the blue Google Maps draws its route in — measures **2.62:1**
 * against our highway tiles. That is below the 3:1 floor for non-text content, so
 * the line loses its edge exactly where a highway crossing is hardest to read.
 * Their darker `#1a73e8` is worse still at 2.08:1. Lifting to `#4d9dff` clears
 * every tile:
 *
 * | Against        | `#4d9dff` | `#4285f4` |
 * | -------------- | --------- | ---------- |
 * | land `#16201a` | 6.04:1 ✓  | 4.69:1 ✓  |
 * | road `#26312a` | 4.88:1 ✓  | 3.79:1 ✓  |
 * | arterial `#2d3931` | 4.35:1 ✓ | 3.38:1 ✓ |
 * | highway `#3c4a40` | **3.38:1 ✓** | **2.62:1 ✗** |
 *
 * ## The colour roles do not overlap
 *
 * Green is reserved for the manoeuvre — the point the driver has to act on —
 * and is never used for the line it acts on. Blue means "the road ahead". This is
 * why `trafficTint` is dropped while navigating: the traffic ramp is green→amber→
 * red, so keeping it on a line that is itself being coloured for meaning would
 * make the two indistinguishable.
 */
export const mapRoute = {
  /** Planning, untinted: the brand line. 5.40:1 on a local road. */
  planned: '#47b878',
  /** Planning, tinted by `traffic_color` from the API. */
  trafficTint: '#47b878',
  /** An alternative the user has not chosen. Present, never competing. */
  inactive: '#6b776e',
  /** The route still ahead, during a trip. 3.38:1 on a highway. */
  active: '#4d9dff',
  /** Already driven this trip. Recedes so the blue ahead reads as the subject. */
  travelled: '#6b776e',
  /**
   * The segment the user tapped in the steps list.
   *
   * Saturated green at a heavier weight with a dark casing behind it, so the
   * selection is carried by width and contrast rather than hue alone — the
   * untinted planning line is the same green, and colour on its own would not
   * distinguish them.
   */
  selected: '#3ddc84',
  /** Casing drawn under `selected` to lift it off a light road fill. */
  selectedCasing: '#0a1710',
  /** Off-route: the line is no longer trustworthy, and says so. */
  offRoute: '#e07160',
  /** The manoeuvre pin, and the selected step's marker. */
  maneuver: '#3ddc84',
} as const;

/**
 * Route stroke widths.
 *
 * The casing matters more than the width does: on a dark map a wider green line
 * only reads as brighter, whereas a wider line *plus* a dark casing reads as
 * nearer. Widths are whole numbers because `react-native-maps` rounds to points
 * on iOS and fractions produce a visibly thinner line there than on Android.
 */
export const mapRouteStroke = {
  inactive: 4,
  planned: 5,
  selected: 9,
  selectedCasing: 13,
  /** Ahead plus behind, drawn as separate lines. */
  active: 7,
  activeCasing: 11,
  travelled: 4,
} as const;

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
