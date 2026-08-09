import { z } from 'zod';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import { AppButton, AppInput, AppText, ErrorBanner, GoogleIcon, Screen } from '../../../components';
import { colors } from '../../../constants/colors';
import { spacing } from '../../../constants/spacing';
import { AuthDivider } from '../components/AuthDivider';
import { AuthPasswordInput } from '../components/AuthPasswordInput';
import { AuthSwitchLink } from '../components/AuthSwitchLink';
import { useAuthSession } from '../context/AuthSessionProvider';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginScreen() {
  const { control, handleSubmit, setError, formState } = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
  });
  const { login, startGoogleSignIn, clearError, errorMessage, isSubmitting } = useAuthSession();

  useEffect(() => {
    return clearError;
  }, [clearError]);

  const submit = handleSubmit(async (values) => {
    const parsed = loginSchema.safeParse(values);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];

        if (field === 'email' || field === 'password') {
          setError(field, { message: issue.message });
        }
      }

      return;
    }

    await login(parsed.data);
    router.replace('/account');
  });

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={10}
        onPress={() => {
          clearError();
          router.back();
        }}
        style={styles.backButton}
      >
        <ArrowLeft color={colors.text} size={24} />
      </Pressable>
      <View style={styles.header}>
        <AppText variant="title">Sign in</AppText>
        <AppText variant="body" tone="muted">
          Pick up where you left off with synced searches, usage details, and full route
          features across your devices.
        </AppText>
      </View>

      {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

      <View style={styles.form}>
        <View style={styles.field}>
          <AppText variant="caption" tone="muted">
            Email
          </AppText>
          <Controller
            control={control}
            name="email"
            render={({ field: { onBlur, onChange, value } }) => (
              <AppInput
                accessibilityLabel="Email address"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="you@example.com"
                value={value}
              />
            )}
          />
          {formState.errors.email?.message ? (
            <AppText variant="caption" tone="danger">
              {formState.errors.email.message}
            </AppText>
          ) : null}
        </View>

        <View style={styles.field}>
          <View style={styles.fieldHeader}>
            <AppText variant="caption" tone="muted">
              Password
            </AppText>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Forgot password"
              hitSlop={8}
              onPress={() => router.push('/auth/forgot-password')}
            >
              <AppText variant="caption" tone="primary">
                Forgot password?
              </AppText>
            </Pressable>
          </View>
          <Controller
            control={control}
            name="password"
            render={({ field: { onBlur, onChange, value } }) => (
              <AuthPasswordInput
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete="password"
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="Password"
                value={value}
              />
            )}
          />
          {formState.errors.password?.message ? (
            <AppText variant="caption" tone="danger">
              {formState.errors.password.message}
            </AppText>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <AppButton loading={isSubmitting} onPress={submit}>
          Sign in
        </AppButton>
        <AuthDivider />
        <AppButton
          variant="secondary"
          icon={<GoogleIcon />}
          loading={isSubmitting}
          onPress={startGoogleSignIn}
        >
          Continue with Google
        </AppButton>
        <AuthSwitchLink prompt="Don't have an account?" action="Create one" href="/auth/register" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  form: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  fieldHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  actions: {
    gap: spacing.md,
  },
});
