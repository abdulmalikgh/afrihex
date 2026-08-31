import { apiRequest, isObject } from './client';
import type {
  AccountInfo,
  AfriHexUser,
  AuthSession,
  UsageEndpointCount,
  UsageSummary,
} from '../features/authentication/types/auth';

type LoginRequest = {
  email: string;
  password: string;
};

type RegisterRequest = {
  name: string;
  email: string;
  password: string;
};

type ForgotPasswordRequest = {
  email: string;
};

type ResetPasswordRequest = {
  token: string;
  new_password: string;
};

type ChangePasswordRequest = {
  current_password?: string;
  new_password: string;
};

export function loginWithEmail(body: LoginRequest): Promise<AuthSession> {
  return apiRequest({
    path: '/v2/auth/login',
    method: 'POST',
    body,
    parseData: parseAuthSession,
  });
}

export function registerWithEmail(body: RegisterRequest): Promise<AuthSession> {
  return apiRequest({
    path: '/v2/auth/register',
    method: 'POST',
    body,
    parseData: parseAuthSession,
  });
}

export function exchangeGoogleCode(code: string): Promise<AuthSession> {
  return apiRequest({
    path: '/v2/auth/google/exchange',
    method: 'POST',
    body: { code },
    parseData: parseAuthSession,
  });
}

export function getCurrentUser(): Promise<AccountInfo> {
  return apiRequest({
    path: '/v2/me',
    authenticated: true,
    parseData: parseAccountInfo,
  });
}

export function getUsageSummary(): Promise<UsageSummary> {
  return apiRequest({
    path: '/v2/usage',
    authenticated: true,
    parseData: parseUsageSummary,
  });
}

export function requestPasswordReset(body: ForgotPasswordRequest): Promise<void> {
  return apiRequest({
    path: '/v2/auth/forgot-password',
    method: 'POST',
    body,
    parseData: () => undefined,
  });
}

export function resetPassword(body: ResetPasswordRequest): Promise<void> {
  return apiRequest({
    path: '/v2/auth/reset-password',
    method: 'POST',
    body,
    parseData: () => undefined,
  });
}

export function changePassword(body: ChangePasswordRequest): Promise<void> {
  return apiRequest({
    path: '/v2/me/password',
    method: 'POST',
    body,
    authenticated: true,
    parseData: () => undefined,
  });
}

function parseAuthSession(data: unknown): AuthSession {
  if (!isObject(data) || typeof data.token !== 'string') {
    throw new Error('Auth response is missing a token.');
  }

  return {
    token: data.token,
    user: parseUser(data.user),
  };
}

function parseUser(data: unknown): AfriHexUser {
  const userData = unwrapUserData(data);

  if (!isObject(userData)) {
    throw new Error('User response is invalid.');
  }

  const expiresAt = userData.expires_at;
  const plan = typeof userData.plan === 'string' ? userData.plan : userData.tier;

  if (
    typeof userData.id !== 'number' ||
    typeof userData.name !== 'string' ||
    typeof userData.email !== 'string' ||
    typeof plan !== 'string' ||
    typeof userData.daily_limit !== 'number' ||
    typeof userData.usage_today !== 'number' ||
    !(typeof expiresAt === 'string' || expiresAt === null || expiresAt === undefined)
  ) {
    throw new Error('User response has an unexpected shape.');
  }

  return {
    id: userData.id,
    name: userData.name,
    email: userData.email,
    plan,
    daily_limit: userData.daily_limit,
    usage_today: userData.usage_today,
    expires_at: expiresAt ?? null,
    ...(typeof userData.api_key === 'string' ? { api_key: userData.api_key } : {}),
    ...(typeof userData.key_prefix === 'string' ? { key_prefix: userData.key_prefix } : {}),
    ...(typeof userData.is_admin === 'boolean' ? { is_admin: userData.is_admin } : {}),
  };
}

function unwrapUserData(data: unknown): unknown {
  if (isObject(data) && isObject(data.user)) {
    return data.user;
  }

  return data;
}

function parseAccountInfo(data: unknown): AccountInfo {
  const accountData = unwrapUserData(data);

  if (!isObject(accountData)) {
    throw new Error('Account response is invalid.');
  }

  const expiresAt = accountData.expires_at;
  const plan = typeof accountData.plan === 'string' ? accountData.plan : accountData.tier;

  return {
    ...(typeof accountData.id === 'number' ? { id: accountData.id } : {}),
    ...(typeof accountData.name === 'string' ? { name: accountData.name } : {}),
    ...(typeof accountData.email === 'string' ? { email: accountData.email } : {}),
    ...(typeof plan === 'string' ? { plan } : {}),
    ...(typeof accountData.daily_limit === 'number' ? { daily_limit: accountData.daily_limit } : {}),
    ...(typeof accountData.usage_today === 'number' ? { usage_today: accountData.usage_today } : {}),
    ...(typeof expiresAt === 'string' || expiresAt === null ? { expires_at: expiresAt } : {}),
    ...(typeof accountData.api_key === 'string' ? { api_key: accountData.api_key } : {}),
    ...(typeof accountData.key_prefix === 'string' ? { key_prefix: accountData.key_prefix } : {}),
    ...(typeof accountData.is_admin === 'boolean' ? { is_admin: accountData.is_admin } : {}),
    ...(typeof accountData.active === 'boolean' ? { active: accountData.active } : {}),
    ...(typeof accountData.created_at === 'string' ? { created_at: accountData.created_at } : {}),
  };
}

function parseUsageSummary(data: unknown): UsageSummary {
  if (!isObject(data)) {
    throw new Error('Usage response is invalid.');
  }

  return {
    active: typeof data.active === 'boolean' ? data.active : undefined,
    tier: typeof data.tier === 'string' ? data.tier : undefined,
    daily_limit: typeof data.daily_limit === 'number' ? data.daily_limit : undefined,
    bulk_today: typeof data.bulk_today === 'number' ? data.bulk_today : undefined,
    expired: typeof data.expired === 'boolean' ? data.expired : undefined,
    days_until_expiry:
      typeof data.days_until_expiry === 'number' ? data.days_until_expiry : undefined,
    expires_at:
      typeof data.expires_at === 'string' || data.expires_at === null ? data.expires_at : undefined,
    top_endpoints: Array.isArray(data.top_endpoints)
      ? data.top_endpoints.filter(isUsageEndpointCount)
      : undefined,
  };
}

function isUsageEndpointCount(value: unknown): value is UsageEndpointCount {
  return isObject(value) && typeof value.Endpoint === 'string' && typeof value.Count === 'number';
}
