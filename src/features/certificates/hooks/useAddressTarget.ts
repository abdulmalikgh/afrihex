import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';

import { lookupAddress, reverseLookup } from '../../../api/search';
import { useDebouncedValue } from '../../search/hooks/useDebouncedValue';

/** What the user is about to verify, resolved to a point we can show them. */
export type AddressTarget = {
  source: 'gps_code' | 'gps_fix';
  gpsCode: string;
  lat: number;
  lng: number;
  label?: string;
  area?: string;
  qualityScore?: number;
  /** Device fixes only. A 150 m fix is worth seeing before committing to it. */
  accuracyM?: number;
};

type DeviceFix = { lat: number; lng: number; accuracyM?: number };

/**
 * Resolves whatever the user has entered into a point on a map, so they can see
 * where the check is about to be recorded before it happens. Verifying writes to
 * their account and mints a signed certificate — a wrong code or a loose GPS fix
 * is worth catching a moment earlier.
 */
export function useAddressTarget(gpsCode: string) {
  const [fix, setFix] = useState<DeviceFix | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const trimmed = gpsCode.trim();
  const debouncedCode = useDebouncedValue(trimmed, 500);

  // The typed field wins whenever it has content, so the two inputs never
  // disagree about what is on screen.
  const codeEnabled = isResolvableCode(debouncedCode);
  const fixEnabled = !trimmed && fix !== null;

  const codeQuery = useQuery({
    queryKey: ['lookup', debouncedCode],
    queryFn: () => lookupAddress(debouncedCode),
    enabled: codeEnabled,
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const fixQuery = useQuery({
    queryKey: ['reverse', fix?.lat, fix?.lng],
    queryFn: () => {
      if (!fix) {
        throw new Error('No device fix to resolve.');
      }

      return reverseLookup({ lat: fix.lat, lng: fix.lng });
    },
    enabled: fixEnabled,
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const useCurrentLocation = useCallback(async () => {
    setLocationError(null);
    setIsLocating(true);

    try {
      // Asked at the moment it pays for itself, rather than on screen open.
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        setLocationError(
          permission.canAskAgain
            ? 'Location permission is off. Allow it, or enter your GPS code.'
            : 'Location is blocked for AfriHex. Turn it on in Settings, or enter your GPS code.',
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setFix({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyM: position.coords.accuracy ?? undefined,
      });
    } catch {
      setLocationError('Your location could not be read. Try again, or enter your GPS code.');
    } finally {
      setIsLocating(false);
    }
  }, []);

  const clearFix = useCallback(() => {
    setFix(null);
    setLocationError(null);
  }, []);

  return {
    target: buildTarget(trimmed, fix, codeQuery.data, fixQuery.data),
    isResolving: (codeEnabled && codeQuery.isFetching) || (fixEnabled && fixQuery.isFetching),
    resolveFailed: codeEnabled && codeQuery.isError,
    isLocating,
    locationError,
    useCurrentLocation,
    clearFix,
  };
}

function buildTarget(
  trimmedCode: string,
  fix: DeviceFix | null,
  codeResult: Awaited<ReturnType<typeof lookupAddress>> | undefined,
  fixResult: Awaited<ReturnType<typeof reverseLookup>> | undefined,
): AddressTarget | null {
  if (trimmedCode) {
    return codeResult
      ? {
          source: 'gps_code',
          gpsCode: trimmedCode,
          lat: codeResult.center_latitude,
          lng: codeResult.center_longitude,
          label: codeResult.gps_name || codeResult.address,
          area: joinArea(codeResult.area, codeResult.district, codeResult.region),
          qualityScore: codeResult.quality_score,
        }
      : null;
  }

  if (!fix) {
    return null;
  }

  // A fix is showable the moment it arrives; the reverse lookup only adds the
  // name, so the pin never waits on a second round trip.
  return {
    source: 'gps_fix',
    gpsCode: fixResult?.gps_name ?? '',
    lat: fix.lat,
    lng: fix.lng,
    label: fixResult?.gps_name || fixResult?.address,
    area: joinArea(fixResult?.area, fixResult?.district, fixResult?.region),
    qualityScore: fixResult?.quality_score,
    accuracyM: fix.accuracyM,
  };
}

function joinArea(...parts: Array<string | undefined>) {
  const joined = parts.filter(Boolean).join(' · ');

  return joined || undefined;
}

/**
 * Only resolve something long enough to be a whole code. Every lookup counts
 * against the signed-in user's daily quota, so partial typing must not spend it.
 */
function isResolvableCode(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, '').length >= 8;
}
