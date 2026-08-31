import { router } from 'expo-router';
import { BarChart3, Check, KeyRound, LockKeyhole, LogOut, TrendingUp } from 'lucide-react-native';
import { StyleSheet, Text, View, type DimensionValue } from 'react-native';

import { AppButton, AppText, ErrorBanner, GoogleIcon, LoadingState, ResultCard, Screen } from '../../../components';
import { colors } from '../../../constants/colors';
import { fontFamilies } from '../../../constants/typography';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { useAuthSession } from '../../authentication/context/AuthSessionProvider';

export function AccountScreen() {
  const {
    status,
    user,
    usage,
    errorMessage,
    accountErrorMessage,
    isUserLoading,
    isSubmitting,
    startGoogleSignIn,
    logout,
  } = useAuthSession();

  if (status === 'loading' || (status === 'authenticated' && isUserLoading && !user)) {
    return <LoadingState label="Loading account" />;
  }

  if (status === 'anonymous') {
    return (
      <Screen scroll contentStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.anonymousTitle}>Get more from AfriHex</Text>
          <AppText variant="body" tone="muted">
            Save searches, track usage, and access full route details across devices.
          </AppText>
        </View>

        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

        <View style={styles.actions}>
          <AppButton onPress={() => router.push('/auth/login')}>Sign in</AppButton>
          <AppButton
            variant="secondary"
            icon={<GoogleIcon />}
            loading={isSubmitting}
            onPress={startGoogleSignIn}
          >
            Continue with Google
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/auth/register')}>
            Create account
          </AppButton>
        </View>

        <ResultCard title="Account unlocks" description="Keep your AfriHex activity available across devices.">
          <View style={styles.benefits}>
            <BenefitRow label="Synced recent searches" />
            <BenefitRow label="Usage and plan details" />
            <BenefitRow label="Full route responses" />
          </View>
        </ResultCard>

        <AppText variant="caption" tone="faint" align="center">
          Core map tools are available without signing in.
        </AppText>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <View style={styles.header}>
          <AppText variant="title">Your AfriHex account</AppText>
          <AppText variant="body" tone="muted">
            We could not load your account details.
          </AppText>
        </View>

        <ErrorBanner message={accountErrorMessage ?? 'Account details are unavailable right now.'} />

        <AppButton variant="ghost" icon={<LogOut color={colors.text} size={18} />} onPress={logout}>
          Log out
        </AppButton>
      </Screen>
    );
  }

  const dailyLimit = usage?.daily_limit ?? user.daily_limit;
  // `/v2/usage` returns no `usage_today` — the only place that count exists is the
  // `user` object from login, so it is the sole source here.
  const usageToday = user.usage_today;
  const remaining = Math.max(dailyLimit - usageToday, 0);
  const usagePercent = dailyLimit > 0 ? Math.min(Math.round((usageToday / dailyLimit) * 100), 100) : 0;
  const progressWidth: DimensionValue = `${usagePercent}%`;
  const plan = capitalize(user.plan);

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="title">{accountTitle(user.name)}</AppText>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryTile}>
          <View style={styles.summaryLabel}>
            <KeyRound color={colors.primaryLight} size={16} />
            <AppText variant="caption" tone="muted">
              Plan
            </AppText>
          </View>
          <AppText variant="subtitle">{plan}</AppText>
        </View>
        <View style={styles.summaryTile}>
          <View style={styles.summaryLabel}>
            <TrendingUp color={colors.primaryLight} size={16} />
            <AppText variant="caption" tone="muted">
              Remaining
            </AppText>
          </View>
          <AppText variant="subtitle">{remaining}</AppText>
        </View>
      </View>

      <ResultCard
        title="Today's usage"
        description={`${usageToday} of ${dailyLimit} requests used`}
        icon={<BarChart3 color={colors.primaryLight} size={18} />}
      >
        <View style={styles.progressHeader}>
          <AppText variant="caption" tone="muted">
            Daily lookups
          </AppText>
          <AppText variant="caption" tone="muted">
            {usagePercent}%
          </AppText>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      </ResultCard>

      <ResultCard
        title="Security"
        description="Manage how you sign in to your AfriHex account."
        icon={<LockKeyhole color={colors.primaryLight} size={18} />}
      >
        <AppButton variant="secondary" onPress={() => router.push('/account/change-password')}>
          Change password
        </AppButton>
      </ResultCard>

      <AppButton variant="ghost" icon={<LogOut color={colors.text} size={18} />} onPress={logout}>
        Log out
      </AppButton>
    </Screen>
  );
}

function BenefitRow({ label }: { label: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.checkBadge}>
        <Check color={colors.primaryLight} size={14} />
      </View>
      <AppText variant="bodyStrong">{label}</AppText>
    </View>
  );
}

function accountTitle(name: string | undefined): string {
  const namePart = firstName(name);

  return namePart ? `Welcome back, ${namePart}` : 'Your AfriHex account';
}

function firstName(name: string | undefined): string | null {
  if (!name) {
    return null;
  }

  return name.trim().split(/\s+/)[0] ?? null;
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }

  return `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}`;
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  anonymousTitle: {
    color: colors.text,
    fontFamily: fontFamilies.heading,
    fontSize: 25,
    lineHeight: 32,
  },
  actions: {
    gap: spacing.md,
  },
  benefits: {
    gap: spacing.md,
  },
  benefitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  checkBadge: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: colors.cardAlt,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryTile: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 12,
    overflow: 'hidden',
    borderRadius: radius.round,
    backgroundColor: colors.cardAlt,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.round,
    backgroundColor: colors.primary,
  },
});
