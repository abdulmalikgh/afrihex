import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Share, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LocateFixed, Navigation, Search } from 'lucide-react-native';

import {
  autocompleteSearch,
  geocodeLandmarks,
  getLandmarkAround,
  getNearbyPlaces,
  getRecentSearches,
  type AutocompleteResult,
  type RecentSearch,
} from '../../../api/search';
import { BottomSheet, Screen, Toast, type SheetSnapIndex } from '../../../components';
import { mapStatusScrim } from '../../../constants/mapStyle';
import { mapColors, mapElevation, mapShape, mapSize } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';
import { hapticLight, hapticSelection, hapticSuccess, hapticWarning } from '../../../utils/haptics';
import { useAuthSession } from '../../authentication/context/AuthSessionProvider';
import { AddressResultCard } from '../components/AddressResultCard';
import { BusinessPanel } from '../components/BusinessPanel';
import { InteractiveMap } from '../components/InteractiveMap';
import { MapActionCircle, MapTabs } from '../components/MapActions';
import { MapDivider, MapSectionHeader } from '../components/MapListRow';
import { MapEmptyState, MapErrorState, MapLoadingState } from '../components/MapStates';
import { MyLocationFab } from '../components/MyLocationFab';
import { NearbyPanel } from '../components/NearbyPanel';
import { RecentLookups, type LocalRecentLookup } from '../components/RecentLookups';
import { SearchOverlay } from '../components/SearchOverlay';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useFindGpsSearch, type FindGpsState, type ResolvedFindGpsResult } from '../hooks/useFindGpsSearch';
import { getAddressText, getSearchLabel, normalizeQuery } from '../utils/searchFormatting';
import { OUTSIDE_GHANA_MESSAGE, isWithinGhana } from '../../../utils/resolveAddressQuery';

type ResultTab = 'nearby' | 'business';

const TAB_OPTIONS = [
  { label: 'Nearby', value: 'nearby' },
  { label: 'Business', value: 'business' },
] as const;

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

