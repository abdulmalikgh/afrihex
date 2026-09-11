import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  ArrowLeft,
  ArrowUpDown,
  Bike,
  Bus,
  Car,
  Check,
  Clock,
  EllipsisVertical,
  Footprints,
  Gauge,
  LocateFixed,
  MapPin,
  Mic,
  Motorbike,
  Square,
  SquareCheckBig,
  TriangleAlert,
  Waves,
  X,
  type LucideIcon,
} from 'lucide-react-native';

import { AppText } from '../../../components';
import { mapColors, mapElevation, mapShape } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';
import { fontFamilies, fontSizes } from '../../../constants/typography';
import type { AutocompleteResult } from '../../../api/search';
import type { RouteNarration } from '../../../api/route';
import type { TravelMode } from '../utils/directionsFormatting';
import type { AvoidLocation } from '../hooks/useAvoidLocations';
import type { RouteEndpointState } from '../hooks/useRouteEndpointSearch';
import { NARRATION_OPTIONS, getEndpointLabel, isSuggestionListVisible } from '../utils/directionsFormatting';
import { useVoiceInput } from '../hooks/useVoiceInput';

type FocusedField = 'from' | 'to';

/** Smallest comfortable tap target: 44pt on iOS, 48dp on Android. */
const MIN_TARGET = 44;

/**
 * Travel modes as icons, the way Google shows them. Order runs fastest to
 * slowest, and okada sits second because it is the common alternative to driving
 * in Ghanaian cities.
 */
const MODE_TABS: ReadonlyArray<{ value: TravelMode; icon: LucideIcon; label: string }> = [
  { value: 'driving', icon: Car, label: 'Drive' },
  { value: 'motor_scooter', icon: Motorbike, label: 'Okada' },
  // Transit sits with the other ways of getting there, the way Google and Apple
  // place it — it is a travel mode, not a separate feature to go and find.
  { value: 'transit', icon: Bus, label: 'Trotro' },
  { value: 'bicycle', icon: Bike, label: 'Bike' },
  { value: 'foot', icon: Footprints, label: 'Walk' },
] as const;

type DirectionsOverlayProps = {
  topInset: number;
  onBack: () => void;
  onLayoutHeight: (height: number) => void;
  fromQuery: string;
  toQuery: string;
  onFromChangeText: (value: string) => void;
  onToChangeText: (value: string) => void;
  onFromSubmit: () => void;
  onToSubmit: () => void;
  onFocusField: (field: FocusedField) => void;
  focusedField: FocusedField;
  fromState: RouteEndpointState;
  toState: RouteEndpointState;
  suggestions: AutocompleteResult[];
  onSuggestionPress: (suggestion: AutocompleteResult) => void;
  onSwap: () => void;
  isLocating: boolean;
  /** Which field is waiting on a fix, so only that one spins. */
  locatingField: FocusedField | null;
  onCurrentLocation: (field: FocusedField) => void;
  locationMessage: string | null;
  mode: TravelMode;
  onModeChange: (mode: TravelMode) => void;
  narration: RouteNarration;
  onNarrationChange: (narration: RouteNarration) => void;
  avoidFloodZones: boolean;
  onToggleAvoidFloodZones: (value: boolean) => void;
  avoidIncidents: boolean;
  onToggleAvoidIncidents: (value: boolean) => void;
  /** Data saver: asks the API for polyline and ETA only. */
  liteRoute: boolean;
  onToggleLiteRoute: (value: boolean) => void;
  avoidLocations: AvoidLocation[];
  onRemoveAvoidLocation: (id: string) => void;
  isAddingAvoidLocation: boolean;
  onToggleAddAvoidLocation: () => void;
  isReportingHazard: boolean;
  onToggleReportHazard: () => void;
  isMenuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  isPlanning: boolean;
};

