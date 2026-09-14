import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TopBar } from '@/components/TopBar';
import { apiFetch } from '@/lib/api';
import { getIdToken, onAuthChange, signOut } from '@/lib/firebase';
import type { Me } from '@/types/api';
import { color, layout, type } from '@/theme/tokens';

/**
 * Auth-aware, same pattern as the web app's `/account`: a signed-out
 * visitor sees a real sign-in/sign-up prompt rather than a redirect, and
 * `onAuthChange` (not a one-shot `getIdToken()` check) keeps this screen
 * correct across a sign-in/out that happens elsewhere -- the exact stale-
 * state bug fixed on the web app's `SiteNav` this same session, avoided
 * here from the start rather than found later.
 */
export default function ProfileScreen() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => onAuthChange((user) => setSignedIn(Boolean(user))), []);

  useEffect(() => {
    if (!signedIn) {
      setMe(null);
      return;
    }
    let isCurrent = true;
    (async () => {
      const token = await getIdToken();
      if (!token) return;
      try {
        const profile = await apiFetch<Me>('/users/me', { token });
        if (isCurrent) setMe(profile);
      } catch {
        // A stale/failed fetch just leaves the screen showing nothing extra
        // yet -- not worth its own error state for a first pass.
      }
    })();
    return () => {
      isCurrent = false;
    };
  }, [signedIn]);

  if (signedIn === false) {
    return (
      <View style={styles.screen}>
        <TopBar title="Profil" />
        <View style={styles.body}>
          <Text style={[type.body, styles.prompt]}>Connectez-vous pour gérer votre compte, vos annonces et vos favoris.</Text>
          <View style={styles.actions}>
            <Button onPress={() => router.push('/sign-in')}>Se connecter</Button>
            <Button variant="secondary" onPress={() => router.push('/sign-up')}>
              Créer un compte
            </Button>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TopBar title="Profil" />
      <View style={styles.body}>
        {me ? (
          <>
            <Text style={type.h2}>{me.displayName}</Text>
            <Text style={[type.bodySm, { color: color.textMuted }]}>{me.email}</Text>
            <View style={styles.actions}>
              <Button variant="secondary" onPress={() => void signOut()}>
                Se déconnecter
              </Button>
            </View>
          </>
        ) : (
          <Text style={type.body}>Chargement…</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bgPage },
  body: { flex: 1, padding: layout.gutterMobile, gap: 16, justifyContent: 'center' },
  prompt: { textAlign: 'center' },
  actions: { gap: 12, marginTop: 8 },
});
