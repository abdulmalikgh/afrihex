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

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.'),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterScreen() {
  const { control, handleSubmit, setError, formState } = useForm<RegisterFormValues>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });
  const { register, startGoogleSignIn, clearError, errorMessage, isSubmitting } = useAuthSession();

  useEffect(() => {
    return clearError;
  }, [clearError]);

  const submit = handleSubmit(async (values) => {
    const parsed = registerSchema.safeParse(values);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];

        if (field === 'name' || field === 'email' || field === 'password') {
          setError(field, { message: issue.message });
        }
      }

      return;
    }

    await register(parsed.data);
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
        <AppText variant="title">Create account</AppText>
        <AppText variant="body" tone="muted">
          Start with 20 free lookups per day, synced searches, usage details, and full
          route features across your devices.
        </AppText>
      </View>

      {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

      <View style={styles.form}>
        <View style={styles.field}>
          <AppText variant="caption" tone="muted">
            Name
          </AppText>
          <Controller
            control={control}
            name="name"
            render={({ field: { onBlur, onChange, value } }) => (
              <AppInput
                accessibilityLabel="Name"
                autoComplete="name"
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="Ama Mensah"
                value={value}
              />
            )}
          />
          {formState.errors.name?.message ? (
            <AppText variant="caption" tone="danger">
              {formState.errors.name.message}
            </AppText>
          ) : null}
        </View>

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
          <AppText variant="caption" tone="muted">
            Password
          </AppText>
          <Controller
            control={control}
            name="password"
            render={({ field: { onBlur, onChange, value } }) => (
              <AuthPasswordInput
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete="new-password"
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="At least 8 characters"
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
          Create account
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
        <AuthSwitchLink prompt="Already have an account?" action="Log in" href="/auth/login" />
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
  actions: {
    gap: spacing.md,
  },
});
