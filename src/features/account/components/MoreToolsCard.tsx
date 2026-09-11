import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

import { AppButton, ResultCard } from '../../../components';
import { colors } from '../../../constants/colors';
import { spacing } from '../../../constants/spacing';

/**
 * The account-less features, gathered in one place.
 *
 * Rendered for signed-out visitors too, deliberately: saving an address,
 * starting a meetup, submitting a business and downloading the offline map all
 * work with no key. Putting them behind the authenticated branch would hide
 * them from exactly the people the features were built for.
 */
export function MoreToolsCard() {
  return (
    <ResultCard
      title="More"
      description="Everything else AfriHex can do with an address. No account needed."
      icon={<Sparkles color={colors.primaryLight} size={18} />}
    >
      <View style={styles.links}>
        <AppButton variant="secondary" onPress={() => router.push('/profile/create')}>
          Save &amp; share my address
        </AppButton>
        <AppButton variant="secondary" onPress={() => router.push('/meet')}>
          Meet me there
        </AppButton>
        <AppButton variant="secondary" onPress={() => router.push('/business/add')}>
          Add your business
        </AppButton>
        <AppButton variant="secondary" onPress={() => router.push('/business/promotions')}>
          Claim a business &amp; run a promotion
        </AppButton>
        <AppButton variant="secondary" onPress={() => router.push('/transit')}>
          What leaves from here
        </AppButton>
        <AppButton variant="secondary" onPress={() => router.push('/offline')}>
          Offline map
        </AppButton>
      </View>
    </ResultCard>
  );
}

const styles = StyleSheet.create({
  links: {
    gap: spacing.sm,
  },
});
