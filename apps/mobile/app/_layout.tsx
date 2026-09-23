import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { color, layout, type } from '@/theme/tokens';
import { configErrors } from '@/lib/config';
import { reportError, startErrorReporting } from '@/lib/reporting';

// Before anything renders, so a crash during startup is reported too. Does
// nothing without EXPO_PUBLIC_SENTRY_DSN.
startErrorReporting();

// Held up until the brand typefaces are ready -- the type scale (h1/h2/price
// etc.) is a defined visual identity, not a fallback-tolerant detail, so a
// flash of the system font on every cold start would be a real regression,
// not a cosmetic one.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    IBMPlexMono_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const configurationErrors = configErrors();
  // The variable names and the .env instruction are for a developer; a release
  // build (which the build gate should never let get here) says only what a user can do.
  if (configurationErrors.length > 0) return <SafeAreaProvider><View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: color.bgPage }}><Text style={{ color: color.textHeading, fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Configuration requise</Text>{__DEV__ ? <>{configurationErrors.map((message) => <Text key={message} style={{ color: color.danger, marginBottom: 6 }}>{message}</Text>)}<Text style={{ color: color.textMuted, marginTop: 12 }}>Copiez .env.example vers .env, renseignez les valeurs puis redémarrez Expo.</Text></> : <Text style={{ color: color.textBody }}>Cette version de l’application est incomplète. Mettez-la à jour depuis le store.</Text>}</View></SafeAreaProvider>;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {/*
        headerShown: false everywhere -- every screen in the mobile UI kit
        (AppShell.jsx's TopBar) draws its own header to match the web app's
        SiteNav treatment (brand-tokened background, custom back/action
        slots), not the platform-default native header.
      */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bgPage } }} />
    </SafeAreaProvider>
  );
}

/**
 * The whole-app fallback for a render error anywhere below this layout.
 *
 * expo-router renders it in place of the route that threw (a route without an
 * ErrorBoundary of its own passes the error up to this one), so a single
 * unexpected value can no longer white-screen the app. `retry` re-renders the
 * route. Reported once per error, without its message (see reportScrub.ts).
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { reportError(error, { kind: 'render' }); }, [error]);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.crash}>
        <Text style={type.h2} accessibilityRole="header">Un problème est survenu</Text>
        <Text style={[type.body, styles.crashText]}>Cet écran n’a pas pu s’afficher. Réessayez ; si le problème continue, fermez puis rouvrez l’application.</Text>
        <Button onPress={() => void retry()}>Réessayer</Button>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  crash: { flex: 1, justifyContent: 'center', gap: 16, padding: layout.gutterMobile, backgroundColor: color.bgPage },
  crashText: { color: color.textBody },
});
