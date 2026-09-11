import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, Share, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LocateFixed, Navigation, Search } from 'lucide-react-native';

import {
  autocompleteSearch,
  clearRecentSearches,
  deleteRecentSearch,
  geocodeLandmarks,
  getLandmarkAround,
  getRecentSearches,
  type AutocompleteResult,
  type RecentSearch,
} from '../../../api/search';
import { AppText, BottomSheet, Screen, Toast, type SheetSnapIndex } from '../../../components';
import { mapStatusScrim } from '../../../constants/mapStyle';
import { mapColors, mapElevation, mapShape, mapSize } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';
import { hapticLight, hapticSelection, hapticSuccess, hapticWarning } from '../../../utils/haptics';
import { useAuthSession } from '../../authentication/context/AuthSessionProvider';
import { AddressResultCard } from '../components/AddressResultCard';
import { AroundHere } from '../components/AroundHere';
import { BusinessPanel } from '../components/BusinessPanel';
import { InteractiveMap } from '../components/InteractiveMap';
import { MapActionCircle } from '../components/MapActions';
import { MapDivider, MapSectionHeader } from '../components/MapListRow';
import { MapEmptyState, MapErrorState, MapLoadingState } from '../components/MapStates';
import { MyLocationFab } from '../components/MyLocationFab';
import { RecentLookups, type LocalRecentLookup } from '../components/RecentLookups';
import { SearchOverlay } from '../components/SearchOverlay';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useFindGpsSearch, type FindGpsState, type ResolvedFindGpsResult } from '../hooks/useFindGpsSearch';
import { getAddressText, getSearchLabel, normalizeQuery } from '../utils/searchFormatting';
import { OUTSIDE_GHANA_MESSAGE, isWithinGhana } from '../../../utils/resolveAddressQuery';

/**
 * The collapsed peek is sized in pixels, not as a fraction: it has to show the
 * place name, its code, and the whole action row on a small phone as well as a
 * large one. Half and full stay proportional.
 */
const SHEET_PEEK_HEIGHT = 248;
const SHEET_MEDIUM_FRACTION = 0.6;
const SHEET_EXPANDED_FRACTION = 0.92;
/** Must match the sheet's own minimized bar height. */
const SHEET_MINIMIZED_HEIGHT = 48;
const SHEET_PEEK_MIN_FRACTION = 0.22;
const SHEET_PEEK_MAX_FRACTION = 0.46;

/** Names what the resolver accepts: place text, a GPS or hex code, or coordinates. */
const SEARCH_PLACEHOLDER = 'Place, hex code or lat, lng';

/**
 * Where a tap on the grabber goes next.
 *
 * The resting stop is the peek — the height the screen opens at, sized to show
 * the whole result card — so the bar returns to what the user saw on arrival
 * rather than to a taller detent they never asked for. Medium stays reachable
 * by dragging; it is a resize, not a step in the cycle.
 */
const SHEET_TAP_CYCLE: readonly SheetSnapIndex[] = [0, 2, -1];

/**
 * The device's coordinates, preferring a recent cached fix for speed.
 *
 * A cached fix outside Ghana is treated as a miss rather than an answer: on a
 * simulator that is the previous custom location lingering after you change it,
 * and on a real phone it is wherever the device last woke up before travelling.
 * Either way the honest response is to go and get a fresh fix, not to report the
 * stale one as "outside Ghana".
 */
async function readDeviceCoordinates() {
  const cached = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 250 });

  logLocation('cached fix', cached?.coords ?? null);

  if (cached && isWithinGhana(cached.coords.latitude, cached.coords.longitude)) {
    logLocation('using cached fix', cached.coords);

    return cached.coords;
  }

  const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

  logLocation('fresh fix', fresh.coords);

  return fresh.coords;
}

/**
 * Development-only trace of every coordinate the screen reads, so a rejected
 * location can be checked against the Ghana bounds by eye instead of inferred
 * from the error message. Filter the Metro logs for "afrihex:location".
 */
