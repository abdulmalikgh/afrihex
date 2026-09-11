import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { AtSign, ChevronRight } from 'lucide-react-native';

import { ApiRequestError } from '../../../api/client';
import { getProfile } from '../../../api/profile';
import { AppText } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { clearEditToken, forgetOwnedId, getEditToken, getOwnedIds } from '../../../storage/editTokens';

/**
 * Addresses saved on this device.
 *
 * There is no "my profiles" endpoint — the feature has no accounts — so the
 * list comes from the edit tokens stored at creation. That makes it per-device
 * by design: a handle created on another phone cannot appear here, and the only
 * way back to it is its public link.
 *
 * Each entry is re-fetched rather than trusted, because a profile deleted from
 * another device would otherwise sit in this list forever.
 */
export function SavedAddresses() {
  const router = useRouter();
  const [slugs, setSlugs] = useState<string[]>([]);

  const load = useCallback(async () => {
    setSlugs(await getOwnedIds('profile'));
  }, []);

  /**
   * Reloaded on focus, not just on mount. This screen stays mounted while the
   * profile screen is pushed over it, so deleting a profile and coming back
   * would otherwise show an entry that no longer exists until the user left the
   * screen entirely and returned.
   */
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const profiles = useQueries({
    queries: slugs.map((slug) => ({
      queryKey: ['profile', slug, 'owned'],
      queryFn: async () => getProfile(slug, (await getEditToken('profile', slug)) ?? undefined),
      staleTime: 60_000,
      retry: false,
    })),
  });

  // A 404 means it is gone — drop the local record rather than keep offering it.
  useEffect(() => {
    slugs.forEach((slug, index) => {
      const error = profiles[index]?.error;

      if (error instanceof ApiRequestError && error.status === 404) {
        void (async () => {
          await clearEditToken('profile', slug);
          await forgetOwnedId('profile', slug);
          await load();
        })();
      }
    });
  }, [load, profiles, slugs]);

  const saved = slugs
    .map((slug, index) => ({ slug, profile: profiles[index]?.data }))
    .filter((entry) => entry.profile !== undefined);

  if (saved.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <AppText variant="overline" tone="muted">
        Saved on this phone
      </AppText>

      {saved.map(({ slug, profile }) => (
        <Pressable
          key={slug}
          accessibilityRole="button"
          accessibilityLabel={`Open @${slug}`}
          onPress={() => router.push(`/profile/${slug}`)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <AtSign color={colors.primaryLight} size={20} />

          <View style={styles.rowText}>
            <AppText variant="body" numberOfLines={1}>
              {profile?.displayName || `@${slug}`}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              @{slug}
              {profile?.label ? ` · ${profile.label}` : ''}
            </AppText>
          </View>

          <ChevronRight color={colors.muted} size={18} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.md,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pressed: {
    opacity: 0.8,
  },
});
