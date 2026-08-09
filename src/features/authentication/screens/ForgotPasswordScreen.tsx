import { z } from 'zod';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { requestPasswordReset } from '../../../api/auth';
import { AppButton, AppInput, AppText, ErrorBanner, ResultCard, Screen } from '../../../components';
import { colors } from '../../../constants/colors';
import { spacing } from '../../../constants/spacing';

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordScreen() {
  const { control, handleSubmit, setError, formState } = useForm<ForgotPasswordFormValues>({
    defaultValues: {
      email: '',
    },
  });
  const mutation = useMutation({
    mutationFn: requestPasswordReset,
  });

  const submit = handleSubmit(async (values) => {
    const parsed = forgotPasswordSchema.safeParse(values);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'email') {
          setError('email', { message: issue.message });
        }
      }

      return;
    }

    await mutation.mutateAsync(parsed.data);
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
        <AppText variant="title">Reset password</AppText>
        <AppText variant="body" tone="muted">
          Enter your account email and we will send a reset link if an account exists.
        </AppText>
      </View>

      {mutation.error ? <ErrorBanner message={getErrorMessage(mutation.error)} /> : null}

      {mutation.isSuccess ? (
        <ResultCard
          title="Check your email"
          description="If an account exists for that email, a password reset link has been sent. The link expires in 30 minutes."
        />
      ) : (
        <>
          <View style={styles.field}>
            <AppText variant="caption" tone="muted">
              Email
            </AppText>
            <Controller
              control={control}
              name="email"
              render={({ field: { onBlur, onChange, value } }) => (
                <AppInput
                  accessibilityLabel="Account email address"
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

          <AppButton loading={mutation.isPending} onPress={submit}>
            Send reset link
          </AppButton>
        </>
      )}
    </Screen>
  );
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
