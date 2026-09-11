import { useCallback, useEffect, useRef, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { API_BASE_URL } from '../../../api/client';

const ARCHIVE_URL = `${API_BASE_URL}/v2/tiles/ghana.pmtiles`;
const ARCHIVE_NAME = 'ghana.pmtiles';
/** Where the `Last-Modified` of the saved copy lives, for the update check. */
const LAST_MODIFIED_KEY = 'afrihex.offline.lastModified';

/** Anything smaller than this is a failed download, not an archive. */
const MIN_PLAUSIBLE_BYTES = 4_096;
/** The PMTiles v3 magic bytes, as the first seven characters of the file. */
const MAGIC = 'PMTiles';

export type OfflineState = {
  status: 'unknown' | 'absent' | 'ready' | 'invalid';
  sizeBytes?: number;
  lastModified?: string;
  updateAvailable?: boolean;
};

function archiveFile() {
  return new File(Paths.document, ARCHIVE_NAME);
}

/**
 * The offline basemap archive: download once, use with no signal.
 *
 * What this does *not* do is render it. `ghana.pmtiles` is a PMTiles v3 vector
 * archive and the app's map is `react-native-maps`, which has no PMTiles
 * reader — the doc is explicit that rendering is the client's problem. So the
 * download, validation, update check and delete are all here and working, and
 * the tiles are not yet drawn anywhere. Wiring a renderer is a separate change
 * that means swapping the map library.
 */
export function useOfflineBasemap() {
  const [state, setState] = useState<OfflineState>({ status: 'unknown' });
  const [progress, setProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Trusts a saved file only after two checks the doc calls for: a plausible
   * size, and the literal `PMTiles` magic bytes. A truncated download otherwise
   * looks identical to a good one until the renderer chokes on it.
   */
  const inspect = useCallback(async (): Promise<OfflineState> => {
    const file = archiveFile();

    if (!file.exists) {
      return { status: 'absent' };
    }

    const size = file.size ?? 0;

    if (size < MIN_PLAUSIBLE_BYTES) {
      return { status: 'invalid', sizeBytes: size };
    }

    try {
      const head = await file.slice(0, MAGIC.length).text();

      if (head !== MAGIC) {
        return { status: 'invalid', sizeBytes: size };
      }
    } catch {
      return { status: 'invalid', sizeBytes: size };
    }

    const lastModified = (await SecureStore.getItemAsync(LAST_MODIFIED_KEY)) ?? undefined;

    return { status: 'ready', sizeBytes: size, lastModified };
  }, []);

  const refresh = useCallback(async () => {
    setState(await inspect());
  }, [inspect]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const download = useCallback(async () => {
    setErrorMessage(null);
    setProgress(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await File.downloadFileAsync(ARCHIVE_URL, archiveFile(), {
        idempotent: true,
        signal: controller.signal,
        onProgress: ({ bytesWritten, totalBytes }) => {
          // `-1` means the server sent no Content-Length; show indeterminate
          // rather than a fake percentage.
          setProgress(totalBytes > 0 ? bytesWritten / totalBytes : null);
        },
      });

      const response = await fetch(ARCHIVE_URL, { method: 'HEAD' });
      const lastModified = response.headers.get('Last-Modified');

      if (lastModified) {
        await SecureStore.setItemAsync(LAST_MODIFIED_KEY, lastModified);
      }

      const next = await inspect();

      // A file that fails validation is deleted rather than left to be used:
      // the doc's instruction is to fall back to the live tile source.
      if (next.status === 'invalid') {
        archiveFile().delete();
        setErrorMessage('The download did not complete properly. It has been removed — try again.');
        setState({ status: 'absent' });
      } else {
        setState(next);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        setErrorMessage(null);
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'The download failed.');
      }

      await refresh();
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  }, [inspect, refresh]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /**
   * Compares the server's `Last-Modified` against the saved one as dates, not
   * strings. A `HEAD` failure is treated as "no update" — an offline device
   * should not be nagged about an update it cannot see.
   */
  const checkForUpdate = useCallback(async () => {
    const stored = await SecureStore.getItemAsync(LAST_MODIFIED_KEY);

    if (!stored) {
      return;
    }

    try {
      const response = await fetch(ARCHIVE_URL, { method: 'HEAD' });
      const serverValue = response.headers.get('Last-Modified');

      if (!serverValue) {
        return;
      }

      const server = new Date(serverValue).getTime();
      const saved = new Date(stored).getTime();

      if (Number.isNaN(server) || Number.isNaN(saved)) {
        return;
      }

      setState((current) => ({ ...current, updateAvailable: server > saved }));
    } catch {
      // Offline or timing out: treat as no update.
    }
  }, []);

  const remove = useCallback(async () => {
    const file = archiveFile();

    if (file.exists) {
      file.delete();
    }

    await SecureStore.deleteItemAsync(LAST_MODIFIED_KEY);
    setState({ status: 'absent' });
  }, []);

  return { state, progress, errorMessage, download, cancel, checkForUpdate, remove, refresh };
}
