import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Share, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { buildStaticRouteMapUrl } from '../../../api/navigation';
import { planTransit } from '../../../api/transit';
import { autocompleteSearch, type AutocompleteResult } from '../../../api/search';
import type { RouteMode, RouteNarration } from '../../../api/route';
import { BottomSheet, Screen, type SheetSnapIndex } from '../../../components';
import { colors } from '../../../constants/colors';
import { spacing } from '../../../constants/spacing';
import { formatDistance } from '../../../utils/landmarkKinds';
import { hapticLight, hapticSelection, hapticSuccess, hapticWarning } from '../../../utils/haptics';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAuthSession } from '../../authentication/context/AuthSessionProvider';
import { DirectionsOverlay } from '../components/DirectionsOverlay';
import { MapLayersControl } from '../components/MapLayersControl';
import { RouteMap } from '../components/RouteMap';
import { ReportIncidentSheet } from '../components/ReportIncidentSheet';
import { RouteResultSheet } from '../components/RouteResultSheet';
import { TransitResultSheet } from '../components/TransitResultSheet';
import { useArrivalReport } from '../hooks/useArrivalReport';
import { useAvoidLocations } from '../hooks/useAvoidLocations';
import { useDirectionsPlanner } from '../hooks/useDirectionsPlanner';
import { useMapLayers, useRouteLandmarks } from '../hooks/useMapLayers';
import { useRouteEndpointSearch } from '../hooks/useRouteEndpointSearch';
import {
  MODE_OPTIONS,
  buildRouteRequest,
  formatDuration,
  getEndpointLabel,
  isRouteMode,
  isSuggestionListVisible,
  type TravelMode,
} from '../utils/directionsFormatting';

type FocusedField = 'from' | 'to';
type MapTapMode = 'endpoint' | 'avoid' | 'report';

/**
 * Where a tap on the grabber goes next.
 *
 * The resting stop is the peek — the height the screen opens at — so the bar
 * returns to the same card the user saw on arrival rather than to a taller
 * detent they never asked for. Medium stays reachable by dragging; it is a
 * resize, not a step in the cycle.
 */
const SHEET_TAP_CYCLE: readonly SheetSnapIndex[] = [0, 2, -1];

/** Destination handed over by Find, so the user never retypes a place they just found. */
type DirectionsParams = {
  toLat?: string;
  toLng?: string;
  toLabel?: string;
};

