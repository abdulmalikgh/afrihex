import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Check, TriangleAlert, X } from 'lucide-react-native';

import { ApiRequestError } from '../../../api/client';
import { INCIDENT_KINDS, reportRoadIncident, type IncidentKind } from '../../../api/navigation';
import { AppButton, AppInput, AppText, ErrorBanner } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { hapticSelection, hapticSuccess } from '../../../utils/haptics';

/** The server caps the note; enforced here so the limit is visible while typing. */
const NOTE_MAX_LENGTH = 500;

type ReportIncidentSheetProps = {
  visible: boolean;
  point: { lat: number; lng: number } | null;
  onClose: () => void;
  onReported: () => void;
};

/**
 * Filing a hazard report on a long-pressed point.
 *
 * A report near an existing one of the same kind *reinforces* it rather than
 * creating a duplicate, and the response says which happened — so the
 * confirmation distinguishes "thanks, you confirmed this" from "thanks, that is
 * now on the map". They mean different things to someone deciding whether to
 * trust what they see.
 */
export function ReportIncidentSheet({ visible, point, onClose, onReported }: ReportIncidentSheetProps) {
  const [kind, setKind] = useState<IncidentKind>('flooding');
  const [note, setNote] = useState('');
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const reportMutation = useMutation({
    mutationFn: reportRoadIncident,
    onSuccess: (result) => {
      hapticSuccess();
      setConfirmation(
        result.reportCount > 1
          ? `Thanks — ${result.reportCount} people have now reported this, so drivers can be routed around it.`
          : 'Thanks — it is on the map. A second report from someone else will let routing avoid it.',
      );
      setNote('');
      onReported();
    },
  });

  const handleClose = () => {
    setConfirmation(null);
    reportMutation.reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Close" onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.header}>
            <TriangleAlert color={colors.gold} size={20} />
            <AppText variant="subtitle" style={styles.headerTitle}>
              Report a hazard
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={handleClose}
              hitSlop={8}
              style={styles.close}
            >
              <X color={colors.muted} size={20} />
            </Pressable>
          </View>

          {confirmation ? (
            <View style={styles.confirmation}>
              <Check color={colors.primaryLight} size={20} />
              <AppText variant="body" tone="muted" style={styles.confirmationText}>
                {confirmation}
              </AppText>
            </View>
          ) : (
            <>
              <AppText variant="caption" tone="muted">
                Everyone routing through here will see it. Reports expire on their own — a few hours for
                an accident, a day for flooding.
              </AppText>

              {reportMutation.error ? <ErrorBanner message={getReportError(reportMutation.error)} /> : null}

              <View style={styles.kinds}>
                {INCIDENT_KINDS.map((option) => {
                  const selected = option.value === kind;

                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={option.label}
                      onPress={() => {
                        setKind(option.value);
                        hapticSelection();
                      }}
                      style={({ pressed }) => [
                        styles.kind,
                        selected && styles.kindSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <AppText variant="caption" tone={selected ? 'primary' : 'muted'}>
                        {option.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>

              <AppInput
                value={note}
                onChangeText={setNote}
                placeholder="Knee-deep at Alajo junction (optional)"
                multiline
                maxLength={NOTE_MAX_LENGTH}
                style={styles.note}
                accessibilityLabel="Note about the hazard"
              />

              <AppButton
                onPress={() => {
                  if (point) {
                    reportMutation.mutate({
                      kind,
                      lat: point.lat,
                      lng: point.lng,
                      ...(note.trim() ? { note: note.trim() } : {}),
                    });
                  }
                }}
                disabled={!point}
                loading={reportMutation.isPending}
              >
                Send report
              </AppButton>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function getReportError(error: unknown) {
  if (error instanceof ApiRequestError && error.status === 429) {
    return 'You have reported a few already. Try again a bit later.';
  }

  return error instanceof Error ? error.message : 'Could not send the report.';
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    gap: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.card,
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kinds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kind: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.md,
  },
  kindSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  note: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  confirmation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  confirmationText: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.7,
  },
});