/**
 * The directions header, following Google Maps: one opaque panel pinned to the
 * top holding both endpoint fields, the swap control, an overflow menu and the
 * travel-mode tabs — rather than a stack of translucent cards floating over the
 * map. Everything that is not an endpoint or a mode lives behind the ⋮ menu, so
 * the panel keeps a fixed height and the map keeps the rest of the screen.
 */
export function DirectionsOverlay({
  topInset,
  onBack,
  onLayoutHeight,
  fromQuery,
  toQuery,
  onFromChangeText,
  onToChangeText,
  onFromSubmit,
  onToSubmit,
  onFocusField,
  focusedField,
  fromState,
  toState,
  suggestions,
  onSuggestionPress,
  onSwap,
  isLocating,
  locatingField,
  onCurrentLocation,
  locationMessage,
  mode,
  onModeChange,
  narration,
  onNarrationChange,
  avoidFloodZones,
  onToggleAvoidFloodZones,
  avoidIncidents,
  onToggleAvoidIncidents,
  liteRoute,
  onToggleLiteRoute,
  avoidLocations,
  onRemoveAvoidLocation,
  isAddingAvoidLocation,
  onToggleAddAvoidLocation,
  isReportingHazard,
  onToggleReportHazard,
  isMenuOpen,
  onOpenMenu,
  onCloseMenu,
  isPlanning,
}: DirectionsOverlayProps) {
  const focusedState = focusedField === 'from' ? fromState : toState;
  const focusedQuery = focusedField === 'from' ? fromQuery : toQuery;
  // Once the focused field's text is exactly the label a resolution produced, the
  // dropdown would otherwise keep matching itself and never close — only show it
  // while the user is actively typing something new.
  const showSuggestions = isSuggestionListVisible({
    resolvedLabel: focusedState.status === 'resolved' ? getEndpointLabel(focusedState.result) : null,
    query: focusedQuery,
    suggestionCount: suggestions.length,
  });

  return (
    <>
      <View
        style={[styles.header, { paddingTop: topInset + spacing.sm }]}
        onLayout={(event) => onLayoutHeight(event.nativeEvent.layout.height)}
      >
        <View style={styles.headerRow}>
          <IconButton label="Go back" icon={ArrowLeft} onPress={onBack} />

          <View style={styles.fields}>
            <EndpointField
              onVoice={(text) => {
                onFromChangeText(text);
                onFromSubmit();
              }}
              value={fromQuery}
              placeholder="Start, hex code or lat, lng"
              accessibilityLabel="Route start"
              onChangeText={onFromChangeText}
              onFocus={() => onFocusField('from')}
              onSubmitEditing={onFromSubmit}
              onClear={() => onFromChangeText('')}
              busy={locatingField === 'from' || fromState.status === 'loading'}
              trailing={
                <IconButton
                  label="Use current location as start"
                  icon={LocateFixed}
                  onPress={() => onCurrentLocation('from')}
                  disabled={isLocating}
                  size={32}
                  iconSize={18}
                />
              }
            />

            <EndpointField
              onVoice={(text) => {
                onToChangeText(text);
                onToSubmit();
              }}
              value={toQuery}
              placeholder="Destination, hex code or lat, lng"
              accessibilityLabel="Route destination"
              onChangeText={onToChangeText}
              onFocus={() => onFocusField('to')}
              onSubmitEditing={onToSubmit}
              onClear={() => onToChangeText('')}
              busy={locatingField === 'to' || toState.status === 'loading'}
              trailing={
                <IconButton
                  label="Use current location as destination"
                  icon={LocateFixed}
                  onPress={() => onCurrentLocation('to')}
                  disabled={isLocating}
                  size={32}
                  iconSize={18}
                />
              }
            />
          </View>

          <View style={styles.headerControls}>
            <IconButton label="Route options" icon={EllipsisVertical} onPress={onOpenMenu} />
            <IconButton label="Swap start and destination" icon={ArrowUpDown} onPress={onSwap} />
          </View>
        </View>

        <View style={styles.modeTabs} accessibilityRole="tablist">
          {MODE_TABS.map((tab) => {
            const selected = tab.value === mode;

            return (
              <Pressable
                key={tab.value}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected }}
                onPress={() => onModeChange(tab.value)}
                style={({ pressed }) => [styles.modeTab, selected && styles.modeTabSelected, pressed && styles.pressed]}
              >
                <tab.icon
                  color={selected ? mapColors.onPrimaryContainer : mapColors.onSurfaceVariant}
                  size={22}
                />
              </Pressable>
            );
          })}
        </View>

        {isPlanning ? <View style={styles.progressBar} /> : null}
      </View>

      {locationMessage ? (
        <View style={[styles.notice, { top: topInset + HEADER_BODY_HEIGHT }]}>
          <AppText variant="caption" style={styles.noticeText}>
            {locationMessage}
          </AppText>
        </View>
      ) : null}

      {showSuggestions ? (
        <View style={[styles.suggestionSheet, { paddingTop: topInset + HEADER_BODY_HEIGHT }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {suggestions.map((suggestion) => (
              <Pressable
                key={`${suggestion.name}-${suggestion.latitude}-${suggestion.longitude}`}
                accessibilityRole="button"
                onPress={() => onSuggestionPress(suggestion)}
                style={({ pressed }) => [styles.suggestionRow, pressed && styles.rowPressed]}
              >
                <MapPin color={mapColors.onSurfaceVariant} size={20} />
                <View style={styles.suggestionText}>
                  <AppText variant="body" numberOfLines={1} style={styles.suggestionTitle}>
                    {suggestion.name}
                  </AppText>
                  <AppText variant="caption" numberOfLines={1} style={styles.suggestionSubtitle}>
                    {suggestion.display_name}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <RouteOptionsMenu
        visible={isMenuOpen}
        onClose={onCloseMenu}
        topInset={topInset}
        narration={narration}
        onNarrationChange={onNarrationChange}
        avoidFloodZones={avoidFloodZones}
        onToggleAvoidFloodZones={onToggleAvoidFloodZones}
        avoidIncidents={avoidIncidents}
        onToggleAvoidIncidents={onToggleAvoidIncidents}
        liteRoute={liteRoute}
        onToggleLiteRoute={onToggleLiteRoute}
        avoidLocations={avoidLocations}
        onRemoveAvoidLocation={onRemoveAvoidLocation}
        isAddingAvoidLocation={isAddingAvoidLocation}
        onToggleAddAvoidLocation={onToggleAddAvoidLocation}
        isReportingHazard={isReportingHazard}
        onToggleReportHazard={onToggleReportHazard}
      />
    </>
  );
}

/** Height of the header below the safe area, for positioning things under it. */
const HEADER_BODY_HEIGHT = 156;

function EndpointField({
  value,
  placeholder,
  accessibilityLabel,
  onChangeText,
  onFocus,
  onSubmitEditing,
  onClear,
  onVoice,
  busy,
  trailing,
}: {
  value: string;
  placeholder: string;
  accessibilityLabel: string;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  onSubmitEditing: () => void;
  onClear: () => void;
  /** Receives a spoken place, already stripped of command phrasing. */
  onVoice: (text: string) => void;
  busy: boolean;
  trailing?: ReactNode;
}) {
  const voice = useVoiceInput({ onTranscript: onVoice });
  return (
    <View style={styles.field}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={mapColors.onSurfaceVariant}
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.fieldInput}
      />

      {busy ? <ActivityIndicator color={mapColors.primary} size="small" /> : null}

      {!busy && value.length > 0 ? (
        <IconButton label="Clear" icon={X} onPress={onClear} size={32} iconSize={18} />
      ) : null}

      {/* Dictation fills this field. Speaking a destination and typing one
          should end in the same box, not on different screens.

          Always rendered, including when the native recogniser is missing from
          the running binary: tapping it then explains why rather than leaving a
          control the user expected to silently not exist. A feature that
          disappears without a word is the harder failure to diagnose. */}
      <Pressable
          accessibilityRole="button"
          accessibilityLabel={voice.isListening ? 'Stop listening' : 'Speak this place'}
          accessibilityState={{ busy: voice.isListening }}
          onPress={voice.toggle}
          hitSlop={6}
          style={({ pressed }) => [styles.voiceButton, pressed && styles.pressed]}
        >
          {voice.isParsing ? (
            <ActivityIndicator color={mapColors.primary} size="small" />
          ) : (
            <Mic color={voice.isListening ? mapColors.primary : mapColors.onSurfaceVariant} size={18} />
          )}
        </Pressable>

      {trailing}
    </View>
  );
}

function IconButton({
  label,
  icon: Icon,
  onPress,
  disabled = false,
  size = 40,
  iconSize = 22,
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  iconSize?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      // The header packs two fields and four controls into one row, so these stay
      // visually small and grow their hit area instead — 44pt minimum either way.
      hitSlop={Math.max(0, (MIN_TARGET - size) / 2)}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Icon color={mapColors.onSurfaceVariant} size={iconSize} />
    </Pressable>
  );
}

/**
 * The ⋮ menu. Holds everything Google keeps out of its header — for us that is
 * narration style and the two avoidance controls, which are AfriHex-specific and
 * changed rarely enough not to earn permanent screen space.
 */
function RouteOptionsMenu({
  visible,
  onClose,
  topInset,
  narration,
  onNarrationChange,
  avoidFloodZones,
  onToggleAvoidFloodZones,
  avoidIncidents,
  onToggleAvoidIncidents,
  liteRoute,
  onToggleLiteRoute,
  avoidLocations,
  onRemoveAvoidLocation,
  isAddingAvoidLocation,
  onToggleAddAvoidLocation,
  isReportingHazard,
  onToggleReportHazard,
}: {
  visible: boolean;
  onClose: () => void;
  topInset: number;
  narration: RouteNarration;
  onNarrationChange: (narration: RouteNarration) => void;
  avoidFloodZones: boolean;
  onToggleAvoidFloodZones: (value: boolean) => void;
  avoidIncidents: boolean;
  onToggleAvoidIncidents: (value: boolean) => void;
  liteRoute: boolean;
  onToggleLiteRoute: (value: boolean) => void;
  avoidLocations: AvoidLocation[];
  onRemoveAvoidLocation: (id: string) => void;
  isAddingAvoidLocation: boolean;
  onToggleAddAvoidLocation: () => void;
  isReportingHazard: boolean;
  onToggleReportHazard: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.menuBackdrop} accessibilityLabel="Close menu" onPress={onClose}>
        <Pressable style={[styles.menuPanel, { marginTop: topInset + spacing.xl }]} onPress={() => undefined}>
          <AppText variant="overline" style={styles.menuHeading}>
            Directions style
          </AppText>

          {NARRATION_OPTIONS.map((option) => (
            <MenuRow
              key={option.value}
              icon={Clock}
              label={`${option.label} directions`}
              onPress={() => {
                onNarrationChange(option.value);
                onClose();
              }}
              trailing={option.value === narration ? <Check color={mapColors.primary} size={20} /> : null}
            />
          ))}

          <View style={styles.menuDivider} />

          <AppText variant="overline" style={styles.menuHeading}>
            Route options
          </AppText>

          <MenuRow
            icon={Waves}
            label="Avoid flood-prone roads"
            onPress={() => onToggleAvoidFloodZones(!avoidFloodZones)}
            trailing={
              avoidFloodZones ? (
                <SquareCheckBig color={mapColors.primary} size={20} />
              ) : (
                <Square color={mapColors.outline} size={20} />
              )
            }
          />

          <MenuRow
            icon={TriangleAlert}
            label="Avoid reported hazards"
            onPress={() => onToggleAvoidIncidents(!avoidIncidents)}
            trailing={
              avoidIncidents ? (
                <SquareCheckBig color={mapColors.primary} size={20} />
              ) : (
                <Square color={mapColors.outline} size={20} />
              )
            }
          />

          <MenuRow
            icon={Gauge}
            label="Use less data"
            onPress={() => onToggleLiteRoute(!liteRoute)}
            trailing={
              liteRoute ? (
                <SquareCheckBig color={mapColors.primary} size={20} />
              ) : (
                <Square color={mapColors.outline} size={20} />
              )
            }
          />

          <MenuRow
            icon={MapPin}
            label={isAddingAvoidLocation ? 'Tap the map to pick a spot' : 'Avoid a place on the map'}
            onPress={() => {
              onToggleAddAvoidLocation();
              onClose();
            }}
          />

          <View style={styles.menuDivider} />

          <MenuRow
            icon={TriangleAlert}
            label={isReportingHazard ? 'Long-press the map to place it' : 'Report a hazard here'}
            onPress={() => {
              onToggleReportHazard();
              onClose();
            }}
          />

          {avoidLocations.map((item) => (
            <MenuRow
              key={item.id}
              icon={MapPin}
              label={item.label}
              muted
              onPress={() => onRemoveAvoidLocation(item.id)}
              trailing={<X color={mapColors.onSurfaceVariant} size={18} />}
            />
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuRow({
  icon: Icon,
  label,
  onPress,
  trailing,
  muted = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  trailing?: ReactNode;
  muted?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.rowPressed]}
    >
      <Icon color={mapColors.onSurfaceVariant} size={20} />
      <AppText variant="body" numberOfLines={1} style={[styles.menuLabel, muted && styles.menuLabelMuted]}>
        {label}
      </AppText>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 7,
    gap: spacing.md,
    borderBottomLeftRadius: mapShape.large,
    borderBottomRightRadius: mapShape.large,
    backgroundColor: mapColors.surface,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    ...mapElevation.level2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  fields: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    borderRadius: mapShape.medium,
    borderWidth: 1,
    borderColor: mapColors.outlineVariant,
    backgroundColor: mapColors.surfaceContainerLow,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.base,
    color: mapColors.onSurface,
  },
  headerControls: {
    gap: spacing.sm,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mapShape.full,
  },
  disabled: {
    opacity: 0.38,
  },
  pressed: {
    opacity: 0.7,
  },
  rowPressed: {
    backgroundColor: mapColors.surfaceContainer,
  },
  voiceButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  modeTab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mapShape.full,
  },
  modeTabSelected: {
    backgroundColor: mapColors.primaryContainer,
  },
  progressBar: {
    height: 2,
    marginHorizontal: spacing.sm,
    borderRadius: mapShape.full,
    backgroundColor: mapColors.primary,
    opacity: 0.6,
  },
  notice: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 6,
    borderRadius: mapShape.medium,
    backgroundColor: mapColors.errorContainer,
    padding: spacing.md,
    ...mapElevation.level2,
  },
  noticeText: {
    color: mapColors.onErrorContainer,
  },
  suggestionSheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 6,
    backgroundColor: mapColors.surface,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  suggestionText: {
    flex: 1,
    minWidth: 0,
  },
  suggestionTitle: {
    color: mapColors.onSurface,
  },
  suggestionSubtitle: {
    color: mapColors.onSurfaceVariant,
  },
  menuBackdrop: {
    flex: 1,
    alignItems: 'flex-end',
    backgroundColor: mapColors.scrim,
  },
  menuPanel: {
    minWidth: 260,
    maxWidth: 320,
    marginRight: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: mapShape.medium,
    backgroundColor: mapColors.surface,
    ...mapElevation.level3,
  },
  menuHeading: {
    color: mapColors.onSurfaceVariant,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  menuLabel: {
    flex: 1,
    minWidth: 0,
    color: mapColors.onSurface,
  },
  menuLabelMuted: {
    color: mapColors.onSurfaceVariant,
  },
  menuDivider: {
    height: 1,
    marginVertical: spacing.sm,
    backgroundColor: mapColors.outlineVariant,
  },
});
