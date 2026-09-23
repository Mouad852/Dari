import { Linking, StyleSheet, View } from 'react-native';

import { TextButton } from '@/components/Button';
import { SITE_URL } from '@/lib/config';
import { reportError } from '@/lib/reporting';

/**
 * The terms and the privacy notice, on the web app's own /legal pages: one
 * reviewed text for both clients rather than a copy in the app. Both stores
 * require the privacy notice to be reachable, and Apple requires it inside
 * account-bearing apps.
 */
const PAGES = [
  { path: '/legal/terms', label: 'Conditions d’utilisation' },
  { path: '/legal/privacy', label: 'Politique de confidentialité' },
] as const;

export function LegalLinks() {
  if (!SITE_URL) return null;
  const open = (path: string) => {
    Linking.openURL(`${SITE_URL}${path}`).catch((cause: unknown) => reportError(cause, { kind: 'legal-link' }));
  };
  return (
    <View style={styles.row}>
      {PAGES.map((page) => (
        <TextButton key={page.path} role="link" hint="Ouvre la page dans le navigateur" onPress={() => open(page.path)}>
          {page.label}
        </TextButton>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 20, rowGap: 8 },
});
