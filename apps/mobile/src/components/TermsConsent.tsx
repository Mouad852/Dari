import { StyleSheet, Text, View } from 'react-native';

import { LegalLinks } from '@/components/LegalLinks';
import { color, type } from '@/theme/tokens';

/**
 * The consent sentence next to the button that creates the account or the
 * profile (owner decision P1-15). The two texts follow as LegalLinks' own
 * buttons rather than as links nested in the sentence: Android's screen
 * reader cannot focus a link inside a Text.
 */
export function TermsConsent({ lead }: { lead: string }) {
  return (
    <View style={styles.block}>
      <Text style={[type.bodySm, styles.text]}>
        {lead}, vous acceptez les Conditions d’utilisation et la Politique de confidentialité de Dari.
      </Text>
      <LegalLinks />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  text: { color: color.textMuted, textAlign: 'center' },
});
