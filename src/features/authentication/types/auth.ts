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

export type UsageSummary = {
  daily_limit?: number;
  usage_today?: number;
  expires_at?: string | null;
  history?: readonly unknown[];
};

export type AccountInfo = {
  id?: number;
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
