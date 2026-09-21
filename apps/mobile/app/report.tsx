import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { TopBar } from '@/components/TopBar';
import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { color, font, layout, radius, type } from '@/theme/tokens';
import type { ReportReason, ReportTargetType } from '@/types/api';

const REASONS: Array<[ReportReason, string]> = [
  ['FAKE_LISTING', 'Annonce fausse'], ['MISLEADING_PRICE', 'Prix trompeur'], ['UNAUTHORISED_BROKER', 'Courtier non autorisé'],
  ['INAPPROPRIATE_BEHAVIOR', 'Comportement inapproprié'], ['DISCRIMINATION', 'Discrimination'], ['SUSPECTED_SCAM', 'Arnaque suspectée'], ['OTHER', 'Autre'],
];

export default function ReportScreen() {
  const params = useLocalSearchParams<{ targetType: string; targetId: string; label?: string }>();
  const targetType = (params.targetType === 'USER' ? 'USER' : 'LISTING') as ReportTargetType;
  const targetId = Array.isArray(params.targetId) ? params.targetId[0] : params.targetId;
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const title = useMemo(() => targetType === 'LISTING' ? 'Signaler cette annonce' : 'Signaler cet utilisateur', [targetType]);

  async function submit() {
    const token = await getIdToken();
    if (!token) { router.replace('/sign-in'); return; }
    if (!reason) { setError('Choisissez une raison.'); return; }
    setSubmitting(true); setError(null);
    try { await apiFetch('/reports', { method: 'POST', token, body: { targetType, targetId, reason, details: details.trim() || null } }); setSubmitted(true); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Le signalement n’a pas pu être envoyé.'); }
    finally { setSubmitting(false); }
  }

  if (submitted) return <View style={styles.screen}><TopBar title="Signalement" onBack={() => router.back()} /><View style={styles.center}><Text style={type.h2}>Signalement reçu</Text><Text style={[type.body, styles.centerText]}>Merci. Notre équipe examinera ce signalement.</Text><Button onPress={() => router.back()}>Terminer</Button></View></View>;
  return <View style={styles.screen}><TopBar title="Signalement" onBack={() => router.back()} /><ScrollView contentContainerStyle={styles.content}>
    <Text style={type.h1}>{title}</Text><Text style={[type.bodySm, { color: color.textMuted }]}>Votre signalement reste confidentiel. Ne partagez pas d’informations personnelles dans le détail.</Text>
    <Text style={styles.label}>Raison</Text><View style={styles.reasons}>{REASONS.map(([value, label]) => <Pressable key={value} onPress={() => setReason(value)} accessibilityRole="radio" accessibilityState={{ selected: reason === value }} style={[styles.reason, reason === value && styles.reasonSelected]}><Text style={[type.bodySm, reason === value && { color: color.brandPress, fontFamily: font.uiSemibold }]}>{label}</Text></Pressable>)}</View>
    <Text style={styles.label}>Détail (facultatif)</Text><TextInput value={details} onChangeText={setDetails} maxLength={2000} multiline numberOfLines={6} placeholder="Expliquez brièvement le problème" placeholderTextColor={color.textMuted} style={styles.input} />
    {error && <Text style={[type.bodySm, styles.error]} accessibilityLiveRegion="assertive">{error}</Text>}
    <Button onPress={() => void submit()} loading={submitting}>{submitting ? 'Envoi…' : 'Envoyer le signalement'}</Button>
  </ScrollView></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: color.bgPage }, content: { padding: layout.gutterMobile, gap: 16 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: layout.gutterMobile }, centerText: { textAlign: 'center' }, label: { fontFamily: font.uiSemibold, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: color.textMuted }, reasons: { gap: 8 }, reason: { padding: 14, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.md, backgroundColor: color.surfaceCard }, reasonSelected: { borderColor: color.brand, backgroundColor: color.brandSubtle }, input: { minHeight: 120, borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.md, backgroundColor: color.surfaceCard, color: color.textHeading, padding: 14, fontFamily: font.uiRegular, fontSize: 15, textAlignVertical: 'top' }, error: { color: color.danger },
});
