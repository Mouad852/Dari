import { signInWithEmailAndPassword } from '@firebase/auth';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, TextButton } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { getFirebaseAuth, sendPasswordReset } from '@/lib/firebase';
import { hasProfile } from '@/lib/profile';
import { color, font, layout, radius, ramp, type } from '@/theme/tokens';

/**
 * Ported from apps/web/src/app/sign-in/page.tsx -- same copy, same fields,
 * same forgot-password behaviour (deliberately reports success even for
 * `auth/user-not-found`, to avoid an account-enumeration leak; see the web
 * page's own comment for the full reasoning). No mockup exists for this
 * screen in `ui_kits/mobile_app/` -- the plan doc's "Known gaps" note says
 * as much -- so the layout follows the same card-on-gradient-background
 * shape the web version uses, in RN primitives.
 */
export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('Entrez votre e-mail ci-dessus pour recevoir un lien de réinitialisation.');
      return;
    }
    setError(null);
    setResetStatus('sending');
    try {
      await sendPasswordReset(email.trim());
      setResetStatus('sent');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (message.includes('user-not-found')) {
        setResetStatus('sent');
      } else if (message.includes('invalid-email')) {
        setResetStatus('idle');
        setError('Adresse e-mail invalide.');
      } else {
        setResetStatus('idle');
        setError('Impossible d’envoyer l’e-mail pour le moment. Réessayez.');
      }
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      router.replace((await hasProfile()) ? '/' : '/profile-recovery');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(
        message.includes('invalid-credential') || message.includes('user-not-found')
          ? 'E-mail ou mot de passe incorrect.'
          : 'Connexion impossible. Réessayez dans un instant.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.badge}>
            <Icon name="shield-check" size={14} color={ramp.clay700} />
            <Text style={styles.badgeText}>Connectez-vous</Text>
          </View>
          <Text style={[type.h2, styles.title]}>Bon retour</Text>
          <Text style={[type.bodySm, styles.subtitle]}>
            Accédez à votre compte et continuez votre recherche de colocation.
          </Text>

          <TextField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="vous@dari.ma"
            autoComplete="email"
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
          />
          <TextField
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="Votre mot de passe"
            autoComplete="current-password"
            textContentType="password"
            secureEntry
          />

          <View style={styles.forgotRow}>
            <TextButton onPress={handleForgotPassword} disabled={resetStatus === 'sending'}>
              Mot de passe oublié ?
            </TextButton>
          </View>

          {resetStatus === 'sent' && (
            <Text style={[type.bodySm, styles.status]} accessibilityLiveRegion="polite">
              Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être envoyé.
            </Text>
          )}
          {error && (
            <Text style={[type.bodySm, styles.error]} accessibilityLiveRegion="assertive">
              {error}
            </Text>
          )}

          <Button onPress={handleSubmit} loading={submitting} iconRight="arrow-right">
            {submitting ? 'Connexion…' : 'Se connecter'}
          </Button>

          <View style={styles.footer}>
            <Text style={[type.bodySm, { color: color.textMuted }]}>Pas encore de compte ? </Text>
            <TextButton onPress={() => router.push('/sign-up')}>Créer un compte</TextButton>
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
    maxWidth: 480,
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
  forgotRow: { alignItems: 'flex-end', marginTop: -8 },
  status: { color: color.textHeading },
  error: { color: color.danger },
  footer: { flexDirection: 'row', justifyContent: 'center' },
});
