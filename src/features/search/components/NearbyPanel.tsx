import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { Compass } from 'lucide-react-native';

import { mapColors } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';
import { MapDivider, MapListRow } from './MapListRow';
import { MapEmptyState, MapErrorState, MapLoadingState } from './MapStates';

type NearbyLocation = {
  location: {
    gps_name: string;
    /** Administrative fields go empty outside the big cities. */
    area?: string;
    district?: string;
    region?: string;
    center_latitude: number;
    center_longitude: number;
  };
  distance_km: number;
};

type NearbyPanelProps = {
  isLoading: boolean;
  errorMessage: string | null;
  locations: NearbyLocation[];
  radiusKm: number;
  onRetry: () => void;
  onSearchWider: () => void;
};

export function NearbyPanel({
  isLoading,
  errorMessage,
  locations,
  radiusKm,
  onRetry,
  onSearchWider,
}: NearbyPanelProps) {
  if (isLoading) {
    return <MapLoadingState label="Finding nearby places" />;
  }

  if (errorMessage) {
    return (
      <View style={styles.inset}>
        <MapErrorState message={errorMessage} onRetry={onRetry} />
      </View>
    );
  }

  if (locations.length === 0) {
    return (
      <MapEmptyState
        title="No nearby places found"
        description={`Nothing within ${radiusKm} km yet.`}
        actionLabel={radiusKm < 5 ? `Search wider (${Math.min(radiusKm * 2, 5)} km)` : undefined}
        onAction={radiusKm < 5 ? onSearchWider : undefined}
      />
    );
  }

  return (
    <View>
      {locations.map((item, index) => (
        <Fragment key={`${item.location.gps_name}-${item.distance_km}`}>
          {index > 0 ? <MapDivider /> : null}
          <MapListRow
            iconVariant="container"
            icon={<Compass color={mapColors.onSurfaceVariant} size={20} />}
            title={item.location.gps_name}
            subtitle={[item.location.area, item.location.district, item.location.region].filter(Boolean).join(', ')}
            meta={`${item.distance_km.toFixed(2)} km`}
          />
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  inset: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
