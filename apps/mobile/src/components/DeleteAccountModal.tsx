import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { color, layout, radius, type } from '@/theme/tokens';

const CONFIRMATION = 'SUPPRIMER';

/**
 * The account-deletion confirmation, identical on iOS and Android.
 *
 * It replaces an Alert chain in which iOS asked for the typed word through
 * Alert.prompt (an iOS-only API) and Android deleted on a single tap. The
 * field takes focus when the dialog opens, deletion stays disabled until the
 * word is typed, and the Android back button cancels unless a deletion is in
 * flight.
 */
export function DeleteAccountModal({ visible, busy, error, onCancel, onConfirm }: {
  visible: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState('');
  useEffect(() => { if (!visible) setTyped(''); }, [visible]);
  const confirmed = typed.trim() === CONFIRMATION;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { if (!busy) onCancel(); }}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text style={type.h2} accessibilityRole="header">Supprimer le compte ?</Text>
          <Text style={type.body}>
            Cette action est définitive et retirera vos annonces. Vos conversations seront conservées pour les autres participants.
          </Text>
          <TextField
            label={`Tapez ${CONFIRMATION} pour confirmer`}
            accessibilityLabel={`Tapez ${CONFIRMATION} pour confirmer la suppression`}
            value={typed}
            onChangeText={setTyped}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
          />
          {error && <Text style={[type.bodySm, styles.error]} accessibilityLiveRegion="assertive">{error}</Text>}
          <Button onPress={onConfirm} disabled={!confirmed} loading={busy}>Supprimer définitivement</Button>
          <Button variant="secondary" onPress={onCancel} disabled={busy}>Annuler</Button>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: layout.gutterMobile, backgroundColor: color.surfaceScrim },
  dialog: { gap: 14, backgroundColor: color.surfaceCard, borderRadius: radius.card, padding: 20 },
  error: { color: color.danger },
});
