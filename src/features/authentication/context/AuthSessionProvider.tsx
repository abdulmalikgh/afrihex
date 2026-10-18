import { router } from 'expo-router';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiRequestError } from '../../../api/client';
import {
  getCurrentUser,
  getUsageSummary,
  loginWithEmail,
  registerWithEmail,
  rotateApiKey,
  exchangeGoogleIdToken,
} from '../../../api/auth';
import {
  clearStoredAuthToken,
  clearStoredAuthUser,
  getStoredAuthToken,
  getStoredAuthUser,
  setStoredAuthToken,
  setStoredAuthUser,
} from '../../../storage/authToken';
import { googleWebClientId, googleIosClientId } from '../../../constants/googleAuth';
import type {
  AccountInfo,
  AfriHexUser,
  AuthSession as AfriHexAuthSession,
  UsageSummary,
} from '../types/auth';

type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

type EmailLoginInput = {
  email: string;
  password: string;
};

type EmailRegisterInput = EmailLoginInput & {
  name: string;
};

type AuthSessionContextValue = {
  status: AuthStatus;
  token: string | null;
  user: AfriHexUser | null;
  usage: UsageSummary | null;
  errorMessage: string | null;
  accountErrorMessage: string | null;
  isUserLoading: boolean;
  isSubmitting: boolean;
  login: (input: EmailLoginInput) => Promise<void>;
  register: (input: EmailRegisterInput) => Promise<void>;
  startGoogleSignIn: () => Promise<void>;
  clearError: () => void;
  logout: () => Promise<void>;
  /** Issues a new API key and revokes the old one. Signs out other devices. */
  rotateKey: () => Promise<void>;
  isRotatingKey: boolean;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadToken() {
      const storedToken = await getStoredAuthToken();
      const storedUser = await getStoredAuthUser();

      if (mounted) {
        if (storedUser) {
          queryClient.setQueryData(['auth', 'me'], storedUser);
        }

        setToken(storedToken);
        setLoaded(true);
      }
    }

    void loadToken();

    return () => {
      mounted = false;
    };
  }, [queryClient]);

  const userQuery = useQuery<AfriHexUser>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const accountInfo = await getCurrentUser();
      const cachedUser = queryClient.getQueryData<AfriHexUser>(['auth', 'me']);

      return mergeAccountInfo(cachedUser, accountInfo);
    },
    enabled: Boolean(token),
    retry: false,
  });

  const usageQuery = useQuery({
    queryKey: ['auth', 'usage'],
    queryFn: getUsageSummary,
    enabled: Boolean(token),
    retry: false,
  });

  const clearSession = useCallback(async () => {
    await clearStoredAuthToken();
    await clearStoredAuthUser();
    setToken(null);
    queryClient.removeQueries({ queryKey: ['auth'] });
  }, [queryClient]);

  const persistSession = useCallback(async (session: AfriHexAuthSession) => {
    await setStoredAuthToken(session.token);
    await setStoredAuthUser(session.user);
    setToken(session.token);
    queryClient.setQueryData(['auth', 'me'], session.user);
    setErrorMessage(null);
  }, [queryClient]);

  // `GoogleSignin.configure` is a global, must-run-once setup step. Calling it
  // on every provider mount would reset in-flight work on re-renders, so it is
  // guarded by a ref. On iOS the native SDK also needs the app's iOS OAuth
  // client id (`iosClientId`); without it (and without a Firebase
  // GoogleService-Info.plist) sign-in fails before a token is ever produced.
  const googleSignInConfigured = useRef(false);
  const googleSigninModule = useRef<typeof import('@react-native-google-signin/google-signin') | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadGoogleSignin() {
      try {
        const module = await import('@react-native-google-signin/google-signin');
        if (mounted && module) {
          googleSigninModule.current = module;
          if (!googleSignInConfigured.current) {
            googleSignInConfigured.current = true;
            try {
              module.GoogleSignin.configure(
                googleWebClientId || googleIosClientId
                  ? {
                      webClientId: googleWebClientId ?? undefined,
                      iosClientId: googleIosClientId ?? undefined,
                    }
                  : undefined,
              );
            } catch (configError) {
              console.warn('Failed to configure Google Sign-In:', configError);
            }
          }
        }
      } catch (error) {
        if (mounted) {
          // Silently ignore - module not available in this build/environment
          console.warn('Google Sign-In module not available:', error);
        }
      }
    }
    try {
      void loadGoogleSignin();
    } catch (error) {
      console.warn('Failed to load Google Sign-In:', error);
    }
    return () => {
      mounted = false;
    };
  }, []);

  const loginMutation = useMutation({
    mutationFn: loginWithEmail,
    onSuccess: persistSession,
    onError: (error) => {
      setErrorMessage(getErrorMessage(error));
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerWithEmail,
    onSuccess: persistSession,
    onError: (error) => {
      setErrorMessage(getErrorMessage(error));
    },
  });

  const googleIdTokenMutation = useMutation({
    mutationFn: exchangeGoogleIdToken,
    onSuccess: persistSession,
    onError: (error) => {
      setErrorMessage(getErrorMessage(error));
    },
  });

  /**
   * The response carries a full session, so it persists exactly like a sign-in.
   * That matters: the old key is dead the moment this returns, and leaving the
   * stored one in place would 401 the very next authenticated call.
   */
  const rotateKeyMutation = useMutation({
    mutationFn: rotateApiKey,
    onSuccess: persistSession,
    onError: (error) => {
      setErrorMessage(getErrorMessage(error));
    },
  });

  const rotateKey = useCallback(async () => {
    await rotateKeyMutation.mutateAsync();
  }, [rotateKeyMutation]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setErrorMessage(null);
  }, [clearSession]);

  useEffect(() => {
    if (!token || !isInvalidSessionError(userQuery.error)) {
      return;
    }

    void clearSession().then(() => {
      setErrorMessage('Your session expired. Please sign in again.');
    });
  }, [clearSession, token, userQuery.error]);

  useEffect(() => {
    if (userQuery.data) {
      void setStoredAuthUser(userQuery.data);
    }
  }, [userQuery.data]);

  const login = useCallback(
    async (input: EmailLoginInput) => {
      await loginMutation.mutateAsync(input);
    },
    [loginMutation],
  );

  const register = useCallback(
    async (input: EmailRegisterInput) => {
      await registerMutation.mutateAsync(input);
    },
    [registerMutation],
  );

  const startGoogleSignIn = useCallback(async () => {
    setErrorMessage(null);

    if (!googleSigninModule.current) {
      setErrorMessage('Google sign-in is not available in this build.');
      return;
    }

    const module = googleSigninModule.current;
    const { GoogleSignin, isCancelledResponse, statusCodes } = module;
    type SignInResponse = import('@react-native-google-signin/google-signin').SignInResponse;

    // Without a web client id the Android SDK returns no id_token and Google
    // rejects the exchange, so fail fast with something the user can act on.
    if (!googleWebClientId) {
      setErrorMessage('Google sign-in is not configured. Please try again later.');
      return;
    }

    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
    } catch {
      setErrorMessage('Google Play services are required to sign in with Google.');
      return;
    }

    let response: SignInResponse;
    try {
      response = await GoogleSignin.signIn();
    } catch (error) {
      setErrorMessage(googleSignInErrorMessage(error, statusCodes));
      return;
    }

    // Closing the account picker is a deliberate stop, not an error — exactly
    // like dismissing the old sign-in browser, nothing is surfaced.
    if (isCancelledResponse(response)) {
      return;
    }

    // `success` is the only branch left once cancellation is ruled out.
    const idToken = response.data.idToken;
    if (!idToken) {
      setErrorMessage('Google sign-in did not return an ID token.');
      return;
    }

    await googleIdTokenMutation.mutateAsync(idToken);
    router.replace('/account');
  }, [googleIdTokenMutation]);

  const status: AuthStatus = !loaded ? 'loading' : token ? 'authenticated' : 'anonymous';

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      status,
      token,
      user: userQuery.data ?? null,
      usage: usageQuery.data ?? null,
      errorMessage,
      accountErrorMessage: userQuery.error ? getErrorMessage(userQuery.error) : null,
      isUserLoading: Boolean(token) && userQuery.isPending,
      isSubmitting:
        loginMutation.isPending || registerMutation.isPending || googleIdTokenMutation.isPending,
      login,
      register,
      startGoogleSignIn,
      clearError,
      logout,
      rotateKey,
      isRotatingKey: rotateKeyMutation.isPending,
    }),
    [
      clearError,
      errorMessage,
      rotateKey,
      rotateKeyMutation.isPending,
      googleIdTokenMutation.isPending,
      login,
      loginMutation.isPending,
      logout,
      register,
      registerMutation.isPending,
      startGoogleSignIn,
      status,
      token,
      userQuery.error,
      userQuery.isPending,
      usageQuery.data,
      userQuery.data,
    ],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider.');
  }

  return context;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}

