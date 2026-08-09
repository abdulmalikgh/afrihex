import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import {
  Building2,
  Check,
  Compass,
  Copy,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCcw,
  Search,
  Share2,
} from 'lucide-react-native';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import MapView, { Marker, type Region } from 'react-native-maps';

import {
  autocompleteSearch,
  geocodeLandmarks,
  getLandmarkAround,
  getNearbyPlaces,
  getRecentSearches,
  type AutocompleteResult,
  type LandmarkMatch,
  type RecentSearch,
} from '../../../api/search';
import {
  AppButton,
  AppText,
  EmptyState,
  ErrorBanner,
  LoadingState,
  ResultCard,
  SearchBar,
  SegmentedControl,
} from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { useAuthSession } from '../../authentication/context/AuthSessionProvider';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useFindGpsSearch, type ResolvedFindGpsResult } from '../hooks/useFindGpsSearch';

type ResultTab = 'nearby' | 'business';

type LocalRecentLookup = {
  key: string;
  query: string;
  result: ResolvedFindGpsResult;
};

const TAB_OPTIONS = [
  { label: 'Nearby', value: 'nearby' },
  { label: 'Business', value: 'business' },
] as const;

export function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { status: authStatus } = useAuthSession();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ResultTab>('nearby');
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [isLocationBlocked, setIsLocationBlocked] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [localRecentLookups, setLocalRecentLookups] = useState<LocalRecentLookup[]>([]);

  const isAuthenticated = authStatus === 'authenticated';
  const debouncedQuery = useDebouncedValue(query.trim(), 250);

  const rememberLocalLookup = useCallback((submittedQuery: string, result: ResolvedFindGpsResult) => {
    setLocalRecentLookups((items) => {
      const key = result.gpsCode || normalizeQuery(submittedQuery);
      const nextItem = { key, query: submittedQuery, result };
      const dedupedItems = items.filter((item) => item.key !== key);

      return [nextItem, ...dedupedItems].slice(0, 5);
    });
  }, []);

  const findGps = useFindGpsSearch({
    isAuthenticated,
    onResolved: rememberLocalLookup,
  });

  const resolvedResult = findGps.state.status === 'success' ? findGps.state.result : null;

  const autocompleteQuery = useQuery({
    queryKey: ['search', 'autocomplete', debouncedQuery, 3],
    queryFn: () => autocompleteSearch({ q: debouncedQuery, limit: 3 }),
    enabled: debouncedQuery.length >= 2 && findGps.state.status !== 'loading',
    staleTime: 10_000,
  });

  const recentSearchesQuery = useQuery({
    queryKey: ['search', 'recent', 10],
    queryFn: () => getRecentSearches(10),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const nearbyQuery = useQuery({
    queryKey: [
      'search',
      'nearby',
      resolvedResult?.latitude,
      resolvedResult?.longitude,
      0.5,
      5,
    ],
    queryFn: () =>
      getNearbyPlaces({
        lat: resolvedResult?.latitude ?? 0,
        lng: resolvedResult?.longitude ?? 0,
        radius: 0.5,
        limit: 5,
      }),
    enabled: Boolean(resolvedResult) && activeTab === 'nearby',
    staleTime: 60_000,
  });

  const businessAroundQuery = useQuery({
    queryKey: ['search', 'landmarks-around', resolvedResult?.latitude, resolvedResult?.longitude, 2000],
    queryFn: () =>
      getLandmarkAround({
        lat: resolvedResult?.latitude ?? 0,
        lng: resolvedResult?.longitude ?? 0,
        radius: 2000,
      }),
    enabled: Boolean(resolvedResult) && activeTab === 'business',
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
    enabled: Boolean(resolvedResult && selectedKind && activeTab === 'business'),
    staleTime: 60_000,
  });

  const suggestions = useMemo(() => autocompleteQuery.data?.results ?? [], [autocompleteQuery.data]);
  const serverRecentSearches = recentSearchesQuery.data?.searches ?? [];

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

  const handleSubmit = useCallback(
    (submittedQuery = query) => {
      setLocationMessage(null);
      setCopyMessage(null);
      setSelectedKind(null);
      setQuery(submittedQuery);
      void findGps.submit(submittedQuery);
    },
    [findGps, query],
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
      setQuery(recentLookup.query);
      setLocationMessage(null);
      setCopyMessage(null);
      setSelectedKind(null);
      void findGps.submit(recentLookup.query);
    },
    [findGps],
  );

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
        lastKnownPosition ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));

      await findGps.resolveCurrentLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setQuery('Current location');
    } catch (error) {
      setLocationMessage(error instanceof Error ? error.message : 'Could not read your location.');
    } finally {
      setIsLocating(false);
    }
  }, [findGps, isLocationBlocked]);

  return (
    <ScreenContent topInset={insets.top} bottomInset={insets.bottom}>
      <View style={styles.header}>
        <AppText variant="title">Your address, one code.</AppText>
        <AppText variant="body" tone="muted">
          Search a place, GPS code, address, or use your location.
        </AppText>
      </View>

      <View style={styles.mapPanel}>
        <InteractiveMap result={resolvedResult} />
        <View style={styles.searchOverlay}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder={'Try "Adjacent Goil, Madina" or a GPS code'}
            accessibilityLabel="Search place, GPS code, or address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => handleSubmit()}
            containerStyle={styles.searchBar}
            style={styles.searchInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search"
            accessibilityState={{ disabled: query.trim().length < 2 || findGps.state.status === 'loading' }}
            disabled={query.trim().length < 2 || findGps.state.status === 'loading'}
            onPress={() => handleSubmit()}
            style={({ pressed }) => [
              styles.searchButton,
              (query.trim().length < 2 || findGps.state.status === 'loading') && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            {findGps.state.status === 'loading' ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Search color={colors.white} size={20} />
            )}
          </Pressable>
        </View>

        {suggestions.length > 0 && query.trim().length >= 2 && findGps.state.status !== 'success' ? (
          <View style={styles.suggestionPopover}>
            <SuggestionList suggestions={suggestions} onPress={handleSuggestionPress} />
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use current location"
          accessibilityState={{ busy: isLocating }}
          onPress={handleCurrentLocation}
          disabled={isLocating}
          style={({ pressed }) => [styles.locateButton, pressed && styles.pressed]}
        >
          {isLocating ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <LocateFixed color={colors.text} size={22} />
          )}
        </Pressable>
      </View>

      {locationMessage ? <ErrorBanner message={locationMessage} /> : null}
      {copyMessage ? (
        <View style={styles.successBanner} accessible>
          <Check color={colors.primaryLight} size={18} />
          <AppText variant="caption" tone="primary">
            {copyMessage}
          </AppText>
        </View>
      ) : null}

      <RecentLookups
        recentSearches={serverRecentSearches}
        localRecentLookups={localRecentLookups}
        showServerRecent={isAuthenticated}
        isLoading={recentSearchesQuery.isPending}
        onRecentPress={handleRecentPress}
        onLocalRecentPress={handleLocalRecentPress}
      />

      <SearchStateContent
        state={findGps.state}
        onDidYouMeanPress={handleSubmit}
        onOpenMaps={openMaps}
        onOpenDirections={openDirections}
        onCopy={async (result) => {
          await copyAddress(result);
          setCopyMessage('Copied');
        }}
        onShare={shareResult}
      />

      {resolvedResult ? (
        <View style={styles.resultTabs}>
          <SegmentedControl
            options={TAB_OPTIONS}
            value={activeTab}
            onChange={(nextTab) => {
              setActiveTab(nextTab);
              setSelectedKind(null);
            }}
            accessibilityLabel="Result detail tabs"
          />
          {activeTab === 'nearby' ? (
            <NearbyPanel
              isLoading={nearbyQuery.isPending}
              errorMessage={nearbyQuery.error instanceof Error ? nearbyQuery.error.message : null}
              locations={nearbyQuery.data?.locations ?? []}
              onRetry={() => void nearbyQuery.refetch()}
            />
          ) : (
            <BusinessPanel
              selectedKind={selectedKind}
              onSelectKind={setSelectedKind}
              isCountsLoading={businessAroundQuery.isPending}
              countsError={businessAroundQuery.error instanceof Error ? businessAroundQuery.error.message : null}
              kinds={businessAroundQuery.data?.by_kind ?? []}
              isListLoading={landmarkListQuery.isPending}
              listError={landmarkListQuery.error instanceof Error ? landmarkListQuery.error.message : null}
              landmarks={landmarkListQuery.data?.matches ?? []}
              onRetryCounts={() => void businessAroundQuery.refetch()}
              onRetryList={() => void landmarkListQuery.refetch()}
            />
          )}
        </View>
      ) : null}
    </ScreenContent>
  );
}

function ScreenContent({
  children,
  topInset,
  bottomInset,
}: {
  children: ReactNode;
  topInset: number;
  bottomInset: number;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.screenContent,
        {
          paddingTop: topInset + spacing.lg,
          paddingBottom: bottomInset + spacing['2xl'],
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

function InteractiveMap({ result }: { result: ResolvedFindGpsResult | null }) {
  const mapRef = useRef<MapView>(null);
  const region = getMapRegion(result);

  useEffect(() => {
    if (!result) {
      return;
    }

    mapRef.current?.animateToRegion(getMapRegion(result), 650);
  }, [result]);

  if (Platform.OS === 'web') {
    return <MapFallback result={result} />;
  }

  return (
    <MapView
      ref={mapRef}
      style={styles.mapView}
      initialRegion={region}
      loadingEnabled
      showsCompass
      showsScale
      zoomEnabled
      scrollEnabled
      rotateEnabled={false}
      pitchEnabled={false}
      accessibilityLabel="Interactive location map"
    >
      {result ? (
        <Marker
          coordinate={{
            latitude: result.latitude,
            longitude: result.longitude,
          }}
          tracksViewChanges={false}
          accessibilityLabel={`Address code ${result.gpsCode}`}
        >
          <View style={styles.markerWrap}>
            <View style={styles.markerBubble}>
              <AppText variant="code" style={styles.markerCode} numberOfLines={1}>
                {result.gpsCode}
              </AppText>
            </View>
            <View style={styles.markerPin}>
              <MapPin color={colors.white} fill={colors.primary} size={22} />
            </View>
          </View>
        </Marker>
      ) : null}
    </MapView>
  );
}

function MapFallback({ result }: { result: ResolvedFindGpsResult | null }) {
  return (
    <View style={styles.mapPreview} accessible accessibilityLabel="Map preview">
      <View style={[styles.landMass, styles.landMassOne]} />
      <View style={[styles.landMass, styles.landMassTwo]} />
      <View style={[styles.landMass, styles.landMassThree]} />
      <View style={[styles.water, styles.waterOne]} />
      <View style={[styles.water, styles.waterTwo]} />
      <View style={styles.mapGrid} />
      <AppText variant="title" tone="faint" style={styles.countryLabel}>
        GHANA
      </AppText>
      <AppText variant="caption" tone="faint" style={styles.cityLabel}>
        Accra
      </AppText>
      <AppText variant="caption" tone="faint" style={styles.osmLabel}>
        OpenStreetMap
      </AppText>
      {result ? (
        <View style={styles.pinWrap}>
          <MapPin color={colors.primaryLight} fill={colors.primary} size={30} />
        </View>
      ) : null}
    </View>
  );
}

function SuggestionList({
  suggestions,
  onPress,
}: {
  suggestions: AutocompleteResult[];
  onPress: (suggestion: AutocompleteResult) => void;
}) {
  return (
    <View style={styles.suggestionList}>
      {suggestions.map((suggestion) => (
        <Pressable
          key={`${suggestion.name}-${suggestion.latitude}-${suggestion.longitude}`}
          accessibilityRole="button"
          onPress={() => onPress(suggestion)}
          style={({ pressed }) => [styles.suggestionRow, pressed && styles.pressed]}
        >
          <MapPin color={colors.primaryLight} size={18} />
          <View style={styles.suggestionText}>
            <AppText variant="caption" numberOfLines={1}>
              {suggestion.name}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {suggestion.display_name}
            </AppText>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function RecentLookups({
  recentSearches,
  localRecentLookups,
  showServerRecent,
  isLoading,
  onRecentPress,
  onLocalRecentPress,
}: {
  recentSearches: RecentSearch[];
  localRecentLookups: LocalRecentLookup[];
  showServerRecent: boolean;
  isLoading: boolean;
  onRecentPress: (recentSearch: RecentSearch) => void;
  onLocalRecentPress: (recentLookup: LocalRecentLookup) => void;
}) {
  const hasServerRecent = showServerRecent && recentSearches.length > 0;
  const hasLocalRecent = localRecentLookups.length > 0;

  if (!hasServerRecent && !hasLocalRecent && !isLoading) {
    return null;
  }

  return (
    <View style={styles.recentSection}>
      <View style={styles.sectionHeader}>
        <RefreshCcw color={colors.primaryLight} size={18} />
        <AppText variant="subtitle">Recent lookups</AppText>
      </View>
      {isLoading ? <LoadingState label="Loading recent searches" /> : null}
      {hasServerRecent ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {recentSearches.map((recentSearch) => (
            <Pressable
              key={recentSearch.id}
              accessibilityRole="button"
              onPress={() => onRecentPress(recentSearch)}
              style={({ pressed }) => [styles.recentChip, pressed && styles.pressed]}
            >
              <AppText variant="code" tone="primary">
                {recentSearch.result_ref ?? recentSearch.query}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {recentSearch.display_name ?? recentSearch.query}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {!hasServerRecent && hasLocalRecent ? (
        <View style={styles.localRecentList}>
          {localRecentLookups.map((recentLookup) => (
            <Pressable
              key={recentLookup.key}
              accessibilityRole="button"
              onPress={() => onLocalRecentPress(recentLookup)}
              style={({ pressed }) => [styles.localRecentCard, pressed && styles.pressed]}
            >
              <View style={styles.localRecentText}>
                <View style={styles.localRecentCodeRow}>
                  <AppText variant="code" tone="primary" numberOfLines={1} style={styles.localRecentCode}>
                    {recentLookup.result.gpsCode}
                  </AppText>
                  <AppText variant="caption" tone="primary">
                    View
                  </AppText>
                </View>
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {recentLookup.result.displayName}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SearchStateContent({
  state,
  onDidYouMeanPress,
  onOpenMaps,
  onOpenDirections,
  onCopy,
  onShare,
}: {
  state: ReturnType<typeof useFindGpsSearch>['state'];
  onDidYouMeanPress: (query: string) => void;
  onOpenMaps: (result: ResolvedFindGpsResult) => void;
  onOpenDirections: (result: ResolvedFindGpsResult) => void;
  onCopy: (result: ResolvedFindGpsResult) => void;
  onShare: (result: ResolvedFindGpsResult) => void;
}) {
  if (state.status === 'idle') {
    return null;
  }

  if (state.status === 'loading') {
    return <LoadingState label={`Resolving ${state.query}`} />;
  }

  if (state.status === 'error') {
    return <ErrorBanner message={state.message} />;
  }

  if (state.status === 'empty') {
    return (
      <View style={styles.emptyWrap}>
        <EmptyState
          title="No address found"
          description="Try a place name, nearby landmark, or Ghana GPS code."
        />
        {state.didYouMean ? (
          <AppButton variant="secondary" onPress={() => onDidYouMeanPress(state.didYouMean ?? '')}>
            Did you mean {state.didYouMean}?
          </AppButton>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <View style={styles.addressCodeRow}>
          <AppText variant="caption" tone="muted">
            Your address code
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Copy address code ${state.result.gpsCode}`}
            onPress={() => onCopy(state.result)}
            style={({ pressed }) => [styles.addressCodeButton, pressed && styles.pressed]}
          >
            <AppText variant="code" tone="primary" selectable numberOfLines={1} style={styles.addressCode}>
              {state.result.gpsCode}
            </AppText>
            <Copy color={colors.primaryLight} size={16} />
          </Pressable>
        </View>
        <View style={styles.addressActions}>
          <CompactActionButton
            label="Maps"
            icon={<ExternalLink color={colors.text} size={16} />}
            onPress={() => onOpenMaps(state.result)}
            disabled={!state.result.googleMapsUrl}
          />
          <CompactActionButton
            label="Directions"
            icon={<Navigation color={colors.white} size={16} />}
            variant="primary"
            onPress={() => onOpenDirections(state.result)}
          />
          <CompactActionButton
            label="Share"
            icon={<Share2 color={colors.text} size={16} />}
            onPress={() => onShare(state.result)}
          />
        </View>
      </View>

      <View style={styles.addressDivider} />

      <View style={styles.infoGrid}>
        <InfoCell label="Region" value={state.result.region ?? 'Unknown'} />
        <InfoCell label="District" value={state.result.district ?? 'Unknown'} />
        <InfoCell label="Area" value={state.result.area ?? 'Unknown'} />
        <InfoCell label="Postcode" value={state.result.postcode ?? 'Unknown'} />
      </View>

      <View style={styles.addressDivider} />

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <AppText variant="caption" tone="muted">
            Quality
          </AppText>
          <AppText variant="bodyStrong">
            {formatQualityPercent(state.result.qualityScore)}
          </AppText>
        </View>
        <View style={styles.metaItemWide}>
          <AppText variant="caption" tone="muted">
            Coords
          </AppText>
          <AppText variant="bodyStrong" selectable>
            {formatCoordinate(state.result.latitude)}, {formatCoordinate(state.result.longitude)}
          </AppText>
        </View>
      </View>
    </View>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCell}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="bodyStrong" numberOfLines={2}>
        {value}
      </AppText>
    </View>
  );
}

function CompactActionButton({
  label,
  icon,
  variant = 'secondary',
  disabled = false,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactAction,
        variant === 'primary' && styles.compactActionPrimary,
        disabled && styles.disabledButton,
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <AppText variant="caption" numberOfLines={1} style={styles.compactActionText}>
        {label}
      </AppText>
    </Pressable>
  );
}

function NearbyPanel({
  isLoading,
  errorMessage,
  locations,
  onRetry,
}: {
  isLoading: boolean;
  errorMessage: string | null;
  locations: Array<{
    location: {
      gps_name: string;
      area: string;
      district: string;
      region: string;
      center_latitude: number;
      center_longitude: number;
    };
    distance_km: number;
  }>;
  onRetry: () => void;
}) {
  if (isLoading) {
    return <LoadingState label="Finding nearby places" />;
  }

  if (errorMessage) {
    return (
      <View style={styles.inlineState}>
        <ErrorBanner message={errorMessage} />
        <AppButton variant="secondary" icon={<RefreshCcw color={colors.text} size={18} />} onPress={onRetry}>
          Retry
        </AppButton>
      </View>
    );
  }

  if (locations.length === 0) {
    return <EmptyState title="No nearby places found" description="Try widening the search later." />;
  }

  return (
    <View style={styles.list}>
      {locations.map((item) => (
        <ResultCard
          key={`${item.location.gps_name}-${item.distance_km}`}
          title={item.location.gps_name}
          description={[item.location.area, item.location.district, item.location.region].filter(Boolean).join(', ')}
          meta={`${item.distance_km.toFixed(2)} km away`}
          icon={<Compass color={colors.primaryLight} size={18} />}
        />
      ))}
    </View>
  );
}

function BusinessPanel({
  selectedKind,
  onSelectKind,
  isCountsLoading,
  countsError,
  kinds,
  isListLoading,
  listError,
  landmarks,
  onRetryCounts,
  onRetryList,
}: {
  selectedKind: string | null;
  onSelectKind: (kind: string) => void;
  isCountsLoading: boolean;
  countsError: string | null;
  kinds: Array<{ kind: string; count: number }>;
  isListLoading: boolean;
  listError: string | null;
  landmarks: LandmarkMatch[];
  onRetryCounts: () => void;
  onRetryList: () => void;
}) {
  if (isCountsLoading) {
    return <LoadingState label="Loading business categories" />;
  }

  if (countsError) {
    return (
      <View style={styles.inlineState}>
        <ErrorBanner message={countsError} />
        <AppButton variant="secondary" icon={<RefreshCcw color={colors.text} size={18} />} onPress={onRetryCounts}>
          Retry
        </AppButton>
      </View>
    );
  }

  if (kinds.length === 0) {
    return <EmptyState title="No businesses found" description="No grouped POI counts were returned nearby." />;
  }

  return (
    <View style={styles.businessPanel}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kindRow}>
        {kinds.map((item) => {
          const selected = selectedKind === item.kind;

          return (
            <Pressable
              key={item.kind}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelectKind(item.kind)}
              style={[styles.kindChip, selected && styles.kindChipSelected]}
            >
              <Building2 color={selected ? colors.white : colors.primaryLight} size={16} />
              <AppText variant="caption" tone={selected ? 'default' : 'primary'}>
                {formatKind(item.kind)} · {item.count}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {!selectedKind ? (
        <EmptyState title="Pick a category" description="Choose a business type to list places around this address." />
      ) : null}
      {selectedKind && isListLoading ? <LoadingState label={`Loading ${formatKind(selectedKind)}`} /> : null}
      {selectedKind && listError ? (
        <View style={styles.inlineState}>
          <ErrorBanner message={listError} />
          <AppButton variant="secondary" icon={<RefreshCcw color={colors.text} size={18} />} onPress={onRetryList}>
            Retry
          </AppButton>
        </View>
      ) : null}
      {selectedKind && !isListLoading && !listError && landmarks.length === 0 ? (
        <EmptyState title="No places in this category" />
      ) : null}
      {landmarks.length > 0 ? (
        <View style={styles.list}>
          {landmarks.map((landmark) => (
            <ResultCard
              key={landmark.slug}
              title={landmark.name}
              description={[formatKind(landmark.kind), landmark.street].filter(Boolean).join(' · ')}
              meta={[
                typeof landmark.distance_m === 'number' ? `${Math.round(landmark.distance_m)} m away` : null,
                `Confidence ${formatQualityPercent(landmark.confidence)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
              icon={<Building2 color={colors.primaryLight} size={18} />}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function formatKind(kind: string) {
  return kind.replace(/_/g, ' ');
}

function formatQualityPercent(value: number | undefined) {
  if (typeof value !== 'number') {
    return 'Unknown';
  }

  const percent = value <= 1 ? value * 100 : value;

  return `${Math.round(percent)}%`;
}

function getMapRegion(result: ResolvedFindGpsResult | null): Region {
  return {
    latitude: result?.latitude ?? 5.6037,
    longitude: result?.longitude ?? -0.187,
    latitudeDelta: result ? 0.006 : 4.8,
    longitudeDelta: result ? 0.006 : 4.8,
  };
}

function getAddressText(result: ResolvedFindGpsResult) {
  return `${result.gpsCode}\n${result.displayName}\nRegion: ${result.region ?? 'Unknown'}\nDistrict: ${
    result.district ?? 'Unknown'
  }\nArea: ${result.area ?? 'Unknown'}\nPostcode: ${result.postcode ?? 'Unknown'}\nQuality: ${formatQualityPercent(
    result.qualityScore,
  )}\nCoords: ${formatCoordinate(result.latitude)}, ${formatCoordinate(result.longitude)}`;
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

async function copyAddress(result: ResolvedFindGpsResult) {
  await Clipboard.setStringAsync(getAddressText(result));
}

async function shareResult(result: ResolvedFindGpsResult) {
  await Share.share({
    message: getAddressText(result),
  });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  screenContent: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  mapPanel: {
    minHeight: 360,
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: '#dbe7cf',
  },
  mapPreview: {
    flex: 1,
    minHeight: 360,
    backgroundColor: '#cfdec9',
  },
  mapView: {
    flex: 1,
    minHeight: 360,
  },
  markerWrap: {
    alignItems: 'center',
  },
  markerBubble: {
    maxWidth: 150,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  markerCode: {
    color: colors.text,
  },
  markerPin: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
    borderWidth: 2,
    borderColor: colors.white,
  },
  landMass: {
    position: 'absolute',
    backgroundColor: '#e5ead7',
    opacity: 0.9,
  },
  landMassOne: {
    top: 34,
    left: -28,
    width: 240,
    height: 190,
    borderRadius: 90,
    transform: [{ rotate: '-18deg' }],
  },
  landMassTwo: {
    top: 70,
    right: -45,
    width: 250,
    height: 230,
    borderRadius: 120,
    transform: [{ rotate: '12deg' }],
  },
  landMassThree: {
    bottom: 60,
    left: 80,
    width: 210,
    height: 140,
    borderRadius: 80,
    transform: [{ rotate: '22deg' }],
  },
  water: {
    position: 'absolute',
    backgroundColor: '#70d1dc',
    opacity: 0.95,
  },
  waterOne: {
    left: -40,
    right: -40,
    bottom: -45,
    height: 120,
    borderTopLeftRadius: 170,
    borderTopRightRadius: 120,
  },
  waterTwo: {
    top: 124,
    left: '48%',
    width: 64,
    height: 112,
    borderRadius: 32,
    transform: [{ rotate: '-28deg' }],
  },
  mapGrid: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: 'rgba(93, 111, 96, 0.18)',
  },
  countryLabel: {
    position: 'absolute',
    top: 165,
    left: '42%',
    color: 'rgba(76, 86, 87, 0.42)',
  },
  cityLabel: {
    position: 'absolute',
    bottom: 80,
    left: '54%',
    color: 'rgba(76, 86, 87, 0.62)',
  },
  osmLabel: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.sm,
    borderRadius: radius.round,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    color: '#4b514d',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pinWrap: {
    position: 'absolute',
    top: '47%',
    left: '53%',
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: colors.card,
  },
  searchOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(17, 24, 20, 0.95)',
    padding: spacing.sm,
  },
  suggestionPopover: {
    position: 'absolute',
    top: 82,
    left: spacing.md,
    right: 62,
    maxHeight: 190,
    zIndex: 5,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  searchBar: {
    flex: 1,
  },
  searchInput: {
    minWidth: 0,
  },
  searchButton: {
    width: 44,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.78,
  },
  locateButton: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  suggestionList: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(26, 35, 29, 0.98)',
  },
  suggestionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionText: {
    flex: 1,
    gap: spacing.xs,
  },
  successBanner: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  recentSection: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  recentChip: {
    width: 210,
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  localRecentList: {
    gap: spacing.sm,
  },
  localRecentCard: {
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  localRecentText: {
    minWidth: 0,
    gap: spacing.xs,
  },
  localRecentCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  localRecentCode: {
    flex: 1,
    minWidth: 0,
  },
  emptyWrap: {
    gap: spacing.md,
  },
  addressCard: {
    gap: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  addressHeader: {
    gap: spacing.md,
  },
  addressCodeRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  addressCode: {
    letterSpacing: 0,
    flexShrink: 1,
  },
  addressCodeButton: {
    minWidth: 0,
    maxWidth: '62%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addressActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  compactAction: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.sm,
    flexGrow: 1,
    flexBasis: 96,
  },
  compactActionText: {
    flexShrink: 1,
  },
  compactActionPrimary: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  addressDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
  },
  infoCell: {
    width: '50%',
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  metaItem: {
    minWidth: 82,
    gap: spacing.xs,
  },
  metaItemWide: {
    flex: 1,
    minWidth: 220,
    gap: spacing.xs,
  },
  resultTabs: {
    gap: spacing.md,
  },
  inlineState: {
    gap: spacing.md,
  },
  list: {
    gap: spacing.md,
  },
  businessPanel: {
    gap: spacing.md,
  },
  kindRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  kindChip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
  },
  kindChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDark,
  },
});
