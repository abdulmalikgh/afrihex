import { z } from 'zod';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { resetPassword } from '../../../api/auth';
import { AppButton, AppText, ErrorBanner, ResultCard, Screen } from '../../../components';
import { colors } from '../../../constants/colors';
import { spacing } from '../../../constants/spacing';
import { AuthPasswordInput } from '../components/AuthPasswordInput';

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'Use at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = getSingleParam(params.token);
  const { control, handleSubmit, setError, formState } = useForm<ResetPasswordFormValues>({
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });
  const mutation = useMutation({
    mutationFn: resetPassword,
  });

  const submit = handleSubmit(async (values) => {
    const parsed = resetPasswordSchema.safeParse(values);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];

        if (field === 'newPassword' || field === 'confirmPassword') {
          setError(field, { message: issue.message });
        }
      }

      return;
    }

    if (!token) {
      return;
    }

    await mutation.mutateAsync({
      token,
      new_password: parsed.data.newPassword,
    });
  });

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={10}
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <ArrowLeft color={colors.text} size={24} />
      </Pressable>

      <View style={styles.header}>
        <AppText variant="title">Create new password</AppText>
        <AppText variant="body" tone="muted">
          Enter a new password for your AfriHex account.
        </AppText>
      </View>

      {!token ? <ErrorBanner message="This reset link is missing a token." /> : null}
      {mutation.error ? <ErrorBanner message={getErrorMessage(mutation.error)} /> : null}

      {mutation.isSuccess ? (
        <>
          <ResultCard
            title="Password reset"
            description="Your password has been updated. You can now sign in with the new password."
          />
          <AppButton onPress={() => router.replace('/auth/login')}>Go to sign in</AppButton>
        </>
      ) : (
        <>
          <View style={styles.field}>
            <AppText variant="caption" tone="muted">
              New password
            </AppText>
            <Controller
              control={control}
              name="newPassword"
              render={({ field: { onBlur, onChange, value } }) => (
                <AuthPasswordInput
                  accessibilityLabel="New password"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="At least 8 characters"
                  textContentType="newPassword"
                  value={value}
                />
              )}
            />
            {formState.errors.newPassword?.message ? (
              <AppText variant="caption" tone="danger">
                {formState.errors.newPassword.message}
              </AppText>
            ) : null}
          </View>

          <View style={styles.field}>
            <AppText variant="caption" tone="muted">
              Confirm password
            </AppText>
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onBlur, onChange, value } }) => (
                <AuthPasswordInput
                  accessibilityLabel="Confirm new password"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="Repeat new password"
                  textContentType="newPassword"
                  value={value}
                />
              )}
            />
            {formState.errors.confirmPassword?.message ? (
              <AppText variant="caption" tone="danger">
                {formState.errors.confirmPassword.message}
              </AppText>
            ) : null}
          </View>

          <AppButton disabled={!token} loading={mutation.isPending} onPress={submit}>
            Reset password
          </AppButton>
        </>
      )}
    </Screen>
  );
}

function getSingleParam(value: string | readonly string[] | undefined): string | null {
  if (typeof value === 'string') {
    return value;
  }

  return value?.[0] ?? null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
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
  field: {
    gap: spacing.sm,
  },
});
