import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';

type CertificateAddressMapProps = {
  lat: number;
  lng: number;
};

/**
 * A still pin on the verified address. Deliberately not interactive: this is
 * evidence of where the check happened, not a map to explore, and a pannable
 * map inside a scrolling document fights the scroll.
 */
export function CertificateAddressMap({ lat, lng }: CertificateAddressMapProps) {
  return (
    <View style={styles.container} pointerEvents="none">
      <MapView
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        region={{
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        }}
      >
        <Marker coordinate={{ latitude: lat, longitude: lng }} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 160,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
  },
});
