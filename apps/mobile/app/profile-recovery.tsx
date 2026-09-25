import type { User } from '@firebase/auth';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, TextButton } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { ApiError, errorMessage } from '@/lib/api';
import { onAuthChange, signOut } from '@/lib/firebase';
import { completeProfile, PROFILE_FIELDS_REQUIRED, sendVerificationEmail } from '@/lib/profile';
import { color, font, layout, radius, ramp, type } from '@/theme/tokens';

/**
 * Ported from apps/web/src/app/profile-recovery/page.tsx: a signed-in Firebase
 * account with no Dari profile finishes it here. Reached after sign-up (the
 * API needs a verified email first), from sign-in or the profile tab when the
 * profile is missing, and from the web's `profile-recovery` link. Without a
 * Firebase session it goes to sign-in.
 */
export default function ProfileRecoveryScreen() {
  const params = useLocalSearchParams<{ displayName?: string; firstName?: string; city?: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState(params.displayName ?? '');
  const [firstName, setFirstName] = useState(params.firstName ?? '');
  const [city, setCity] = useState(params.city ?? '');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => onAuthChange((current) => {
    if (!current) {
      router.replace('/sign-in');
      return;
    }
    setUser(current);
    setPendingVerification(!current.emailVerified);
  }), []);

  async function resend() {
    if (!user) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await sendVerificationEmail(user);
      setStatus('E-mail de vérification envoyé.');
    } catch {
      setError('Impossible d’envoyer l’e-mail pour le moment. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!user) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await completeProfile(user, { displayName, firstName, city });
      router.replace('/');
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (cause.code === 'IDENTITY_EMAIL_UNVERIFIED') setPendingVerification(true);
        setError(cause.message);
      } else if (cause instanceof Error && cause.message === PROFILE_FIELDS_REQUIRED) {
        setError(PROFILE_FIELDS_REQUIRED);
      } else {
        setError(errorMessage(cause, 'Le profil n’a pas pu être créé. Réessayez.'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.badge}>
            <Icon name="shield-check" size={14} color={ramp.clay700} />
            <Text style={styles.badgeText}>Profil Dari</Text>
          </View>
          <Text style={[type.h2, styles.title]} accessibilityRole="header">Finaliser votre profil</Text>
          <Text style={[type.bodySm, styles.subtitle]}>
            {user?.email ? `Compte : ${user.email}` : 'Récupération de votre profil Dari.'}
          </Text>

          {pendingVerification && (
            <View style={styles.notice} accessibilityRole="summary">
              <Text style={[type.bodySm, styles.noticeTitle]}>Votre e-mail doit être confirmé</Text>
              <Text style={[type.bodySm, { color: ramp.clay700 }]}>
                Ouvrez le message de vérification, puis revenez ici pour créer votre profil.
              </Text>
              <Button variant="secondary" onPress={resend} disabled={busy}>Renvoyer l’e-mail</Button>
            </View>
          )}

          <TextField label="Nom d’affichage" value={displayName} onChangeText={setDisplayName} autoComplete="name" />
          <TextField label="Prénom" value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
          <TextField label="Ville (facultatif)" value={city} onChangeText={setCity} placeholder="Rabat" autoComplete="postal-address-locality" />

          {status && (
            <Text style={[type.bodySm, { color: ramp.clay700 }]} accessibilityLiveRegion="polite">{status}</Text>
          )}
          {error && (
            <Text style={[type.bodySm, styles.error]} accessibilityLiveRegion="assertive">{error}</Text>
          )}

          <Button onPress={create} loading={busy} disabled={!user} iconRight="arrow-right">
            {busy ? 'Vérification…' : 'Créer mon profil'}
          </Button>

          <View style={styles.footer}>
            <TextButton onPress={() => void signOut()}>Utiliser un autre compte</TextButton>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bgPage },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: layout.gutterMobile },
  card: {
    width: '100%',
    maxWidth: 560,
    gap: 16,
    backgroundColor: color.surfaceCard,
    borderWidth: 1,
    borderColor: color.borderHairline,
    borderRadius: radius.card,
    padding: 20,
  },
  badge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    backgroundColor: color.brandSubtle,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  badgeText: { fontFamily: font.uiSemibold, fontSize: 13, color: ramp.clay700 },
  title: { marginTop: -4 },
  subtitle: { color: color.textMuted, marginTop: -8 },
  notice: {
    gap: 10,
    backgroundColor: color.brandSubtle,
    borderWidth: 1,
    borderColor: color.brandBorder,
    borderRadius: radius.cardInner,
    padding: 14,
  },
  noticeTitle: { fontFamily: font.uiSemibold, color: ramp.clay700 },
  error: { color: color.danger },
  footer: { flexDirection: 'row', justifyContent: 'center' },
});
