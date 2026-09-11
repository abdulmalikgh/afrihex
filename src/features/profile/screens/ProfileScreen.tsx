import { useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { AtSign, Eye, MapPin, Phone, Share2, Trash2 } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiRequestError } from '../../../api/client';
import { buildProfileUrl, deleteProfile, getProfile, updateProfile } from '../../../api/profile';
import { AppButton, AppInput, AppText, BackButton, ErrorBanner, LoadingState, Screen } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { hapticSuccess, hapticWarning } from '../../../utils/haptics';
import { clearEditToken, forgetOwnedId, getEditToken } from '../../../storage/editTokens';
import { CertificateAddressMap } from '../../certificates/components/CertificateAddressMap';

/**
 * A saved address profile. Public by default; the owner-only fields and the
 * edit controls appear only when this device holds the slug's edit token.
 */
export function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { slug: rawSlug } = useLocalSearchParams<{ slug?: string }>();
  const slug = typeof rawSlug === 'string' ? rawSlug : '';

  const [editToken, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');

  // Looked up before the profile fetch so the request can carry it and come
  // back with the owner-only fields in one round trip.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await getEditToken('profile', slug);

      if (!cancelled) {
        setToken(stored);
        setTokenChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const profileQuery = useQuery({
    queryKey: ['profile', slug, editToken ? 'owner' : 'public'],
    queryFn: () => getProfile(slug, editToken ?? undefined),
    enabled: slug.length > 0 && tokenChecked,
  });

  const profile = profileQuery.data;
  /**
   * Derived from what came back, not from holding a token. A wrong or stale
   * token is answered with the plain public view rather than a 401, so trusting
   * the stored token would show edit controls that 404 the moment they are used.
   * The four owner-only fields are present only when the token matched.
   */
  const isOwner =
    profile !== undefined &&
    (profile.phone !== undefined ||
      profile.alertEmail !== undefined ||
      profile.floodAlertsOn !== undefined);

  useEffect(() => {
    if (profile) {
      setLabel(profile.label ?? '');
      setNotes(profile.notes ?? '');
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: () => updateProfile(slug, editToken ?? '', { label, notes }),
    onSuccess: async () => {
      hapticSuccess();
      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ['profile', slug] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProfile(slug, editToken ?? ''),
    onSuccess: async () => {
      await clearEditToken('profile', slug);
      await forgetOwnedId('profile', slug);
      // The saved list reads these queries; leaving them cached would show the
      // deleted profile again the moment the previous screen re-rendered.
      queryClient.removeQueries({ queryKey: ['profile', slug] });
      router.back();
    },
  });

  const confirmDelete = () => {
    Alert.alert(
      `Delete @${slug}?`,
      'The link stops working for everyone you have shared it with. This cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            hapticWarning();
            deleteMutation.mutate();
          },
        },
      ],
    );
  };

  if (!slug) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackButton />

        <ErrorBanner message="No handle was given." />
      </Screen>
    );
  }

  if (profileQuery.isPending || !tokenChecked) {
    return <LoadingState label={`Loading @${slug}`} />;
  }

  if (profileQuery.error || !profile) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackButton />

        <ErrorBanner
          message={
            profileQuery.error instanceof ApiRequestError && profileQuery.error.status === 404
              ? 'No address is saved under that handle.'
              : 'Could not load this address.'
          }
        />
      </Screen>
    );
  }

  const url = buildProfileUrl(slug);

  return (
    <Screen scroll contentStyle={styles.content}>
        <BackButton />

      <View style={styles.card}>
        <View style={styles.titleRow}>
          <AtSign color={colors.primaryLight} size={22} />
          <AppText variant="subtitle" numberOfLines={2} style={styles.title}>
            {profile.displayName ?? slug}
          </AppText>
        </View>

        {profile.label ? (
          <View style={styles.metaRow}>
            <MapPin color={colors.muted} size={16} />
            <AppText variant="body" tone="muted" style={styles.metaText}>
              {profile.label}
            </AppText>
          </View>
        ) : null}

        {profile.notes ? (
          <AppText variant="caption" tone="muted">
            {profile.notes}
          </AppText>
        ) : null}

        {typeof profile.viewCount === 'number' ? (
          <View style={styles.metaRow}>
            <Eye color={colors.faint} size={14} />
            <AppText variant="caption" tone="faint">
              {profile.viewCount} view{profile.viewCount === 1 ? '' : 's'}
            </AppText>
          </View>
        ) : null}
      </View>

      {typeof profile.lat === 'number' && typeof profile.lng === 'number' ? (
        <CertificateAddressMap lat={profile.lat} lng={profile.lng} />
      ) : null}

      <View style={styles.actions}>
        <AppButton
          variant="secondary"
          icon={<Share2 color={colors.text} size={18} />}
          onPress={() => void Share.share({ message: `${profile.displayName ?? slug}\n${url}` })}
        >
          Share link
        </AppButton>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy the link"
          onPress={() => {
            void Clipboard.setStringAsync(url);
            Alert.alert('Copied', url);
          }}
          style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
        >
          <AppText variant="caption" numberOfLines={1} style={styles.linkText}>
            {url}
          </AppText>
        </Pressable>
      </View>

      {isOwner ? (
        <View style={styles.ownerSection}>
          <AppText variant="overline" tone="muted">
            Only you can see this
          </AppText>

          {profile.phone ? (
            <View style={styles.metaRow}>
              <Phone color={colors.muted} size={16} />
              <AppText variant="body" tone="muted">
                {profile.phone}
              </AppText>
            </View>
          ) : null}

          {profile.floodAlertsOn ? (
            <AppText variant="caption" tone="muted">
              Flood alerts go to {profile.alertEmail ?? 'your email'}.
            </AppText>
          ) : null}

          {saveMutation.error ? <ErrorBanner message={getOwnerError(saveMutation.error)} /> : null}
          {deleteMutation.error ? <ErrorBanner message={getOwnerError(deleteMutation.error)} /> : null}

          {isEditing ? (
            <>
              <View style={styles.field}>
                <AppText variant="caption" tone="muted">
                  Directions note
                </AppText>
                <AppInput value={label} onChangeText={setLabel} accessibilityLabel="Directions note" />
              </View>
              <View style={styles.field}>
                <AppText variant="caption" tone="muted">
                  Notes
                </AppText>
                <AppInput
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  style={styles.notesInput}
                  accessibilityLabel="Notes"
                />
              </View>
              <AppButton onPress={() => saveMutation.mutate()} loading={saveMutation.isPending}>
                Save changes
              </AppButton>
              <AppButton variant="ghost" onPress={() => setIsEditing(false)}>
                Cancel
              </AppButton>
            </>
          ) : (
            <AppButton variant="secondary" onPress={() => setIsEditing(true)}>
              Edit
            </AppButton>
          )}

          <AppButton
            variant="ghost"
            icon={<Trash2 color={colors.danger} size={18} />}
            onPress={confirmDelete}
            loading={deleteMutation.isPending}
          >
            Delete this address
          </AppButton>
        </View>
      ) : null}
    </Screen>
  );
}

/**
 * A wrong token and a missing slug both return `404` and the API does not
 * distinguish them — so this never claims the profile does not exist.
 */
function getOwnerError(error: unknown) {
  if (error instanceof ApiRequestError && error.status === 404) {
    return 'That did not go through. The edit code on this phone may no longer match this handle.';
  }

  return error instanceof Error ? error.message : 'Something went wrong.';
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  card: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaText: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    gap: spacing.sm,
  },
  linkRow: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.md,
  },
  linkText: {
    color: colors.muted,
  },
  ownerSection: {
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  notesInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  pressed: {
    opacity: 0.7,
  },
});
