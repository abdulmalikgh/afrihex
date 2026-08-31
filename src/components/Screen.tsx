import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  edges?: {
    top?: boolean;
    bottom?: boolean;
  };
  contentStyle?: ViewStyle;
  /**
   * Renders content edge-to-edge with no gutters or safe-area padding, for
   * screens that own their own layering (e.g. a full-bleed map behind a sheet).
   */
  bleed?: boolean;
  /**
   * Paints an opaque strip behind the status bar so scrolling content is masked
   * there instead of showing through behind the clock, wifi and battery.
   */
  maskStatusBar?: boolean;
};

export function Screen({
  children,
  scroll = false,
  edges = { top: true, bottom: true },
  contentStyle,
  bleed = false,
  maskStatusBar = true,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const paddingStyle = bleed
    ? null
    : {
        paddingTop: edges.top === false ? spacing.lg : insets.top + spacing.lg,
        paddingBottom: edges.bottom === false ? spacing.lg : insets.bottom + spacing.lg,
      };

  const body = scroll ? (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[bleed ? styles.bleedContent : styles.content, paddingStyle, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.container, bleed ? styles.bleedContent : styles.content, paddingStyle, contentStyle]}>
      {children}
    </View>
  );

  if (!maskStatusBar) {
    return body;
  }

  return (
    <View style={styles.container}>
      {body}
      <StatusBarMask height={insets.top} />
    </View>
  );
}

/**
 * Fixed, non-scrolling strip occupying the top safe-area inset. Sits above screen
 * content so anything scrolled upward is hidden behind the status bar rather than
 * colliding with the system clock, wifi and battery indicators.
 */
export function StatusBarMask({ height }: { height: number }) {
  if (height <= 0) {
    return null;
  }

  return <View pointerEvents="none" style={[styles.statusBarMask, { height }]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  bleedContent: {
    flexGrow: 1,
  },
  statusBarMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    zIndex: 20,
  },
});
