import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

import { ErrorBanner, LoadingState, Screen } from '../../../components';
import { useAuthSession } from '../context/AuthSessionProvider';

export function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const { exchangeGoogleCallbackCode, errorMessage } = useAuthSession();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current || !params.code) {
      return;
    }

    handledRef.current = true;

    async function exchangeCode(code: string) {
      await exchangeGoogleCallbackCode(code);
      router.replace('/account');
    }

    void exchangeCode(params.code);
  }, [exchangeGoogleCallbackCode, params.code]);

  if (params.error) {
    return (
      <Screen>
        <ErrorBanner message={params.error} />
      </Screen>
    );
  }

  if (errorMessage) {
    return (
      <Screen>
        <ErrorBanner message={errorMessage} />
      </Screen>
    );
  }

  return <LoadingState label="Completing Google sign-in" />;
}
