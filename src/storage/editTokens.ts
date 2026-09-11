import * as SecureStore from 'expo-secure-store';

/**
 * Edit tokens for the account-less features — a claimed promotion, a saved
 * address profile. Each is shown exactly once at creation and is the only proof
 * of ownership there will ever be: there is no lookup-by-phone or
 * lookup-by-slug endpoint to recover one.
 *
 * SecureStore rather than a plain key/value store for the same reason the API
 * key lives there. Losing one is unrecoverable, and it is a bearer credential
 * for someone else's business listing.
 */

/** SecureStore keys allow alphanumerics, `.`, `-` and `_` only. */
function toStorageKey(scope: string, id: string) {
  const safeId = id.replace(/[^A-Za-z0-9._-]/g, '_');

  return `afrihex.editToken.${scope}.${safeId}`;
}

export async function getEditToken(scope: string, id: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(toStorageKey(scope, id));
  } catch {
    // A read failure must never look like "you do not own this" — the caller
    // shows the same prompt it would for a token that was never saved.
    return null;
  }
}

export async function setEditToken(scope: string, id: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(toStorageKey(scope, id), token);
}

export async function clearEditToken(scope: string, id: string): Promise<void> {
  await SecureStore.deleteItemAsync(toStorageKey(scope, id));
}

/**
 * The ids the user owns for a scope, so a screen can list "your promotions"
 * without a server endpoint for it — neither feature has one.
 *
 * Kept beside the tokens rather than derived from them because SecureStore
 * cannot enumerate its own keys.
 */
const INDEX_KEY_PREFIX = 'afrihex.editTokenIndex.';

export async function getOwnedIds(scope: string): Promise<string[]> {
  try {
    const stored = await SecureStore.getItemAsync(`${INDEX_KEY_PREFIX}${scope}`);

    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);

    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function rememberOwnedId(scope: string, id: string): Promise<void> {
  const current = await getOwnedIds(scope);

  if (current.includes(id)) {
    return;
  }

  await SecureStore.setItemAsync(`${INDEX_KEY_PREFIX}${scope}`, JSON.stringify([id, ...current]));
}

export async function forgetOwnedId(scope: string, id: string): Promise<void> {
  const current = await getOwnedIds(scope);

  await SecureStore.setItemAsync(
    `${INDEX_KEY_PREFIX}${scope}`,
    JSON.stringify(current.filter((owned) => owned !== id)),
  );
}
