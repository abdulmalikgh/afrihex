import * as SecureStore from 'expo-secure-store';

import type { AfriHexUser } from '../features/authentication/types/auth';

const AUTH_TOKEN_KEY = 'afrihex.authToken';
const AUTH_USER_KEY = 'afrihex.authUser';

export async function getStoredAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function setStoredAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export async function clearStoredAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

export async function getStoredAuthUser(): Promise<AfriHexUser | null> {
  const storedUser = await SecureStore.getItemAsync(AUTH_USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(storedUser);

    return isStoredUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setStoredAuthUser(user: AfriHexUser): Promise<void> {
  await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(user));
}

export async function clearStoredAuthUser(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_USER_KEY);
}

function isStoredUser(value: unknown): value is AfriHexUser {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'number' &&
    typeof value.name === 'string' &&
    typeof value.email === 'string' &&
    typeof value.plan === 'string' &&
    typeof value.daily_limit === 'number' &&
    typeof value.usage_today === 'number' &&
    (typeof value.expires_at === 'string' || value.expires_at === null)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
