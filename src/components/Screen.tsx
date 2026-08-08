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
};

export function Screen({
  children,
  scroll = false,
  edges = { top: true, bottom: true },
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const paddingStyle = {
    paddingTop: edges.top === false ? spacing.lg : insets.top + spacing.lg,
    paddingBottom: edges.bottom === false ? spacing.lg : insets.bottom + spacing.lg,
  };

  if (scroll) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, paddingStyle, contentStyle]}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[styles.container, styles.content, paddingStyle, contentStyle]}>{children}</View>;
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
});
