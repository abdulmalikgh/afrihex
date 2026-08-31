export type AfriHexUser = {
  id: number;
  name: string;
  email: string;
  plan: string;
  daily_limit: number;
  usage_today: number;
  expires_at: string | null;
  api_key?: string;
  key_prefix?: string;
  is_admin?: boolean;
};

export type AuthSession = {
  token: string;
  user: AfriHexUser;
};

export type UsageEndpointCount = {
  Endpoint: string;
  Count: number;
};

/**
 * `/v2/usage` as it is actually returned. There is no `usage_today` on this
 * endpoint — the only place that field exists is the `user` object in the
 * login/register response — and the per-endpoint breakdown is `top_endpoints`,
 * not a `history` array.
 */
export type UsageSummary = {
  active?: boolean;
  tier?: string;
  daily_limit?: number;
  bulk_today?: number;
  expired?: boolean;
  days_until_expiry?: number;
  expires_at?: string | null;
  top_endpoints?: readonly UsageEndpointCount[];
};

/**
 * `/v2/me`. Every field is optional because the endpoint returns a narrower
 * object than login does — notably no `id` and no `usage_today`, and the plan
 * arrives as `tier`.
 */
export type AccountInfo = {
  id?: number;
  active?: boolean;
  created_at?: string;
  name?: string;
  email?: string;
  plan?: string;
  daily_limit?: number;
  usage_today?: number;
  expires_at?: string | null;
  api_key?: string;
  key_prefix?: string;
  is_admin?: boolean;
};
