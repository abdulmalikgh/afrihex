import { useCallback, useState } from 'react';

import { resolveCoordinates } from '../../../utils/resolveAddressQuery';

export type AvoidLocation = {
  id: string;
  lat: number;
  lng: number;
  label: string;
};

/**
 * Tracks "avoid this location" pins added by long-pressing the route map. A failed
 * reverse lookup for the label must never block adding the pin — it just falls back to
 * a coordinate label.
 */
export function useAvoidLocations() {
  const [items, setItems] = useState<AvoidLocation[]>([]);

  const add = useCallback(async (lat: number, lng: number) => {
    const id = `${lat.toFixed(5)},${lng.toFixed(5)}`;

    setItems((current) => {
      if (current.some((item) => item.id === id)) {
        return current;
      }

      return [...current, { id, lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` }];
    });

    try {
      const result = await resolveCoordinates(lat, lng);
      setItems((current) => current.map((item) => (item.id === id ? { ...item, label: result.displayName } : item)));
    } catch {
      // Keep the coordinate fallback label already set above.
    }
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  return { items, add, remove, clear };
}