export function DirectionsScreen() {
  const insets = useSafeAreaInsets();
  const { status: authStatus } = useAuthSession();
  const isAuthenticated = authStatus === 'authenticated';

  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [focusedField, setFocusedField] = useState<FocusedField>('from');
  const [mode, setMode] = useState<TravelMode>('driving');
  const [narration, setNarration] = useState<RouteNarration>('both');
  const [avoidFloodZones, setAvoidFloodZones] = useState(false);
  const [avoidIncidents, setAvoidIncidents] = useState(false);
  const [liteRoute, setLiteRoute] = useState(false);
  const [mapTapMode, setMapTapMode] = useState<MapTapMode>('endpoint');
  const [sheetIndex, setSheetIndex] = useState<SheetSnapIndex>(0);
  const [stageHeight, setStageHeight] = useState(0);
  const [isLocating, setIsLocating] = useState(false);
  // Which field is waiting on the fix, so only that one shows a spinner.
  const [locatingField, setLocatingField] = useState<FocusedField | null>(null);
  const [isLocationBlocked, setIsLocationBlocked] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [selectedAlternativeIndex, setSelectedAlternativeIndex] = useState<number | null>(null);
  const [reportPoint, setReportPoint] = useState<{ lat: number; lng: number } | null>(null);

  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<DirectionsParams>();
  const mapLayers = useMapLayers();
  // Measured rather than assumed: the header's height moves with the safe area
  // and the font scale, and both the map padding and the sheet's ceiling depend
  // on it.
  const sheetTopInset = (headerHeight || insets.top + 156) + spacing.sm;

  const fromEndpoint = useRouteEndpointSearch({
    onResolved: (_, result) => setFromQuery(getEndpointLabel(result)),
  });
  const toEndpoint = useRouteEndpointSearch({
    onResolved: (_, result) => setToQuery(getEndpointLabel(result)),
  });
  const avoidLocations = useAvoidLocations();
  const planner = useDirectionsPlanner(isAuthenticated);

  const from = fromEndpoint.state.status === 'resolved' ? fromEndpoint.state.result : null;
  const to = toEndpoint.state.status === 'resolved' ? toEndpoint.state.result : null;
  const activeQuery = focusedField === 'from' ? fromQuery : toQuery;
  const debouncedQuery = useDebouncedValue(activeQuery.trim(), 250);

  const focusedEndpointState = focusedField === 'from' ? fromEndpoint.state : toEndpoint.state;
  const autocompleteQuery = useQuery({
    queryKey: ['directions', 'autocomplete', debouncedQuery],
    queryFn: () => autocompleteSearch({ q: debouncedQuery, limit: 5 }),
    enabled: debouncedQuery.length >= 2 && focusedEndpointState.status !== 'loading',
    staleTime: 10_000,
  });
  const suggestions = autocompleteQuery.data?.results ?? [];
  const isHeaderRegionBusy =
    locationMessage !== null ||
    isSuggestionListVisible({
      resolvedLabel:
        focusedEndpointState.status === 'resolved' ? getEndpointLabel(focusedEndpointState.result) : null,
      query: activeQuery,
      suggestionCount: suggestions.length,
    });

  useEffect(() => {
    switch (planner.state.status) {
      case 'success':
      case 'noRoute':
      case 'error':
        setSheetIndex(1);
        break;
      case 'idle':
        setSheetIndex(0);
        break;
      default:
        break;
    }
  }, [planner.state.status]);

  useEffect(() => {
    if (planner.state.status === 'success') {
      hapticSuccess();
    } else if (planner.state.status === 'noRoute' || planner.state.status === 'error') {
      hapticWarning();
    }
  }, [planner.state.status]);

  const handleFromChangeText = useCallback((value: string) => {
    setFromQuery(value);
  }, []);

  const handleToChangeText = useCallback((value: string) => {
    setToQuery(value);
  }, []);

  const handleFromSubmit = useCallback(() => {
    void fromEndpoint.submit(fromQuery);
  }, [fromEndpoint, fromQuery]);

  const handleToSubmit = useCallback(() => {
    void toEndpoint.submit(toQuery);
  }, [toEndpoint, toQuery]);

  const handleSuggestionPress = useCallback(
    (suggestion: AutocompleteResult) => {
      if (focusedField === 'from') {
        setFromQuery(suggestion.display_name);
        void fromEndpoint.submit(suggestion.display_name);
      } else {
        setToQuery(suggestion.display_name);
        void toEndpoint.submit(suggestion.display_name);
      }
    },
    [focusedField, fromEndpoint, toEndpoint],
  );

  const handleSwap = useCallback(() => {
    const prevFromState = fromEndpoint.state;
    const prevToState = toEndpoint.state;
    const prevFromQuery = fromQuery;
    const prevToQuery = toQuery;

    setFromQuery(prevToQuery);
    setToQuery(prevFromQuery);

    if (prevToState.status === 'resolved') {
      fromEndpoint.setResolved(prevToState.label, prevToState.result);
    } else {
      fromEndpoint.reset();
    }

    if (prevFromState.status === 'resolved') {
      toEndpoint.setResolved(prevFromState.label, prevFromState.result);
    } else {
      toEndpoint.reset();
    }

    hapticSelection();
  }, [fromEndpoint, fromQuery, toEndpoint, toQuery]);

  /**
   * Fills one endpoint with the device's position. Both fields offer it: a
   * courier routing *to* where they are standing is as ordinary as routing from
   * it, and only the start had the button before.
   */
  const handleCurrentLocation = useCallback(async (field: FocusedField = 'from') => {
    if (isLocationBlocked) {
      await Linking.openSettings();
      setLocationMessage('Enable location for AfriHex in Settings, then return and tap the location button.');
      return;
    }

    setIsLocating(true);
    setLocatingField(field);
    setLocationMessage(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        if (!permission.canAskAgain) {
          setIsLocationBlocked(true);
          setLocationMessage('Location is blocked. Tap the location button again to open Settings.');
          return;
        }

        setLocationMessage('Location permission is off. Tap the location button again to allow it.');
        return;
      }

      setIsLocationBlocked(false);

      const lastKnownPosition = await Location.getLastKnownPositionAsync({
        maxAge: 60_000,
        requiredAccuracy: 250,
      });
      const position =
        lastKnownPosition ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));

      const target = field === 'to' ? toEndpoint : fromEndpoint;
      const setQueryText = field === 'to' ? setToQuery : setFromQuery;

      setQueryText('Current location');
      await target.resolveFromCoordinates('Current location', position.coords.latitude, position.coords.longitude);
    } catch (error) {
      setLocationMessage(error instanceof Error ? error.message : 'Could not read your location.');
    } finally {
      setIsLocating(false);
      setLocatingField(null);
    }
  }, [fromEndpoint, isLocationBlocked, toEndpoint]);

  const hasAppliedHandoff = useRef(false);

  /**
   * Applies the destination Find handed over.
   *
   * The origin is only filled in when location permission is *already* granted:
   * arriving on this screen is not the user asking to be located, and a system
   * prompt they did not tap for is a poor way to open a screen. If it is not
   * granted the From field is simply left for them, with the location button
   * right beside it.
   */
  useEffect(() => {
    if (hasAppliedHandoff.current) {
      return;
    }

    const lat = Number(params.toLat);
    const lng = Number(params.toLng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    hasAppliedHandoff.current = true;

    const label = params.toLabel ?? 'Selected place';
    setToQuery(label);
    void toEndpoint.resolveFromCoordinates(label, lat, lng);

    void (async () => {
      const permission = await Location.getForegroundPermissionsAsync();

      if (!permission.granted) {
        setFocusedField('from');
        return;
      }

      await handleCurrentLocation();
    })();
  }, [handleCurrentLocation, params.toLabel, params.toLat, params.toLng, toEndpoint]);

  /**
   * Reports at the device's own position by default.
   *
   * This is how Waze and Google do it, and it matches the moment: someone
   * reporting flooding is standing in it. Picking a point on a map first is a
   * step that only makes sense for a hazard you are *not* at, so that stays
   * available as the fallback when there is no fix.
   */
  const handleReportHazard = useCallback(async () => {
    const permission = await Location.getForegroundPermissionsAsync();

    if (!permission.granted) {
      setMapTapMode('report');
      setLocationMessage('Location is off — long-press the map to place the report instead.');
      return;
    }

    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setReportPoint({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch {
      setMapTapMode('report');
      setLocationMessage('Could not read your location — long-press the map to place the report.');
    }
  }, []);

  const handleToggleAddAvoidLocation = useCallback(() => {
    setMapTapMode((current) => (current === 'avoid' ? 'endpoint' : 'avoid'));
  }, []);

  const handleMapLongPress = useCallback(
    (lat: number, lng: number) => {
      if (mapTapMode === 'avoid') {
        setMapTapMode('endpoint');
        void avoidLocations.add(lat, lng);
        return;
      }

      if (mapTapMode === 'report') {
        setMapTapMode('endpoint');
        setReportPoint({ lat, lng });
        return;
      }

      const target = focusedField === 'to' ? toEndpoint : fromEndpoint;
      const setQueryText = focusedField === 'to' ? setToQuery : setFromQuery;

      setQueryText('Map pin');
      void target.resolveFromCoordinates('Map pin', lat, lng);
    },
    [avoidLocations, focusedField, fromEndpoint, mapTapMode, toEndpoint],
  );

  /**
   * Google plans the moment it has somewhere to go, with no button — so the
   * request is derived from state rather than assembled on a press. Memoised so
   * its identity only changes when something that affects the route changes,
   * which is what drives the effect below.
   */
  const routeRequest = useMemo(() => {
    // Transit is planned by a different endpoint with a different body, so it
    // produces no route request at all.
    if (!from || !to || !isRouteMode(mode)) {
      return null;
    }

    return buildRouteRequest({
      from,
      to,
      mode,
      narration,
      avoidFloodZones,
      avoidIncidents,
      lite: liteRoute,
      avoidLocations: avoidLocations.items.map((item) => ({ lat: item.lat, lng: item.lng })),
    });
  }, [avoidFloodZones, avoidIncidents, avoidLocations.items, from, liteRoute, mode, narration, to]);

  const { plan: planRouteRequest, reset: resetPlanner } = planner;

  useEffect(() => {
    if (!routeRequest) {
      resetPlanner();

      return;
    }

    void planRouteRequest(routeRequest);
  }, [planRouteRequest, resetPlanner, routeRequest]);

  const handleModeChange = useCallback((next: TravelMode) => {
    setMode(next);
    hapticSelection();
  }, []);

  const handleNarrationChange = useCallback((next: RouteNarration) => {
    setNarration(next);
    hapticSelection();
  }, []);

  const handleSheetIndexChange = useCallback((next: SheetSnapIndex) => {
    hapticLight();
    setSheetIndex(next);
  }, []);

  const handleStageLayout = useCallback((event: LayoutChangeEvent) => {
    setStageHeight(event.nativeEvent.layout.height);
  }, []);

  /**
   * The transit plan, run off the same From/To the driving modes use. Google and
   * Apple both keep one pair of endpoints across every mode — retyping the trip
   * to switch from driving to a trotro is the thing this avoids.
   */
  const transitQuery = useQuery({
    queryKey: ['transit', 'plan', from?.latitude, from?.longitude, to?.latitude, to?.longitude],
    queryFn: () =>
      planTransit({
        fromLat: from?.latitude ?? 0,
        fromLng: from?.longitude ?? 0,
        toLat: to?.latitude ?? 0,
        toLng: to?.longitude ?? 0,
      }),
    enabled: mode === 'transit' && from !== null && to !== null,
    staleTime: 60_000,
  });

  const plannedRoute = planner.state.status === 'success' ? planner.state.route : null;

  // A fresh plan invalidates the old selection: index 1 of the previous result
  // has nothing to do with index 1 of this one.
  useEffect(() => {
    setSelectedAlternativeIndex(null);
  }, [plannedRoute]);

  const routeLandmarks = useRouteLandmarks({
    coordinates: plannedRoute?.coordinates ?? null,
    enabled: mapLayers.layers.landmarks && isAuthenticated,
  });

  // Memoised because the arrival hook subscribes to position updates keyed on
  // these: a fresh object each render would tear the watch down and re-register
  // it on every keystroke in the search field.
  const originPoint = useMemo(
    () => (from ? { lat: from.latitude, lng: from.longitude } : null),
    [from],
  );
  const destinationPoint = useMemo(
    () => (to ? { lat: to.latitude, lng: to.longitude } : null),
    [to],
  );

  const arrival = useArrivalReport({
    origin: originPoint,
    destination: destinationPoint,
    route: plannedRoute,
    mode: isRouteMode(mode) ? mode : 'foot',
  });

  /**
   * Shares the route as the server-rendered PNG rather than a screenshot or a
   * coordinate dump: it is public, needs no key, and survives being forwarded to
   * someone who does not have the app.
   */
  const handleShareRoute = useCallback(async () => {
    if (!from || !to || !plannedRoute) {
      return;
    }

    const imageUrl = buildStaticRouteMapUrl({
      from: { lat: from.latitude, lng: from.longitude },
      to: { lat: to.latitude, lng: to.longitude },
      mode: isRouteMode(mode) ? mode : 'foot',
    });

    await Share.share({
      message: [
        `${getEndpointLabel(from)} → ${getEndpointLabel(to)}`,
        `${formatDuration(plannedRoute.etaS)} · ${formatDistance(plannedRoute.distanceM)}`,
        imageUrl,
      ].join('\n'),
    });
  }, [from, mode, plannedRoute, to]);

  const handleReportArrival = useCallback(() => {
    arrival.reportManually();
    hapticSuccess();
  }, [arrival]);

  const modeLabel = MODE_OPTIONS.find((option) => option.value === mode)?.label ?? 'Drive';

  // The bar is all that's left on screen, so it carries the headline rather than
  // a generic prompt — a glance at it answers "how long is this trip".
  const minimizedLabel = getMinimizedLabel();

  /**
   * The bar is all that is left on screen, so it carries the headline for
   * whichever mode is active — a driving ETA, or the best trotro option.
   */
  function getMinimizedLabel() {
    if (mode === 'transit') {
      const plan = transitQuery.data;

      if (!plan) {
        return 'Tap to plan a trotro trip';
      }

      if (plan.noTransit) {
        return 'No trotro for this trip';
      }

      const best = plan.itineraries[0];

      return best?.durationS ? `${formatDuration(best.durationS)} by trotro` : 'Trotro options';
    }

    return plannedRoute
      ? `${formatDuration(plannedRoute.etaS)} · ${formatDistance(plannedRoute.distanceM)}`
      : 'Tap to plan a route';
  }

  return (
    <Screen bleed maskStatusBar={false}>
      <View style={styles.stage} onLayout={handleStageLayout}>
        <RouteMap
          from={from}
          to={to}
          route={plannedRoute}
          selectedAlternativeIndex={selectedAlternativeIndex}
          avoidLocations={avoidLocations.items}
          floodZones={mapLayers.floodZones}
          weatherAlerts={mapLayers.weatherAlerts}
          precipitation={mapLayers.precipitation}
          incidents={mapLayers.incidents}
          routeLandmarks={routeLandmarks}
          mapPaddingTop={sheetTopInset}
          onLongPress={handleMapLongPress}
          onRemoveAvoidLocation={avoidLocations.remove}
        />

        <DirectionsOverlay
          topInset={insets.top}
          onBack={() => router.back()}
          onLayoutHeight={setHeaderHeight}
          fromQuery={fromQuery}
          toQuery={toQuery}
          onFromChangeText={handleFromChangeText}
          onToChangeText={handleToChangeText}
          onFromSubmit={handleFromSubmit}
          onToSubmit={handleToSubmit}
          onFocusField={setFocusedField}
          focusedField={focusedField}
          fromState={fromEndpoint.state}
          toState={toEndpoint.state}
          suggestions={suggestions}
          onSuggestionPress={handleSuggestionPress}
          onSwap={handleSwap}
          isLocating={isLocating}
          locatingField={locatingField}
          onCurrentLocation={(field) => void handleCurrentLocation(field)}
          locationMessage={locationMessage}
          mode={mode}
          onModeChange={handleModeChange}
          narration={narration}
          onNarrationChange={handleNarrationChange}
          avoidFloodZones={avoidFloodZones}
          onToggleAvoidFloodZones={setAvoidFloodZones}
          avoidIncidents={avoidIncidents}
          onToggleAvoidIncidents={setAvoidIncidents}
          liteRoute={liteRoute}
          onToggleLiteRoute={setLiteRoute}
          avoidLocations={avoidLocations.items}
          onRemoveAvoidLocation={avoidLocations.remove}
          isAddingAvoidLocation={mapTapMode === 'avoid'}
          onToggleAddAvoidLocation={handleToggleAddAvoidLocation}
          isReportingHazard={mapTapMode === 'report'}
          onToggleReportHazard={() => void handleReportHazard()}
          isMenuOpen={isMenuOpen}
          onOpenMenu={() => setIsMenuOpen(true)}
          onCloseMenu={() => setIsMenuOpen(false)}
          isPlanning={planner.state.status === 'loading'}
        />

        {/* The suggestion list and the location notice both occupy the strip
            directly under the header, which is where this button lives — so it
            stands down while either of them is on screen rather than floating
            over their text. */}
        {isHeaderRegionBusy ? null : (
          <MapLayersControl
            layers={mapLayers.layers}
            activeCount={mapLayers.activeCount}
            onToggle={mapLayers.toggle}
            isOpen={isLayersOpen}
            onOpen={() => setIsLayersOpen(true)}
            onClose={() => setIsLayersOpen(false)}
            topOffset={sheetTopInset}
            isAuthenticated={isAuthenticated}
            isLoading={mapLayers.isLoading}
          />
        )}

        <ReportIncidentSheet
          visible={reportPoint !== null}
          point={reportPoint}
          onClose={() => setReportPoint(null)}
          onReported={() => {
            // The layer is polled, but a report the user just filed should show
            // up immediately rather than on the next 30s tick.
            void queryClient.invalidateQueries({ queryKey: ['map-layers', 'incidents'] });
          }}
        />

        {/* Rendered even when idle: the sheet is where a mode selection shows up
            before there is a route to redraw, so hiding it is what made the mode
            tabs look inert. */}
        <BottomSheet
          index={sheetIndex}
          onIndexChange={handleSheetIndexChange}
          availableHeight={stageHeight || undefined}
          topInset={sheetTopInset}
          bottomInset={insets.bottom || spacing.md}
          minimizedLabel={minimizedLabel}
          tapCycle={SHEET_TAP_CYCLE}
        >
          {mode === 'transit' ? (
            <TransitResultSheet
              isLoading={transitQuery.isPending && from !== null && to !== null}
              hasEndpoints={from !== null && to !== null}
              plan={transitQuery.data ?? null}
              errorMessage={transitQuery.error ? 'Could not plan that trip.' : null}
            />
          ) : (
          <RouteResultSheet
            state={planner.state}
            selectedAlternativeIndex={selectedAlternativeIndex}
            onSelectAlternative={setSelectedAlternativeIndex}
            onShare={() => void handleShareRoute()}
            onReportArrival={handleReportArrival}
            hasReportedArrival={arrival.hasReported}
            modeLabel={modeLabel}
            hasOrigin={from !== null}
            hasDestination={to !== null}
            isLiteRoute={liteRoute}
          />
          )}
        </BottomSheet>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    // Backstop for the same white flash the map guards against: this is what
    // shows in the instant before the map view has any surface at all.
    backgroundColor: colors.surface,
  },
});
