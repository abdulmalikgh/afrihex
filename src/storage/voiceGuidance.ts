import * as SecureStore from 'expo-secure-store';

/**
 * The spoken-guidance verbosity, remembered across trips.
 *
 * SecureStore rather than a plain key/value store because it is the only one the
 * app ships — `useOfflineBasemap` already keeps a Last-Modified header in it. The
 * value is not a secret; it is here for the storage, not the encryption.
 *
 * Persisted at all because muting is a standing preference, not a per-trip one.
 * A driver who turns the voice off does so because they know the road or because
 * a passenger is asleep, and asking them to turn it off again at the start of
 * every trip is how the setting becomes useless.
 */
const VOICE_VERBOSITY_KEY = 'afrihex.navigation.voice_verbosity';

export type StoredVoiceVerbosity = 'full' | 'essential' | 'muted';

function isVerbosity(value: string | null): value is StoredVoiceVerbosity {
  return value === 'full' || value === 'essential' || value === 'muted';
}

/** `null` when nothing is stored, or when the read fails — the caller defaults. */
export async function readVoiceVerbosity(): Promise<StoredVoiceVerbosity | null> {
  try {
    const stored = await SecureStore.getItemAsync(VOICE_VERBOSITY_KEY);

    return isVerbosity(stored) ? stored : null;
  } catch {
    // A preference is not worth failing a trip over.
    return null;
  }
}

export async function writeVoiceVerbosity(value: StoredVoiceVerbosity): Promise<void> {
  try {
    await SecureStore.setItemAsync(VOICE_VERBOSITY_KEY, value);
  } catch {
    // Same: the setting still applies to this trip, it just will not outlive it.
  }
}
