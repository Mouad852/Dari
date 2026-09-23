import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';

import { color } from '@/theme/tokens';
import { configErrors } from '@/lib/config';
import { startErrorReporting } from '@/lib/reporting';

// Before anything renders, so a crash during startup is reported too. Does
// nothing without EXPO_PUBLIC_SENTRY_DSN.
startErrorReporting();

// Held up until the brand typefaces are ready -- the type scale (h1/h2/price
// etc.) is a defined visual identity, not a fallback-tolerant detail, so a
// flash of the system font on every cold start would be a real regression,
// not a cosmetic one.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const url = Linking.useURL();
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

  useEffect(() => { if (url) routeDeepLink(url); }, [url]);

  if (!fontsLoaded && !fontError) return null;

  const configurationErrors = configErrors();
  if (configurationErrors.length > 0) return <SafeAreaProvider><View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: color.bgPage }}><Text style={{ color: color.textHeading, fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Configuration requise</Text>{configurationErrors.map((message) => <Text key={message} style={{ color: color.danger, marginBottom: 6 }}>{message}</Text>)}<Text style={{ color: color.textMuted, marginTop: 12 }}>Copiez .env.example vers .env, renseignez les valeurs puis redémarrez Expo.</Text></View></SafeAreaProvider>;

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

function routeDeepLink(value: string): void {
  try {
    const parsed = Linking.parse(value);
    const pathSegments = parsed.path?.replace(/^\/+/, '').split('/').filter(Boolean) ?? [];
    const segments = ['listing', 'conversation', 'messages', 'account-recovery'].includes(parsed.hostname ?? '')
      ? [parsed.hostname, ...pathSegments]
      : pathSegments;
    const [kind, id] = segments;
    if (kind === 'listing' && id) router.push({ pathname: '/listing/[id]', params: { id } });
    else if ((kind === 'conversation' || kind === 'messages') && id) router.push({ pathname: '/messages/[id]', params: { id } });
    else if (kind === 'account-recovery') router.push('/sign-in');
  } catch {
    // Malformed external URLs are ignored; the app remains on its current route.
  }
}
