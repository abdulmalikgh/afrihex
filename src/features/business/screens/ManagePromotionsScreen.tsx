import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Megaphone, Trash2 } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';

import { ApiRequestError } from '../../../api/client';
import { PROMOTION_TEXT_MAX_LENGTH, updatePromotion, validatePromotionWindow } from '../../../api/business';
import { AppButton, AppInput, AppText, BackButton, EmptyState, ErrorBanner, Screen } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { hapticSuccess, hapticWarning } from '../../../utils/haptics';
import { clearEditToken, forgetOwnedId, getEditToken, getOwnedIds } from '../../../storage/editTokens';

/**
 * Editing or cancelling a promotion after it has been claimed.
 *
 * There is no "my promotions" endpoint, so the list comes from the edit tokens
 * this device saved at claim time. That means it is per-device by design: a
 * promotion claimed on another phone cannot be listed here, only reached by
 * pasting its edit code.
 */
export function ManagePromotionsScreen() {
  const router = useRouter();
  const [slugs, setSlugs] = useState<string[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [promotionText, setPromotionText] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [windowError, setWindowError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadOwned = useCallback(async () => {
    setSlugs(await getOwnedIds('promotion'));
  }, []);

  useEffect(() => {
    void loadOwned();
  }, [loadOwned]);

  const saveMutation = useMutation({
    mutationFn: async ({ slug, text, expiry }: { slug: string; text: string; expiry: string | null }) => {
      const token = await getEditToken('promotion', slug);

      if (!token) {
        throw new ApiRequestError({
          code: 'MISSING_TOKEN',
          message: 'The edit code for this promotion is not on this phone.',
          status: 401,
        });
      }

      await updatePromotion({
        slug,
        editToken: token,
        promotionText: text,
        promotionExpiresAt: expiry,
      });
    },
    onSuccess: async (_result, variables) => {
      hapticSuccess();

      if (variables.text === '') {
        // Clearing the text removes the promotion entirely — there is no
        // separate delete endpoint — so the local ownership record goes too.
        await clearEditToken('promotion', variables.slug);
        await forgetOwnedId('promotion', variables.slug);
        await loadOwned();
        setNotice('Promotion cancelled.');
      } else {
        setNotice('Promotion updated.');
      }

      setActiveSlug(null);
    },
  });

  const handleSave = () => {
    if (!activeSlug) {
      return;
    }

    const problem = validatePromotionWindow({ expiresAt });

    if (problem) {
      setWindowError(problem);
      return;
    }

    saveMutation.mutate({ slug: activeSlug, text: promotionText.trim(), expiry: expiresAt });
  };

  const handleCancelPromotion = (slug: string) => {
    Alert.alert(
      'Cancel this promotion?',
      'It stops being spoken to drivers straight away. This cannot be undone — you would have to claim it again.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel promotion',
          style: 'destructive',
          onPress: () => {
            hapticWarning();
            // An empty text is how the API clears a promotion.
            saveMutation.mutate({ slug, text: '', expiry: null });
          },
        },
      ],
    );
  };

  if (activeSlug) {
    const trimmed = promotionText.trim();

    return (
      <Screen scroll contentStyle={styles.content}>
        <BackButton />

        <AppText variant="caption" tone="muted">
          {activeSlug}
        </AppText>

        {saveMutation.error ? <ErrorBanner message={getPromotionError(saveMutation.error)} /> : null}

        <View style={styles.field}>
          <AppText variant="caption" tone="muted">
            What drivers hear
          </AppText>
          <AppInput
            value={promotionText}
            onChangeText={setPromotionText}
            multiline
            maxLength={PROMOTION_TEXT_MAX_LENGTH}
            style={styles.promotionInput}
            accessibilityLabel="Promotion text"
          />
          <AppText variant="caption" tone="faint">
            {trimmed.length}/{PROMOTION_TEXT_MAX_LENGTH}
          </AppText>
        </View>

        <View style={styles.field}>
          <AppText variant="caption" tone="muted">
            Runs until
          </AppText>
          <AppInput
            value={expiresAt}
            onChangeText={(value) => {
              setExpiresAt(value);
              setWindowError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Promotion end date"
          />
          {windowError ? (
            <AppText variant="caption" tone="danger">
              {windowError}
            </AppText>
          ) : null}
        </View>

        <AppButton onPress={handleSave} disabled={trimmed.length === 0} loading={saveMutation.isPending}>
          Save changes
        </AppButton>
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
        <BackButton />

      {notice ? (
        <AppText variant="caption" tone="primary">
          {notice}
        </AppText>
      ) : null}

      {saveMutation.error ? <ErrorBanner message={getPromotionError(saveMutation.error)} /> : null}

      {slugs.length === 0 ? (
        <EmptyState
          title="No promotions on this phone"
          description="Promotions you claim are listed here. There is no server list of them, so one claimed on another device will not appear."
        />
      ) : (
        <View style={styles.list}>
          {slugs.map((slug) => (
            <View key={slug} style={styles.row}>
              <Megaphone color={colors.primaryLight} size={20} />
              <AppText variant="body" numberOfLines={1} style={styles.rowName}>
                {slug}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit the promotion for ${slug}`}
                onPress={() => {
                  setActiveSlug(slug);
                  setPromotionText('');
                  setExpiresAt(new Date(Date.now() + 7 * 86_400_000).toISOString().replace(/\.\d+Z$/, 'Z'));
                  setNotice(null);
                }}
                hitSlop={8}
                style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}
              >
                <AppText variant="caption" tone="primary">
                  Edit
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Cancel the promotion for ${slug}`}
                onPress={() => handleCancelPromotion(slug)}
                hitSlop={8}
                style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}
              >
                <Trash2 color={colors.danger} size={18} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <AppButton variant="secondary" onPress={() => router.push('/business/claim')}>
        Claim another business
      </AppButton>
    </Screen>
  );
}

/**
 * A wrong token and an unclaimed slug both come back `404`, deliberately
 * indistinguishable — so the message covers both rather than guessing.
 */
function getPromotionError(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 404) {
      return 'That promotion could not be updated. Either the claim was not approved, or the edit code no longer matches.';
    }

    if (error.code === 'MISSING_TOKEN') {
      return error.message;
    }

    return error.message;
  }

  return error instanceof Error ? error.message : 'Could not update the promotion right now.';
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  list: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.md,
  },
  rowName: {
    flex: 1,
    minWidth: 0,
  },
  rowAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  promotionInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  pressed: {
    opacity: 0.7,
  },
});