function logLocation(label: string, coords: { latitude: number; longitude: number; accuracy?: number | null } | null) {
  if (!__DEV__) {
    return;
  }

  if (!coords) {
    console.log(`[afrihex:location] ${label}: none`);

    return;
  }

  const { latitude, longitude, accuracy } = coords;

  console.log(
    `[afrihex:location] ${label}: ${latitude}, ${longitude}` +
      ` (accuracy ${accuracy ?? 'unknown'}m, inGhana=${isWithinGhana(latitude, longitude)})`,
  );
}

export function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status: authStatus } = useAuthSession();
  const [query, setQuery] = useState('');
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [isLocationBlocked, setIsLocationBlocked] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [localRecentLookups, setLocalRecentLookups] = useState<LocalRecentLookup[]>([]);
  const [sheetIndex, setSheetIndex] = useState<SheetSnapIndex>(0);
  const [stageHeight, setStageHeight] = useState(0);
  const [mapFocus, setMapFocus] = useState<{ latitude: number; longitude: number } | null>(null);

  // Live sheet height, so the location button can ride the sheet's top edge on
  // the UI thread rather than being re-estimated on every snap change.
  const sheetVisibleHeight = useSharedValue(0);

  const isAuthenticated = authStatus === 'authenticated';
  const debouncedQuery = useDebouncedValue(query.trim(), 250);

  const rememberLocalLookup = useCallback((submittedQuery: string, result: ResolvedFindGpsResult) => {
    setLocalRecentLookups((items) => {
      const key = result.gpsCode || normalizeQuery(submittedQuery);
      const nextItem = { key, query: submittedQuery, result };
      const dedupedItems = items.filter((item) => item.key !== key);

      return [nextItem, ...dedupedItems].slice(0, 5);
    });
    setQuery(getSearchLabel(result));
  }, []);

  const findGps = useFindGpsSearch({
    isAuthenticated,
    onResolved: rememberLocalLookup,
  });

  const resolvedResult = findGps.state.status === 'success' ? findGps.state.result : null;

  /**
   * The minimized bar is always reachable, result or not.
   *
   * It used to appear only once something had resolved, on the reasoning that
   * the bar had nothing to get out of the way of before then. But it is also the
   * bottom of the tap cycle, so gating it meant a tap on the grabber sometimes
   * stopped at the peek and the next tap bounced back up — the sheet appeared to
   * refuse to close. Whatever is in it, getting it out of the way of the map is
   * a reasonable thing to want.
   */
  const lowestIndex: SheetSnapIndex = -1;
  const minimizedLabel = resolvedResult ? 'Tap to see more actions' : 'Tap to search';

  const autocompleteQuery = useQuery({
    queryKey: ['search', 'autocomplete', debouncedQuery, 6],
    queryFn: () => autocompleteSearch({ q: debouncedQuery, limit: 6 }),
    enabled: isSearchPanelOpen && debouncedQuery.length >= 2,
    staleTime: 10_000,
  });

  const recentSearchesQuery = useQuery({
    queryKey: ['search', 'recent', 10],
    queryFn: () => getRecentSearches(10),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  /**
   * Both removals refetch rather than patch the cache. The list is server-ranked
   * by frequency then recency and capped at 30, so deleting one entry can pull a
   * different one into view — a local splice would show a stale ten.
   */
  const invalidateRecentSearches = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['search', 'recent'] });
  }, [queryClient]);

  const removeRecentSearchMutation = useMutation({
    mutationFn: (recentSearch: RecentSearch) => deleteRecentSearch(recentSearch.id),
    onSuccess: invalidateRecentSearches,
  });

  const clearRecentSearchesMutation = useMutation({
    mutationFn: clearRecentSearches,
    onSuccess: invalidateRecentSearches,
  });

  const handleRemoveRecent = useCallback(
    (recentSearch: RecentSearch) => {
      hapticLight();
      removeRecentSearchMutation.mutate(recentSearch);
    },
    [removeRecentSearchMutation],
  );

  const handleClearRecents = useCallback(() => {
    Alert.alert('Clear recent searches?', 'This removes every saved search from your account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all',
        style: 'destructive',
        onPress: () => {
          hapticWarning();
          clearRecentSearchesMutation.mutate();
        },
      },
    ]);
  }, [clearRecentSearchesMutation]);

  // Always enabled once a place resolves: the counts also feed the category chips
  // floating under the search bar, not just the Business tab.
  const businessAroundQuery = useQuery({
    queryKey: ['search', 'landmarks-around', resolvedResult?.latitude, resolvedResult?.longitude, 2000],
    queryFn: () =>
      getLandmarkAround({
        lat: resolvedResult?.latitude ?? 0,
        lng: resolvedResult?.longitude ?? 0,
        radius: 2000,
      }),
    enabled: Boolean(resolvedResult),
    staleTime: 60_000,
  });

  const landmarkListQuery = useQuery({
    queryKey: [
      'search',
      'landmarks-geocode',
      resolvedResult?.latitude,
      resolvedResult?.longitude,
      selectedKind,
      2000,
      25,
    ],
    queryFn: () =>
      geocodeLandmarks({
        near: `${resolvedResult?.latitude ?? 0},${resolvedResult?.longitude ?? 0}`,
        kind: selectedKind ?? '',
        radius: 2000,
        limit: 25,
      }),
    enabled: Boolean(resolvedResult && selectedKind),
    staleTime: 60_000,
  });

  const suggestions = autocompleteQuery.data?.results ?? [];
  const serverRecentSearches = recentSearchesQuery.data?.searches ?? [];
  const categories = businessAroundQuery.data?.by_kind ?? [];

  // The map tiles render dark, so the clock, wifi and battery need light glyphs to
  // stay legible over them. The search panel is a light surface, so they flip back
  // to dark while it is open.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(isSearchPanelOpen ? 'dark' : 'light', true);

      return () => {
        setStatusBarStyle('light', true);
      };
    }, [isSearchPanelOpen]),
  );

  useEffect(() => {
    if (!copyMessage) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setCopyMessage(null);
    }, 1400);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [copyMessage]);

  // Keeps the sheet at a sensible height whenever the resolve state actually changes,
  // without fighting a manual drag that happens in between transitions.
  useEffect(() => {
    switch (findGps.state.status) {
      case 'success':
        setSheetIndex(1);
        break;
      default:
        setSheetIndex(0);
    }
  }, [findGps.state.status]);

  useEffect(() => {
    if (findGps.state.status === 'success') {
      hapticSuccess();
    } else if (findGps.state.status === 'empty' || findGps.state.status === 'error') {
      hapticWarning();
    }
  }, [findGps.state.status]);

  const handleChangeText = useCallback(
    (next: string) => {
      setQuery(next);
      const state = findGps.state;

      if (
        (state.status === 'success' || state.status === 'empty' || state.status === 'error') &&
        next.trim() !== state.query
      ) {
        findGps.reset();
      }
    },
    [findGps],
  );

  const handleSubmit = useCallback(
    (submittedQuery: string) => {
      setIsSearchPanelOpen(false);
      setLocationMessage(null);
      setCopyMessage(null);
      setSelectedKind(null);
      setQuery(submittedQuery);
      void findGps.submit(submittedQuery);
    },
    [findGps],
  );

  const handleSuggestionPress = useCallback(
    (suggestion: AutocompleteResult) => {
      handleSubmit(suggestion.display_name);
    },
    [handleSubmit],
  );

  const handleRecentPress = useCallback(
    (recentSearch: RecentSearch) => {
      handleSubmit(recentSearch.query);
    },
    [handleSubmit],
  );

  const handleLocalRecentPress = useCallback(
    (recentLookup: LocalRecentLookup) => {
      handleSubmit(recentLookup.query);
    },
    [handleSubmit],
  );

  const handleClearQuery = useCallback(() => {
    setQuery('');
    setSelectedKind(null);
    setLocationMessage(null);
    findGps.reset();
  }, [findGps]);

  const handleCurrentLocation = useCallback(async () => {
    if (isLocationBlocked) {
      await Linking.openSettings();
      setLocationMessage('Enable location for AfriHex in Settings, then return and tap the location button.');
      return;
    }

    setIsLocating(true);
    setLocationMessage(null);
    setSelectedKind(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        setHasLocationPermission(false);

        if (!permission.canAskAgain) {
          setIsLocationBlocked(true);
          setLocationMessage('Location is blocked. Tap the location button again to open Settings.');
          return;
        }

        setLocationMessage('Location permission is off. Tap the location button again to allow it.');
        return;
      }

      setIsLocationBlocked(false);
      setHasLocationPermission(true);

      const coordinates = await readDeviceCoordinates();

      logLocation('resolving current location', coordinates);

      await findGps.resolveCurrentLocation({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });
      setQuery('Current location');
    } catch (error) {
      if (__DEV__) {
        console.log('[afrihex:location] current location failed', error);
      }

      setLocationMessage(error instanceof Error ? error.message : 'Could not read your location.');
    } finally {
      setIsLocating(false);
    }
  }, [findGps, isLocationBlocked]);

  const handleSelectKind = useCallback((kind: string) => {
    hapticSelection();
    setSelectedKind(kind);
    // Picking a category is a request to read the list, so give it room.
    setSheetIndex(2);
  }, []);

  /**
   * Point the map at the user on launch, the way Google Maps opens. This only
   * *reads* the permission — `getForegroundPermissionsAsync` never prompts — so
   * the OS dialog still belongs to the location button.
   */
  useEffect(() => {
    let isActive = true;

    const centreOnDevice = async () => {
      const permission = await Location.getForegroundPermissionsAsync();

      if (!isActive) {
        return;
      }

      setHasLocationPermission(permission.granted);

      if (!permission.granted) {
        return;
      }

      const { latitude, longitude } = await readDeviceCoordinates();

      logLocation('launch centring', { latitude, longitude });

      if (!isActive) {
        return;
      }

      // AfriHex codes only exist in Ghana, so a fix from anywhere else — a
      // simulator's default location, a user abroad — is not somewhere the map
      // should open. Fall back to the Accra default instead.
      if (!isWithinGhana(latitude, longitude)) {
        return;
      }

      setMapFocus({ latitude, longitude });
    };

    void centreOnDevice().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, []);

  const handleSheetIndexChange = useCallback((next: SheetSnapIndex) => {
    hapticLight();
    setSheetIndex(next);
  }, []);

  // Reaching for the map means wanting to see it: drop the sheet as low as this
  // screen allows. Fires on every pan frame, so bail early when the sheet is
  // already down rather than re-rendering the screen.
  const handleMapPan = useCallback(() => {
    setSheetIndex((current) => (current === lowestIndex ? current : lowestIndex));
  }, [lowestIndex]);

  const handleStageLayout = useCallback((event: LayoutChangeEvent) => {
    setStageHeight(event.nativeEvent.layout.height);
  }, []);

  const handleCopy = useCallback(async (result: ResolvedFindGpsResult) => {
    await copyAddress(result);
    setCopyMessage(`Copied ${result.gpsCode}`);
    hapticSuccess();
  }, []);

  const handleOpenDirections = useCallback(() => {
    router.push('/directions');
  }, [router]);

  /**
   * Directions to the place already on screen. Handing the destination over as
   * params rather than making the user retype it is the whole point of the
   * split: Find resolves a place, Directions routes to it.
   */
  const handleOpenDirectionsTo = useCallback(
    (result: ResolvedFindGpsResult) => {
      router.push({
        pathname: '/directions',
        params: {
          toLat: String(result.latitude),
          toLng: String(result.longitude),
          toLabel: getSearchLabel(result),
        },
      });
    },
    [router],
  );

  const handleAddressCard = useCallback(
    (result: ResolvedFindGpsResult) => {
      router.push({ pathname: '/address/card', params: { code: result.gpsCode } });
    },
    [router],
  );

  /**
   * Starts a meetup at the place on screen. The session is created on the next
   * screen rather than here, so a mis-tap does not leave a live session behind.
   */
  const handleMeetHere = useCallback(
    (result: ResolvedFindGpsResult) => {
      router.push({
        pathname: '/meet',
        params: {
          lat: String(result.latitude),
          lng: String(result.longitude),
          label: getSearchLabel(result),
        },
      });
    },
    [router],
  );

  const handleOpenAccount = useCallback(() => {
    router.push('/account');
  }, [router]);

  const snapPoints = useMemo(() => {
    const height = stageHeight || 700;
    const peekFraction = Math.min(
      SHEET_PEEK_MAX_FRACTION,
      Math.max(SHEET_PEEK_MIN_FRACTION, SHEET_PEEK_HEIGHT / height),
    );

    return [peekFraction, SHEET_MEDIUM_FRACTION, SHEET_EXPANDED_FRACTION] as [number, number, number];
  }, [stageHeight]);

  // Just the floating search pill now — the category chip row that used to sit
  // under it moved out, so nothing else reserves height over the map.
  const chromeHeight = insets.top + spacing.sm + mapSize.searchBar + spacing.md;
  // How much of the screen the sheet covers at its current detent. -1 is the
  // minimized bar, which is a fixed height rather than a fraction of the stage.
  const sheetHeight = sheetIndex === -1 ? SHEET_MINIMIZED_HEIGHT : stageHeight * snapPoints[sheetIndex];
  // Keep the pin above the sheet as it grows, so raising the sheet nudges the map
  // instead of hiding the marker. Capped at the medium snap — at full height there
  // is no map strip left to aim for.
  const mapBottomPadding = Math.min(sheetHeight, stageHeight * SHEET_MEDIUM_FRACTION);
  // Stop the button before it reaches the search bar, and clamp the toast to the
  // same ceiling so neither ends up behind the map chrome on a full-height sheet.
  const overlayCeiling = Math.max(0, stageHeight - chromeHeight - mapSize.fab - spacing.xl);
  const fabMaxRise = Math.min(stageHeight * SHEET_MEDIUM_FRACTION + spacing.md, overlayCeiling);
  const toastBottomOffset = stageHeight
    ? Math.min(sheetHeight + mapSize.fab + spacing.xl, overlayCeiling)
    : spacing['3xl'];

  return (
    <Screen bleed maskStatusBar={false}>
      <View style={styles.stage} onLayout={handleStageLayout}>
        <InteractiveMap
          result={resolvedResult}
          style={StyleSheet.absoluteFill}
          mapPaddingTop={chromeHeight}
          mapPaddingBottom={mapBottomPadding}
          showsUserLocation={hasLocationPermission}
          onPanDrag={handleMapPan}
          focus={mapFocus}
        />

        <LinearGradient
          pointerEvents="none"
          colors={mapStatusScrim}
          style={[styles.statusScrim, { height: insets.top + spacing.sm }]}
        />

        <SearchOverlay
          topInset={insets.top}
          isPanelOpen={isSearchPanelOpen}
          onOpenPanel={() => setIsSearchPanelOpen(true)}
          onClosePanel={() => setIsSearchPanelOpen(false)}
          query={query}
          placeholder={SEARCH_PLACEHOLDER}
          onChangeText={handleChangeText}
          onClearQuery={handleClearQuery}
          onSubmit={handleSubmit}
          onAccountPress={handleOpenAccount}
          // Opens the search panel, where the field's own mic lives — the bar
          // is a button, not an input, so it has nothing to dictate into.
          onVoicePress={() => setIsSearchPanelOpen(true)}
          suggestions={suggestions}
          isSuggestionsLoading={autocompleteQuery.isFetching}
          suggestionsError={autocompleteQuery.error instanceof Error ? autocompleteQuery.error.message : null}
          onSuggestionPress={handleSuggestionPress}
          recentSearches={serverRecentSearches}
          localRecentLookups={localRecentLookups}
          showServerRecent={isAuthenticated}
          isRecentLoading={isAuthenticated && recentSearchesQuery.isPending}
          onRecentPress={handleRecentPress}
          onLocalRecentPress={handleLocalRecentPress}
          locationMessage={locationMessage}
        />

        {isSearchPanelOpen || sheetIndex === 2 ? null : (
          <MyLocationFab
            onPress={() => void handleCurrentLocation()}
            isLocating={isLocating}
            isBlocked={isLocationBlocked}
            sheetVisibleHeight={sheetVisibleHeight}
            maxRise={fabMaxRise}
          />
        )}

        <BottomSheet
          index={sheetIndex}
          onIndexChange={handleSheetIndexChange}
          snapPoints={snapPoints}
          availableHeight={stageHeight || undefined}
          topInset={chromeHeight}
          bottomInset={spacing.md}
          visibleHeight={sheetVisibleHeight}
          surfaceStyle={styles.sheetSurface}
          contentStyle={styles.sheetContent}
          handleColor={mapColors.outline}
          minimizedLabel={minimizedLabel}
          // A second tap goes all the way down to the bar, not back to the peek:
          // the point of tapping a sheet closed is to see the map under it.
          tapCycle={SHEET_TAP_CYCLE}
        >
          <SheetContent
            findState={findGps.state}
            onDidYouMeanPress={handleSubmit}
            onRetry={handleSubmit}
            onOpenSearch={() => setIsSearchPanelOpen(true)}
            onCurrentLocation={() => void handleCurrentLocation()}
            isLocating={isLocating}
            onOpenDirections={handleOpenDirectionsTo}
            onOpenDirectionsTab={handleOpenDirections}
            onCopy={handleCopy}
            onShare={shareResult}
            onAddressCard={handleAddressCard}
            onMeetHere={handleMeetHere}
            recentSearches={serverRecentSearches}
            localRecentLookups={localRecentLookups}
            showServerRecent={isAuthenticated}
            isRecentLoading={isAuthenticated && recentSearchesQuery.isPending}
            onRecentPress={handleRecentPress}
            onLocalRecentPress={handleLocalRecentPress}
            onRemoveRecent={handleRemoveRecent}
            onClearRecents={handleClearRecents}
            businessProps={{
              selectedKind,
              onSelectKind: handleSelectKind,
              isCountsLoading: businessAroundQuery.isPending,
              countsError: businessAroundQuery.error instanceof Error ? businessAroundQuery.error.message : null,
              kinds: categories,
              isListLoading: landmarkListQuery.isPending,
              listError: landmarkListQuery.error instanceof Error ? landmarkListQuery.error.message : null,
              landmarks: landmarkListQuery.data?.matches ?? [],
              onRetryCounts: () => void businessAroundQuery.refetch(),
              onRetryList: () => void landmarkListQuery.refetch(),
            }}
          />
        </BottomSheet>

        <Toast message={copyMessage} bottomOffset={toastBottomOffset} />
      </View>
    </Screen>
  );
}

