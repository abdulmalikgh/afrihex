import type { ReactNode } from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { colors } from '../constants/colors';
import { fontFamilies, fontSizes, lineHeights } from '../constants/typography';

type TextVariant = 'title' | 'subtitle' | 'body' | 'bodyStrong' | 'caption' | 'code' | 'codeHero' | 'overline';
type TextTone = 'default' | 'muted' | 'faint' | 'primary' | 'danger' | 'gold';

type AppTextProps = TextProps & {
  children: ReactNode;
  variant?: TextVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
};

const variantStyles = StyleSheet.create<Record<TextVariant, TextStyle>>({
  title: {
    fontFamily: fontFamilies.heading,
    fontSize: fontSizes['2xl'],
    lineHeight: lineHeights['2xl'],
  },
  subtitle: {
    fontFamily: fontFamilies.headingSemiBold,
    fontSize: fontSizes.lg,
    lineHeight: lineHeights.lg,
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.base,
    lineHeight: lineHeights.base,
  },
  bodyStrong: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: fontSizes.base,
    lineHeight: lineHeights.base,
  },
  caption: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: fontSizes.sm,
    lineHeight: lineHeights.sm,
  },
  code: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: fontSizes.sm,
    lineHeight: lineHeights.sm,
    letterSpacing: 0.8,
  },
  codeHero: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: fontSizes['2xl'],
    lineHeight: lineHeights['2xl'],
    letterSpacing: 1.2,
  },
  overline: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
});

const toneColors: Record<TextTone, string> = {
  default: colors.text,
  muted: colors.muted,
  faint: colors.faint,
  primary: colors.primaryLight,
  danger: colors.danger,
  gold: colors.gold,
};

export function AppText({
  children,
  variant = 'body',
  tone = 'default',
  align,
  style,
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      style={[
        styles.base,
        variantStyles[variant],
        { color: toneColors[tone], textAlign: align },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});
