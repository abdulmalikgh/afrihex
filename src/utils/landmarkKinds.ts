import {
  Banknote,
  Building2,
  Bus,
  Church,
  Fuel,
  GraduationCap,
  Hotel,
  Landmark,
  Pill,
  ShoppingBag,
  Stethoscope,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';

/**
 * Maps an API landmark `kind` to an icon and a human-readable label.
 * Distinct icons make a long result list scannable at a glance, which a
 * repeated generic icon cannot do.
 */
const KIND_ICONS: Record<string, LucideIcon> = {
  atm: Banknote,
  bank: Banknote,
  bus_station: Bus,
  bus_stop: Bus,
  cafe: UtensilsCrossed,
  church: Church,
  clinic: Stethoscope,
  college: GraduationCap,
  fuel: Fuel,
  hospital: Stethoscope,
  hotel: Hotel,
  guest_house: Hotel,
  landmark: Landmark,
  market: ShoppingBag,
  mosque: Church,
  pharmacy: Pill,
  place_of_worship: Church,
  restaurant: UtensilsCrossed,
  school: GraduationCap,
  shop: ShoppingBag,
  supermarket: ShoppingBag,
  university: GraduationCap,
};

export function getKindIcon(kind: string): LucideIcon {
  return KIND_ICONS[kind.toLowerCase()] ?? Building2;
}

/** Turns an API kind such as `place_of_worship` into `Place of worship`. */
export function formatKind(kind: string) {
  const spaced = kind.replace(/_/g, ' ').trim();

  if (!spaced) {
    return 'Place';
  }

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Formats a metre distance the way a person would say it: metres when close,
 * kilometres with one decimal once it stops being walkable.
 */
export function formatDistance(metres: number | undefined) {
  if (typeof metres !== 'number' || Number.isNaN(metres)) {
    return null;
  }

  if (metres < 1000) {
    return `${Math.round(metres)} m`;
  }

  return `${(metres / 1000).toFixed(1)} km`;
}