type SheetContentProps = {
  findState: FindGpsState;
  onDidYouMeanPress: (query: string) => void;
  onRetry: (query: string) => void;
  onOpenSearch: () => void;
  onCurrentLocation: () => void;
  isLocating: boolean;
  onOpenDirections: (result: ResolvedFindGpsResult) => void;
  onOpenDirectionsTab: () => void;
  onCopy: (result: ResolvedFindGpsResult) => void;
  onShare: (result: ResolvedFindGpsResult) => void;
  onAddressCard: (result: ResolvedFindGpsResult) => void;
  onMeetHere: (result: ResolvedFindGpsResult) => void;
  recentSearches: RecentSearch[];
  localRecentLookups: LocalRecentLookup[];
  showServerRecent: boolean;
  isRecentLoading: boolean;
  onRecentPress: (recentSearch: RecentSearch) => void;
  onLocalRecentPress: (recentLookup: LocalRecentLookup) => void;
  onRemoveRecent: (recentSearch: RecentSearch) => void;
  onClearRecents: () => void;
  businessProps: Parameters<typeof BusinessPanel>[0];
};

function SheetContent({
  findState,
  onDidYouMeanPress,
  onRetry,
  onOpenSearch,
  onCurrentLocation,
  isLocating,
  onOpenDirections,
  onOpenDirectionsTab,
  onCopy,
  onShare,
  onAddressCard,
  onMeetHere,
  recentSearches,
  localRecentLookups,
  showServerRecent,
  isRecentLoading,
  onRecentPress,
  onLocalRecentPress,
  onRemoveRecent,
  onClearRecents,
  businessProps,
}: SheetContentProps) {
  if (findState.status === 'loading') {
    return <MapLoadingState label={`Resolving ${findState.query}`} />;
  }

  if (findState.status === 'error') {
    // Prefix match: in development the coordinate is appended to this message.
    const isOutOfCoverage = findState.message.startsWith(OUTSIDE_GHANA_MESSAGE);

    return (
      <View style={styles.stateInset}>
        <MapErrorState
          message={findState.message}
          onRetry={isOutOfCoverage ? undefined : () => onRetry(findState.query)}
        />
      </View>
    );
  }

  if (findState.status === 'empty') {
    return (
      <MapEmptyState
        title="No address found"
        description="Try a place name, a nearby landmark, or a Ghana GPS code."
        actionLabel={findState.didYouMean ? `Did you mean ${findState.didYouMean}?` : undefined}
        onAction={findState.didYouMean ? () => onDidYouMeanPress(findState.didYouMean ?? '') : undefined}
      />
    );
  }

  if (findState.status === 'success') {
    return (
      <View>
        <AddressResultCard
          result={findState.result}
          onOpenDirections={onOpenDirections}
          onCopy={onCopy}
          onShare={onShare}
          onAddressCard={onAddressCard}
          onMeetHere={onMeetHere}
        />

        <AroundHere businessProps={businessProps} />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.quickActions}>
        <MapActionCircle
          label="My location"
          icon={LocateFixed}
          variant="filled"
          busy={isLocating}
          onPress={onCurrentLocation}
        />
        <MapActionCircle label="Search" icon={Search} onPress={onOpenSearch} />
        <MapActionCircle label="Directions" icon={Navigation} onPress={onOpenDirectionsTab} />
      </View>

      <MapDivider inset={false} />

      <View style={styles.recentHeader}>
        <MapSectionHeader
          title="Recent"
          // Only offered when the server list is what is on screen: clearing is
          // an account action, and there is nothing on the server to clear for a
          // signed-out visitor looking at this session's own lookups.
          action={
            showServerRecent && recentSearches.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear all recent searches"
                onPress={onClearRecents}
                hitSlop={8}
                style={({ pressed }) => [styles.clearRecents, pressed && styles.clearRecentsPressed]}
              >
                <AppText variant="caption" style={styles.clearRecentsLabel}>
                  Clear all
                </AppText>
              </Pressable>
            ) : null
          }
        />
      </View>

      <RecentLookups
        recentSearches={recentSearches}
        localRecentLookups={localRecentLookups}
        showServerRecent={showServerRecent}
        isLoading={isRecentLoading}
        onRecentPress={onRecentPress}
        onRemoveRecent={showServerRecent ? onRemoveRecent : undefined}
        onLocalRecentPress={onLocalRecentPress}
      />
    </View>
  );
}

/** The code alone — it is what gets pasted into a chat or read down a phone. */
async function copyAddress(result: ResolvedFindGpsResult) {
  await Clipboard.setStringAsync(result.gpsCode);
}

async function shareResult(result: ResolvedFindGpsResult) {
  await Share.share({
    message: getAddressText(result),
  });
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
  },
  statusScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Under the search overlay (zIndex 6) and the sheet, over the map.
    zIndex: 5,
  },
  sheetSurface: {
    borderTopLeftRadius: mapShape.extraLarge,
    borderTopRightRadius: mapShape.extraLarge,
    borderTopWidth: 0,
    backgroundColor: mapColors.surface,
    ...mapElevation.level3,
    shadowOffset: { width: 0, height: -4 },
  },
  sheetContent: {
    gap: 0,
    paddingHorizontal: 0,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  recentHeader: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  clearRecents: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  clearRecentsPressed: {
    opacity: 0.6,
  },
  clearRecentsLabel: {
    color: mapColors.primary,
  },
  stateInset: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
