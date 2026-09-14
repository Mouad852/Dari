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
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { color } from '@/theme/tokens';

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
