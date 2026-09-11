import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { Users } from 'lucide-react-native';

import { getMeetStatus } from '../../../api/meet';
import { AppText } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { forgetOwnedId, getEditToken, getOwnedIds } from '../../../storage/editTokens';

/** Sessions expire after six hours, so a finished one should drop off quickly. */
const STATUS_POLL_MS = 60_000;

/**
 * Meetups this device started, with live counts.
 *
 * `/v2/meet/{code}/status` needs no token, which is exactly what makes this
 * possible: it answers "is it still running, how many are there, how many
 * arrived" without joining and without appearing as a member. The session ids
 * come from local storage because the server has no list of what this device
 * created.
 */
export function ActiveMeetups() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Array<{ id: string; token: string | null }>>([]);

  const load = useCallback(async () => {
    const ids = await getOwnedIds('meet');
    const withTokens = await Promise.all(
      ids.map(async (id) => ({ id, token: await getEditToken('meet', id) })),
    );

    setSessions(withTokens);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statuses = useQueries({
    queries: sessions.map((session) => ({
      queryKey: ['meet', 'status', session.id],
      queryFn: () => getMeetStatus(session.id),
      refetchInterval: STATUS_POLL_MS,
      staleTime: STATUS_POLL_MS,
      retry: false,
    })),
  });

  // An expired or deleted session answers `active: false` (or 404s). Either way
  // it stops being something to show, and the local record goes with it.
  useEffect(() => {
    sessions.forEach((session, index) => {
      const query = statuses[index];

      if (query?.data && !query.data.active) {
        void forgetOwnedId('meet', session.id).then(load);
      }
    });
  }, [load, sessions, statuses]);

  const live = sessions
    .map((session, index) => ({ session, status: statuses[index]?.data }))
    .filter((entry) => entry.status?.active === true);

  if (live.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <AppText variant="overline" tone="muted">
        In progress
      </AppText>

      {live.map(({ session, status }) => (
        <Pressable
          key={session.id}
          accessibilityRole="button"
          accessibilityLabel={`Open meetup ${session.id}, ${status?.memberCount ?? 0} people, ${
            status?.arrivedCount ?? 0
          } arrived`}
          disabled={!session.token}
          onPress={() =>
            session.token &&
            router.push({ pathname: '/meet/[id]', params: { id: session.id, t: session.token } })
          }
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.liveDot} />
          <Users color={colors.primaryLight} size={18} />

          <View style={styles.rowText}>
            <AppText variant="body" numberOfLines={1}>
              {session.id}
            </AppText>
            <AppText variant="caption" tone="muted">
              {status?.memberCount ?? 0} here · {status?.arrivedCount ?? 0} arrived
            </AppText>
          </View>
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
  /** Paired with the count text, so "live" never rests on colour alone. */
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: radius.round,
    backgroundColor: colors.primaryLight,
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
