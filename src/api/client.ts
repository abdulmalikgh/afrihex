import { getStoredAuthToken } from '../storage/authToken';

export const API_BASE_URL = 'https://api.afrihex.com';
export const AUTH_HEADER = 'X-API-Key';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ApiMeta = {
  request_id?: string;
  cached?: boolean;
  /** Go duration string on the wire, e.g. "3.806918ms" — not a number. */
  latency?: string;
};

type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

type ApiSuccessBody = {
  success: true;
  data?: unknown;
  meta?: ApiMeta;
};

type ApiRequestOptions<TData> = {
  path: string;
  method?: HttpMethod;
  body?: object;
  authenticated?: boolean;
  parseData: (data: unknown) => TData;
};

type FetchApiEnvelopeOptions = {
  path: string;
  method?: HttpMethod;
  body?: object;
  authenticated?: boolean;
};

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor({ code, message, status }: { code: string; message: string; status: number }) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Fetches an AfriHex endpoint and returns the raw `{ success: true, ... }` envelope
 * object, without assuming the payload lives under `data` — most endpoints use `data`,
 * but at least one (`route/traffic`) uses a different top-level key. Returns `undefined`
 * only for a genuinely empty success body (e.g. `204 No Content`).
 */
export async function fetchApiEnvelope({
  path,
  method = 'GET',
  body,
  authenticated = false,
}: FetchApiEnvelopeOptions): Promise<Record<string, unknown> | undefined> {
  const headers = new Headers({ Accept: 'application/json' });

  if (body) {
    headers.set('Content-Type', 'application/json');
  }

  if (authenticated) {
    const token = await getStoredAuthToken();

    if (token) {
      headers.set(AUTH_HEADER, token);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const responseText = await response.text();
  // Infrastructure errors — a proxy 502, a CDN 401 — arrive as HTML or plain text,
  // not the documented envelope. Parsing those must not throw a raw SyntaxError,
  // or the failure never becomes an ApiRequestError and the session-invalid
  // handling upstream never sees it.
  let responseBody: unknown;

  try {
    responseBody = responseText ? JSON.parse(responseText) : undefined;
  } catch {
    throw new ApiRequestError({
      code: response.ok ? 'INVALID_RESPONSE' : 'HTTP_ERROR',
      message: response.ok
        ? 'The server returned an unexpected response.'
        : `Request failed with status ${response.status}`,
      status: response.status,
    });
  }

  if (!response.ok || isApiErrorBody(responseBody)) {
    const error = isApiErrorBody(responseBody)
      ? responseBody.error
      : { code: 'HTTP_ERROR', message: `Request failed with status ${response.status}` };

    throw new ApiRequestError({
      code: error.code,
      message: error.message,
      status: response.status,
    });
  }

  if (responseBody === undefined) {
    return undefined;
  }

  if (!isApiSuccessBody(responseBody)) {
    throw new ApiRequestError({
      code: 'INVALID_RESPONSE',
      message: 'The server returned an unexpected response.',
      status: response.status,
    });
  }

  return responseBody;
}

export async function apiRequest<TData>({
  path,
  method = 'GET',
  body,
  authenticated = false,
  parseData,
}: ApiRequestOptions<TData>): Promise<TData> {
  const envelope = await fetchApiEnvelope({ path, method, body, authenticated });

  return parseData(envelope?.data);
}

type QueryParamValue = string | number | boolean | null | undefined;

export function buildApiPath(path: string, params: Record<string, QueryParamValue> = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();

  return queryString ? `${path}?${queryString}` : path;
}

function isApiSuccessBody(value: unknown): value is ApiSuccessBody {
  return isObject(value) && value.success === true;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    isObject(value) &&
    value.success === false &&
    isObject(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  );
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function getOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export function getNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}
