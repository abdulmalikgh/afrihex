import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular';
import { InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans/500Medium';
import { InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans/600SemiBold';
import { InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans/700Bold';
import { SplineSansMono_500Medium } from '@expo-google-fonts/spline-sans-mono/500Medium';
import { SplineSansMono_600SemiBold } from '@expo-google-fonts/spline-sans-mono/600SemiBold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '../src/constants/colors';
import { AuthSessionProvider } from '../src/features/authentication/context/AuthSessionProvider';

// Initialised at module scope, before any component renders, so a failure
// during the first render is still reported. Anything that throws earlier than
// this — a module that fails to resolve while the bundle is evaluating, or a
// native crash during startup — happens before the handlers are installed and
// will not be captured.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (!dsn) {
  // Deliberately not thrown. A missing DSN means no reporting, which is bad,
  // but throwing here would crash the app on launch — the exact failure being
  // investigated.
  console.warn('EXPO_PUBLIC_SENTRY_DSN is unset; Sentry will not report anything.');
}

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  // Marks whether a launch ended in a crash, which is how a crash-on-launch
  // shows up as a signal rather than just silence.
  enableAutoSessionTracking: true,
  attachStacktrace: true,
  // A crash kills the process before an event can upload, so the native
  // handlers persist it to disk and send it on the *next* launch. The app has
  // to be opened a second time for a crash report to arrive.
  enableNativeCrashHandling: true,
  enableNdkScopeSync: true,
});

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    SplineSansMono_500Medium,
    SplineSansMono_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (fontError) {
    throw fontError;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthSessionProvider>
          <SafeAreaProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                headerShadowVisible: false,
                // Chevron only. The default label is the previous route's name,
                // which surfaces router internals — a screen pushed from the tab
                // bar reads "(tabs)". Set here rather than per screen so no
                // future route can reintroduce it.
                headerBackButtonDisplayMode: 'minimal',
                // No native header anywhere by default. It renders a full-height
                // bar containing nothing but a chevron — the app's pattern is a
                // compact inline back control and content that starts at the top,
                // the way the tab screens look. A screen that needs a real bar
                // turns it back on, as the auth callback modal does.
                headerShown: false,
                title: '',
                contentStyle: { backgroundColor: colors.surface },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="auth/login" options={{ headerShown: false }} />
              <Stack.Screen name="auth/register" options={{ headerShown: false }} />
              <Stack.Screen name="auth/forgot-password" options={{ headerShown: false }} />
              <Stack.Screen name="auth/reset-password" options={{ headerShown: false }} />
              <Stack.Screen
                name="auth/callback"
                options={{ title: 'Signing in', presentation: 'modal', headerShown: true }}
              />
              <Stack.Screen name="account/change-password" options={{ headerShown: false }} />
              {/* Draws its own back button and heading, matching the Verify tab
                  it is pushed from — a native bar above that heading would title
                  the same screen twice. */}
              <Stack.Screen name="certificate/[id]" options={{ headerShown: false }} />
            </Stack>
          </SafeAreaProvider>
        </AuthSessionProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

// Wraps the root in Sentry's error boundary and touches up the React component
// stacks on reported events.
export default Sentry.wrap(RootLayout);
