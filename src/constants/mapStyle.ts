/**
 * Water, lifted out so the web fallback's painted "map" can match the real tiles.
 * Cooler than the land tones so the coastline stays legible on a dark map.
 */
export const mapWater = '#0c191d';

/**
 * Top-of-map scrim. The map runs under the status bar and its labels collide with
 * the clock and battery; this keeps the system glyphs readable without walling the
 * map off behind an opaque strip.
 */
export const mapStatusScrim = ['rgba(0, 0, 0, 0.45)', 'rgba(0, 0, 0, 0)'] as const;

/**
 * Dark map tiles tuned to the AfriHex palette.
 *
 * Without this the app renders default light Google tiles underneath dark chrome,
 * which reads as a bright hole in the middle of the screen. Colours are pulled
 * from `colors.ts` so the map recedes and the route, markers and chrome stay the
 * brightest things on top of it.
 *
 * Applies to the Google provider (Android, and iOS when `PROVIDER_GOOGLE` is set).
 * Apple Maps ignores it and follows the `userInterfaceStyle` prop instead, so map
 * components should set both.
 */
export const mapDarkStyle = [
  { elementType: 'geometry', stylers: [{ color: '#16201a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca89f' }] },
  // Every label gets a dark halo so text stays legible over roads and water.
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111814' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3c4a40' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#b7c2b9' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#c7d1c8' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },

  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#16201a' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#1a231d' }] },

  // Parks lean green rather than grey so open space still reads as open space.
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#14281c' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6f9c7f' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#8e9a91' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },

  // Road hierarchy is carried by lightness: arterial > local, highway brightest.
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#26312a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a231d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a49b' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#2d3931' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#3c4a40' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#111814' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#c2ccc4' }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: '#222c25' }] },

  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#232e26' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#8e9a91' }] },

  // Cooled off the green so the coastline stays obvious against the land.
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c191d' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4d6b72' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#0c191d' }] },
];