const SEARCH_PLACEHOLDER = 'Find a place';

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
  const { status: authStatus } = useAuthSession();
  const [query, setQuery] = useState('');
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ResultTab>('nearby');
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [isLocationBlocked, setIsLocationBlocked] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [localRecentLookups, setLocalRecentLookups] = useState<LocalRecentLookup[]>([]);
  const [sheetIndex, setSheetIndex] = useState<SheetSnapIndex>(0);
  const [stageHeight, setStageHeight] = useState(0);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(1);
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
    setNearbyRadiusKm(1);
  }, []);

  const findGps = useFindGpsSearch({
    isAuthenticated,
    onResolved: rememberLocalLookup,
  });

  const resolvedResult = findGps.state.status === 'success' ? findGps.state.result : null;

  /**
   * The minimized bar only earns its place once there is a result card to get out
   * of the way of. With nothing resolved the sheet is the screen's only content,
   * so it bottoms out at the peek and the bar never appears.
   */
  const canMinimize = Boolean(resolvedResult);
  const lowestIndex: SheetSnapIndex = canMinimize ? -1 : 0;

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

  const nearbyQuery = useQuery({
    queryKey: ['search', 'nearby', resolvedResult?.latitude, resolvedResult?.longitude, nearbyRadiusKm, 5],
    queryFn: () =>
      getNearbyPlaces({
        lat: resolvedResult?.latitude ?? 0,
        lng: resolvedResult?.longitude ?? 0,
        radius: nearbyRadiusKm,
        limit: 5,
      }),
    enabled: Boolean(resolvedResult) && activeTab === 'nearby',
    staleTime: 60_000,
  });

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
      setActiveTab('nearby');
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

  const handleTabChange = useCallback((nextTab: ResultTab) => {
    setActiveTab(nextTab);
    setSheetIndex(2);
    hapticSelection();
  }, []);

  const handleSelectKind = useCallback((kind: string) => {
    hapticSelection();
    setSelectedKind(kind);
    setActiveTab('business');
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

  // The detent can disappear underneath the sheet — clearing a search while
  // minimized — so lift it back to the peek rather than leaving the index dangling.
  useEffect(() => {
    if (!canMinimize) {
      setSheetIndex((current) => (current === -1 ? 0 : current));
    }
  }, [canMinimize]);

  const handleStageLayout = useCallback((event: LayoutChangeEvent) => {
    setStageHeight(event.nativeEvent.layout.height);
  }, []);

  const handleSearchWider = useCallback(() => {
    setNearbyRadiusKm((km) => Math.min(km * 2, 5));
  }, []);

  const handleCopy = useCallback(async (result: ResolvedFindGpsResult) => {
    await copyAddress(result);
    setCopyMessage(`Copied ${result.gpsCode}`);
    hapticSuccess();
  }, []);

  const handleOpenDirections = useCallback(() => {
    router.push('/directions');
  }, [router]);

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
          minimizedLabel={canMinimize ? 'Tap to see more actions' : undefined}
        >
          <SheetContent
            findState={findGps.state}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onDidYouMeanPress={handleSubmit}
            onRetry={handleSubmit}
            onOpenSearch={() => setIsSearchPanelOpen(true)}
            onCurrentLocation={() => void handleCurrentLocation()}
            isLocating={isLocating}
            onOpenMaps={openMaps}
            onOpenDirections={openDirections}
            onOpenDirectionsTab={handleOpenDirections}
            onCopy={handleCopy}
            onShare={shareResult}
            recentSearches={serverRecentSearches}
            localRecentLookups={localRecentLookups}
            showServerRecent={isAuthenticated}
            isRecentLoading={isAuthenticated && recentSearchesQuery.isPending}
            onRecentPress={handleRecentPress}
            onLocalRecentPress={handleLocalRecentPress}
            nearbyProps={{
              isLoading: nearbyQuery.isPending,
              errorMessage: nearbyQuery.error instanceof Error ? nearbyQuery.error.message : null,
              locations: nearbyQuery.data?.locations ?? [],
              radiusKm: nearbyRadiusKm,
              onRetry: () => void nearbyQuery.refetch(),
              onSearchWider: handleSearchWider,
            }}
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
  activeTab: ResultTab;
  onTabChange: (tab: ResultTab) => void;
  onDidYouMeanPress: (query: string) => void;
  onRetry: (query: string) => void;
  onOpenSearch: () => void;
  onCurrentLocation: () => void;
  isLocating: boolean;
  onOpenMaps: (result: ResolvedFindGpsResult) => void;
  onOpenDirections: (result: ResolvedFindGpsResult) => void;
  onOpenDirectionsTab: () => void;
  onCopy: (result: ResolvedFindGpsResult) => void;
  onShare: (result: ResolvedFindGpsResult) => void;
  recentSearches: RecentSearch[];
  localRecentLookups: LocalRecentLookup[];
  showServerRecent: boolean;
  isRecentLoading: boolean;
  onRecentPress: (recentSearch: RecentSearch) => void;
  onLocalRecentPress: (recentLookup: LocalRecentLookup) => void;
  nearbyProps: Parameters<typeof NearbyPanel>[0];
  businessProps: Parameters<typeof BusinessPanel>[0];
};

function SheetContent({
  findState,
  activeTab,
  onTabChange,
  onDidYouMeanPress,
  onRetry,
  onOpenSearch,
  onCurrentLocation,
  isLocating,
  onOpenMaps,
  onOpenDirections,
  onOpenDirectionsTab,
  onCopy,
  onShare,
  recentSearches,
  localRecentLookups,
  showServerRecent,
  isRecentLoading,
  onRecentPress,
  onLocalRecentPress,
  nearbyProps,
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
          onOpenMaps={onOpenMaps}
          onOpenDirections={onOpenDirections}
          onCopy={onCopy}
          onShare={onShare}
        />

        <MapTabs
          options={TAB_OPTIONS}
          value={activeTab}
          onChange={onTabChange}
          accessibilityLabel="Result detail tabs"
        />

        {activeTab === 'nearby' ? <NearbyPanel {...nearbyProps} /> : <BusinessPanel {...businessProps} />}
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
        <MapSectionHeader title="Recent" />
      </View>

      <RecentLookups
        recentSearches={recentSearches}
        localRecentLookups={localRecentLookups}
        showServerRecent={showServerRecent}
        isLoading={isRecentLoading}
        onRecentPress={onRecentPress}
        onLocalRecentPress={onLocalRecentPress}
      />
    </View>
  );
}

async function openMaps(result: ResolvedFindGpsResult) {
  if (!result.googleMapsUrl) {
    return;
  }

  await Linking.openURL(result.googleMapsUrl);
}

async function openDirections(result: ResolvedFindGpsResult) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${result.latitude},${result.longitude}`;

  await Linking.openURL(url);
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
  stateInset: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
