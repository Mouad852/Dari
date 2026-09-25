import { createUserWithEmailAndPassword } from '@firebase/auth';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, TextButton } from '@/components/Button';
import { LegalLinks } from '@/components/LegalLinks';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { getFirebaseAuth } from '@/lib/firebase';
import { sendVerificationEmail } from '@/lib/profile';
import { color, font, layout, radius, ramp, type } from '@/theme/tokens';

/** Ported from apps/web/src/app/sign-up/page.tsx -- same fields. The backend profile is created on profile-recovery once the email is verified. */
export default function SignUpScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      // The API creates the profile only for a verified email, which a new
      // account never has yet: send the link, then finish on profile-recovery.
      await sendVerificationEmail(credential.user).catch(() => {});
      router.replace({
        pathname: '/profile-recovery',
        params: { displayName: `${firstName.trim()} ${lastName.trim()}`.trim(), firstName: firstName.trim(), city: city.trim() },
      });
    } catch (cause) {
      if (cause instanceof Error && cause.message.includes('email-already-in-use')) {
        setError('Cette adresse e-mail est déjà utilisée.');
      } else {
        setError('Inscription impossible. Vérifiez vos informations et réessayez.');
      }
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
            <Text style={styles.badgeText}>Créer un compte</Text>
          </View>
          <Text style={[type.h2, styles.title]}>Bienvenue chez Dari</Text>
          <Text style={[type.bodySm, styles.subtitle]}>
            Créez votre profil et trouvez une colocation qui correspond à votre quotidien.
          </Text>

          <View style={styles.row}>
            <View style={styles.half}>
              <TextField label="Prénom" value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
            </View>
            <View style={styles.half}>
              <TextField label="Nom" value={lastName} onChangeText={setLastName} autoComplete="family-name" />
            </View>
          </View>
          <TextField label="Ville (facultatif)" value={city} onChangeText={setCity} placeholder="Rabat" autoComplete="postal-address-locality" />
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
            placeholder="6 caractères minimum"
            autoComplete="password-new"
            textContentType="newPassword"
            secureEntry
          />

          <View style={styles.secured}>
            <Icon name="check-circle-2" size={16} color={ramp.clay700} />
            <Text style={[type.bodySm, { color: ramp.clay700 }]}>Votre identité est sécurisée par Firebase.</Text>
          </View>

          {error && (
            <Text style={[type.bodySm, styles.error]} accessibilityLiveRegion="assertive">
              {error}
            </Text>
          )}

          <Button onPress={handleSubmit} loading={submitting} iconRight="arrow-right">
            {submitting ? 'Création…' : 'Créer mon compte'}
          </Button>

          <View style={styles.footer}>
            <Text style={[type.bodySm, { color: color.textMuted }]}>Vous avez déjà un compte ? </Text>
            <TextButton onPress={() => router.push('/sign-in')}>Se connecter</TextButton>
          </View>

          <LegalLinks />
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
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  secured: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: color.brandSubtle,
    borderWidth: 1,
    borderColor: color.brandBorder,
    borderRadius: radius.cardInner,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  error: { color: color.danger },
  footer: { flexDirection: 'row', justifyContent: 'center' },
});
