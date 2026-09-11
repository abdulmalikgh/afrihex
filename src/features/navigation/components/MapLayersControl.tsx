import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { CloudRain, Layers, Square, SquareCheckBig, TriangleAlert, Waves, Landmark } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { AppText } from '../../../components';
import { mapColors, mapElevation, mapShape } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';
import type { MapLayerKey, MapLayerState } from '../hooks/useMapLayers';

type LayerOption = {
  key: MapLayerKey;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Signed-in only; the endpoint behind it requires a key. */
  requiresAuth?: boolean;
};

const LAYER_OPTIONS: LayerOption[] = [
  {
    key: 'flood',
    label: 'Flood-prone zones',
    description: 'Areas that flood in heavy rain',
    icon: Waves,
  },
  {
    key: 'weather',
    label: 'Weather alerts',
    description: 'Official GMet warnings in force',
    icon: TriangleAlert,
  },
  {
    key: 'rain',
    label: 'Rain ahead',
    description: 'Where rain is likely in the next 6 hours',
    icon: CloudRain,
  },
  {
    key: 'incidents',
    label: 'Hazard reports',
    description: 'Accidents, flooding and blocked roads reported by others',
    icon: TriangleAlert,
  },
  {
    key: 'landmarks',
    label: 'Landmarks on the way',
    description: 'Places you will pass along the route',
    icon: Landmark,
    requiresAuth: true,
  },
];

type MapLayersControlProps = {
  layers: MapLayerState;
  activeCount: number;
  onToggle: (key: MapLayerKey) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Offset from the top of the stage, so the button clears the route header. */
  topOffset: number;
  isAuthenticated: boolean;
  /** A layer is being fetched — the map stays empty until it lands. */
  isLoading: boolean;
};

/**
 * The map's layer switch, mirroring the web app's `Layers` control.
 *
 * Kept as a button plus a panel rather than a row of floating chips: three
 * stacked pills is most of the usable width of a small phone, and these are
 * set-once controls that do not deserve permanent space over the map.
 */
export function MapLayersControl({
  layers,
  activeCount,
  onToggle,
  isOpen,
  onOpen,
  onClose,
  topOffset,
  isAuthenticated,
  isLoading,
}: MapLayersControlProps) {
  return (
    <>
      <View style={[styles.anchor, { top: topOffset }]} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            activeCount > 0 ? `Map layers, ${activeCount} on` : 'Map layers'
          }
          accessibilityState={{ expanded: isOpen }}
          onPress={onOpen}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={mapColors.primary} />
          ) : (
            <Layers color={activeCount > 0 ? mapColors.primary : mapColors.onSurfaceVariant} size={20} />
          )}
          <AppText variant="caption" style={styles.buttonLabel}>
            Layers
          </AppText>
          {/* The count doubles the "something is on" signal that the icon tint
              gives, so the state does not rest on colour alone. */}
          {activeCount > 0 ? (
            <View style={styles.badge}>
              <AppText variant="caption" style={styles.badgeText}>
                {activeCount}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      </View>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} accessibilityLabel="Close map layers" onPress={onClose}>
          <Pressable style={[styles.panel, { marginTop: topOffset }]} onPress={() => undefined}>
            <AppText variant="overline" style={styles.heading}>
              Map layers
            </AppText>

            {LAYER_OPTIONS.map((option) => {
              const disabled = option.requiresAuth === true && !isAuthenticated;
              const checked = layers[option.key];

              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="switch"
                  accessibilityLabel={option.label}
                  accessibilityHint={disabled ? 'Sign in to use this layer' : option.description}
                  accessibilityState={{ checked, disabled }}
                  disabled={disabled}
                  onPress={() => onToggle(option.key)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                    disabled && styles.rowDisabled,
                  ]}
                >
                  <option.icon color={mapColors.onSurfaceVariant} size={20} />

                  <View style={styles.rowText}>
                    <AppText variant="body" numberOfLines={1}>
                      {option.label}
                    </AppText>
                    <AppText variant="caption" tone="muted" numberOfLines={2}>
                      {disabled ? 'Sign in to use this layer' : option.description}
                    </AppText>
                  </View>

                  {checked ? (
                    <SquareCheckBig color={mapColors.primary} size={20} />
                  ) : (
                    <Square color={mapColors.outline} size={20} />
                  )}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 7,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    borderRadius: mapShape.full,
    backgroundColor: mapColors.surface,
    paddingHorizontal: spacing.md,
    ...mapElevation.level3,
  },
  buttonPressed: {
    backgroundColor: mapColors.surfaceContainerHigh,
  },
  buttonLabel: {
    color: mapColors.onSurface,
  },
  badge: {
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mapShape.full,
    backgroundColor: mapColors.primaryContainer,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  badgeText: {
    color: mapColors.onPrimaryContainer,
  },
  backdrop: {
    flex: 1,
    alignItems: 'flex-end',
    backgroundColor: mapColors.scrim,
    paddingHorizontal: spacing.lg,
  },
  panel: {
    width: '100%',
    maxWidth: 340,
    gap: spacing.xs,
    borderRadius: mapShape.large,
    backgroundColor: mapColors.surface,
    paddingVertical: spacing.md,
    ...mapElevation.level3,
  },
  heading: {
    color: mapColors.onSurfaceVariant,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rowPressed: {
    backgroundColor: mapColors.surfaceContainerHigh,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
