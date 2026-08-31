import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { autocompleteSearch, type AutocompleteResult } from '../../../api/search';
import type { RouteMode, RouteNarration } from '../../../api/route';
import { BottomSheet, Screen, type SheetSnapIndex } from '../../../components';
import { spacing } from '../../../constants/spacing';
import { hapticLight, hapticSelection, hapticSuccess, hapticWarning } from '../../../utils/haptics';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAuthSession } from '../../authentication/context/AuthSessionProvider';
import { DirectionsOverlay } from '../components/DirectionsOverlay';
import { RouteMap } from '../components/RouteMap';
import { RouteResultSheet } from '../components/RouteResultSheet';
import { useAvoidLocations } from '../hooks/useAvoidLocations';
import { useDirectionsPlanner } from '../hooks/useDirectionsPlanner';
import { useRouteEndpointSearch } from '../hooks/useRouteEndpointSearch';
import { buildRouteRequest, getEndpointLabel } from '../utils/directionsFormatting';

type FocusedField = 'from' | 'to';
type MapTapMode = 'endpoint' | 'avoid';

export function DirectionsScreen() {
  const insets = useSafeAreaInsets();
  const { status: authStatus } = useAuthSession();
  const isAuthenticated = authStatus === 'authenticated';

  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [focusedField, setFocusedField] = useState<FocusedField>('from');
  const [mode, setMode] = useState<RouteMode>('driving');
  const [narration, setNarration] = useState<RouteNarration>('both');
  const [avoidFloodZones, setAvoidFloodZones] = useState(false);
  const [mapTapMode, setMapTapMode] = useState<MapTapMode>('endpoint');
  const [sheetIndex, setSheetIndex] = useState<SheetSnapIndex>(0);
  const [stageHeight, setStageHeight] = useState(0);
  const [isLocating, setIsLocating] = useState(false);
  const [isLocationBlocked, setIsLocationBlocked] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  const router = useRouter();
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

  const handleCurrentLocation = useCallback(async () => {
    if (isLocationBlocked) {
      await Linking.openSettings();
      setLocationMessage('Enable location for AfriHex in Settings, then return and tap the location button.');
      return;
    }

    setIsLocating(true);
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

      setFromQuery('Current location');
      await fromEndpoint.resolveFromCoordinates('Current location', position.coords.latitude, position.coords.longitude);
    } catch (error) {
      setLocationMessage(error instanceof Error ? error.message : 'Could not read your location.');
    } finally {
      setIsLocating(false);
    }
  }, [fromEndpoint, isLocationBlocked]);

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
    if (!from || !to) {
      return null;
    }

    return buildRouteRequest({
      from,
      to,
      mode,
      narration,
      avoidFloodZones,
      avoidLocations: avoidLocations.items.map((item) => ({ lat: item.lat, lng: item.lng })),
    });
  }, [avoidFloodZones, avoidLocations.items, from, mode, narration, to]);

  const { plan: planRouteRequest, reset: resetPlanner } = planner;

  useEffect(() => {
    if (!routeRequest) {
      resetPlanner();

      return;
    }

    void planRouteRequest(routeRequest);
  }, [planRouteRequest, resetPlanner, routeRequest]);

  const handleModeChange = useCallback((next: RouteMode) => {
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

  const plannedRoute = planner.state.status === 'success' ? planner.state.route : null;

  return (
    <Screen bleed maskStatusBar={false}>
      <View style={styles.stage} onLayout={handleStageLayout}>
        <RouteMap
          from={from}
          to={to}
          route={plannedRoute}
          avoidLocations={avoidLocations.items}
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
          onCurrentLocation={handleCurrentLocation}
          locationMessage={locationMessage}
          mode={mode}
          onModeChange={handleModeChange}
          narration={narration}
          onNarrationChange={handleNarrationChange}
          avoidFloodZones={avoidFloodZones}
          onToggleAvoidFloodZones={setAvoidFloodZones}
          avoidLocations={avoidLocations.items}
          onRemoveAvoidLocation={avoidLocations.remove}
          isAddingAvoidLocation={mapTapMode === 'avoid'}
          onToggleAddAvoidLocation={handleToggleAddAvoidLocation}
          isMenuOpen={isMenuOpen}
          onOpenMenu={() => setIsMenuOpen(true)}
          onCloseMenu={() => setIsMenuOpen(false)}
          isPlanning={planner.state.status === 'loading'}
        />

        {planner.state.status !== 'idle' ? (
          <BottomSheet
            index={sheetIndex}
            onIndexChange={handleSheetIndexChange}
            availableHeight={stageHeight || undefined}
            topInset={sheetTopInset}
            bottomInset={insets.bottom || spacing.md}
          >
            <RouteResultSheet state={planner.state} />
          </BottomSheet>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
  },
});
