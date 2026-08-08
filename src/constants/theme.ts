import { colors } from './colors';
import { fontFamilies, fontSizes, lineHeights } from './typography';
import { radius } from './radius';
import { spacing } from './spacing';

export const theme = {
  colors,
  fontFamilies,
  fontSizes,
  lineHeights,
  radius,
  spacing,
} as const;

export type AppTheme = typeof theme;
