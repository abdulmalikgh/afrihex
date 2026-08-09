import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../../components';
import { spacing } from '../../../constants/spacing';

type AuthSwitchLinkProps = {
  prompt: string;
  action: string;
  href: '/auth/login' | '/auth/register';
};

export function AuthSwitchLink({ prompt, action, href }: AuthSwitchLinkProps) {
  return (
    <View style={styles.container}>
      <AppText variant="caption" tone="muted">
        {prompt}
      </AppText>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${prompt} ${action}`}
        hitSlop={8}
        onPress={() => router.replace(href)}
      >
        <AppText variant="caption" tone="primary">
          {action}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
