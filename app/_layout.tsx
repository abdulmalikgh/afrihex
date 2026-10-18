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
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '../src/constants/colors';
import { AuthSessionProvider } from '../src/features/authentication/context/AuthSessionProvider';

/**
 * Registers the navigation background task.
 *
 * Imported for its side effect and never referenced: `defineTask` has to run at
 * module scope for the task to exist when the OS relaunches the app into it, and
 * nothing in the React tree can guarantee that timing. Starting the updates is
 * what `useTurnByTurn` does; this import is only what makes the task real.
 */
import '../src/features/navigation/background/locationTask';

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

/**
 * Renders when any screen under the root boundary throws during render.
 *
 * The SDK's default fallback is `null`, so a caught error looks identical to a
 * hang — a totally blank app. Showing the message (and the Sentry event ID,
 * which finds the exact event later even if the upload was delayed) turns a
 * silent blank screen into something a user can report.
 *
 * Deliberately system-font only: custom fonts load inside the tree below this
 * boundary, so depending on them here could fail for the same reason the app
 * errored.
 */
function StartupErrorScreen({
  error,
  eventId,
}: {
  error?: unknown;
  componentStack?: string;
  resetError?: () => void;
  eventId?: string | null;
}) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  return (
    <View style={styles.errorScreen} accessibilityRole="alert">
      <Text style={styles.errorHeading}>Something went wrong</Text>
      <Text style={styles.errorBody} selectable>
        {message}
      </Text>
      {eventId ? <Text style={styles.errorEvent}>Sentry event ID: {eventId}</Text> : null}
    </View>
  );
}

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

// `Sentry.wrap` only layers on touch-event, profiling and feedback providers —
// it installs no error boundary, so a render error anywhere in the root tree
// unmounts everything and leaves a blank screen. The explicit `ErrorBoundary`
// here turns that silence into a visible report: it captures the exception to
// Sentry and shows the fallback (including the event ID) instead of nothing.
function App() {
  return (
    <Sentry.ErrorBoundary fallback={StartupErrorScreen}>
      <RootLayout />
    </Sentry.ErrorBoundary>
  );
}

export default Sentry.wrap(App);

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.surface,
  },
  errorHeading: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  errorBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  errorEvent: {
    color: colors.faint,
    fontSize: 12,
    marginTop: 16,
  },
});
