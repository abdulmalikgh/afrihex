import { getStoredAuthToken } from '../storage/authToken';

export const API_BASE_URL = 'https://api.afrihex.com';
export const AUTH_HEADER = 'X-API-Key';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ApiMeta = {
  request_id?: string;
  cached?: boolean;
  latency?: number;
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

export async function apiRequest<TData>({
  path,
  method = 'GET',
  body,
  authenticated = false,
  parseData,
}: ApiRequestOptions<TData>): Promise<TData> {
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
  const responseBody: unknown = responseText ? JSON.parse(responseText) : undefined;

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

  if (!isApiSuccessBody(responseBody)) {
    if (response.ok && responseBody === undefined) {
      return parseData(undefined);
    }

    throw new ApiRequestError({
      code: 'INVALID_RESPONSE',
      message: 'The server returned an unexpected response.',
      status: response.status,
    });
  }

  return parseData(responseBody.data);
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