/**
 * Android's `DEVELOPER_ERROR`. The native module rejects with
 * `String.valueOf(CommonStatusCodes.DEVELOPER_ERROR)`, so the code arrives as a
 * string — comparing against the number 10 would never match.
 */
const googleDeveloperErrorCode = '10';

/**
 * Maps the native Google Sign-In error codes to user-facing copy. Everything
 * not explicitly recognised falls back to a safe generic message rather than
 * leaking a raw platform code.
 *
 * The symbolic codes are read off the module's own `statusCodes` rather than
 * hardcoded, because most of them are native constants whose literal values are
 * not part of the public contract.
 *
 * `DEVELOPER_ERROR` is called out on its own because it is the one failure no
 * user can act on and no retry can clear: it means this build's package name
 * plus signing-certificate fingerprint has no matching Android OAuth client in
 * the Google Cloud project, so every attempt fails identically. Folding it into
 * "try again" hid the only thing worth knowing.
 */
function googleSignInErrorMessage(
  error: unknown,
  statusCodes: typeof import('@react-native-google-signin/google-signin').statusCodes,
): string {
  if (!(typeof error === 'object' && error !== null && 'code' in error)) {
    return 'Google sign-in failed. Please try again.';
  }

  switch ((error as { code: unknown }).code) {
    case googleDeveloperErrorCode:
      return 'This build is not registered for Google sign-in. Its Android OAuth client is missing or its signing certificate does not match.';
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return 'Google Play services are required to sign in with Google.';
    case statusCodes.IN_PROGRESS:
      return 'A Google sign-in is already in progress.';
    case statusCodes.NULL_PRESENTER:
      return 'Google sign-in is not set up for this build.';
    case statusCodes.SIGN_IN_REQUIRED:
      return 'Please sign in to continue.';
    default:
      return 'Google sign-in failed. Please try again.';
  }
}

function mergeAccountInfo(baseUser: AfriHexUser | undefined, accountInfo: AccountInfo): AfriHexUser {
  if (!baseUser) {
    return buildUserFromAccountInfo(accountInfo);
  }

  return {
    ...baseUser,
    ...accountInfo,
    plan: accountInfo.plan ?? baseUser.plan,
    daily_limit: accountInfo.daily_limit ?? baseUser.daily_limit,
    usage_today: accountInfo.usage_today ?? baseUser.usage_today,
    expires_at: accountInfo.expires_at ?? baseUser.expires_at,
  };
}

/**
 * Builds a user from `/v2/me` alone, for the case where a token survived but the
 * cached user did not — a reinstall, a cleared read, a storage migration.
 *
 * `/v2/me` returns a narrower object than login does: no `id`, no `usage_today`,
 * and the plan arrives as `tier`. Requiring those two made this throw on every
 * valid response, which presented to the user as "Sign in again" on an account
 * that was perfectly fine. Only what the endpoint actually guarantees is required
 * now; the rest falls back.
 */
function buildUserFromAccountInfo(accountInfo: AccountInfo): AfriHexUser {
  if (
    typeof accountInfo.name !== 'string' ||
    typeof accountInfo.email !== 'string' ||
    typeof accountInfo.plan !== 'string' ||
    typeof accountInfo.daily_limit !== 'number'
  ) {
    throw new Error('Sign in again to refresh your account details.');
  }

  return {
    id: accountInfo.id ?? 0,
    name: accountInfo.name,
    email: accountInfo.email,
    plan: accountInfo.plan,
    daily_limit: accountInfo.daily_limit,
    usage_today: accountInfo.usage_today ?? 0,
    expires_at: accountInfo.expires_at ?? null,
    ...(accountInfo.api_key ? { api_key: accountInfo.api_key } : {}),
    ...(accountInfo.key_prefix ? { key_prefix: accountInfo.key_prefix } : {}),
    ...(typeof accountInfo.is_admin === 'boolean' ? { is_admin: accountInfo.is_admin } : {}),
  };
}

/**
 * True when the server has told us this API key is no good — expired, revoked, or
 * never valid. Exported so callers outside the auth flow (route planning) can
 * distinguish a dead session from a genuine request failure.
 */
export function isInvalidSessionError(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) {
    return false;
  }

  // Deliberately narrow. `KEY_EXPIRED` is the *subscription* side, and both docs
  // are explicit: "A lapsed subscription keeps the user authenticated (tier
  // degrades to free) so they can renew — never force-logout". `MISSING_API_KEY`
  // means this client sent no key at all, which is a local race, not a server
  // rejection. Only a genuinely rejected credential ends the session.
  return error.status === 401 || error.code === 'INVALID_API_KEY';
}
