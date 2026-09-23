import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, TextButton } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { TopBar } from '@/components/TopBar';
import { apiFetch, apiOrigin, apiUpload, errorMessage } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import type { CreateListingRequest, ListingDetail, ListingPhoto } from '@/types/api';
import { color, font, layout, radius, type } from '@/theme/tokens';

type Form = { title: string; city: string; neighborhood: string; latitude: string; longitude: string; priceRent: string; description: string; availableFrom: string; minStayMonths: string };
const EMPTY: Form = { title: '', city: '', neighborhood: '', latitude: '', longitude: '', priceRent: '', description: '', availableFrom: '', minStayMonths: '1' };

export default function PublishScreen() {
  const params = useLocalSearchParams<{ listing?: string }>();
  const listingId = Array.isArray(params.listing) ? params.listing[0] : params.listing;
  const [form, setForm] = useState<Form>(EMPTY);
  const [id, setId] = useState(listingId ?? null);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [loading, setLoading] = useState(Boolean(listingId));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void (async () => {
      const token = await getIdToken(); if (!token) { router.replace('/sign-in'); return; }
      if (!listingId) { setLoading(false); return; }
      try {
        const [listing, currentPhotos] = await Promise.all([apiFetch<ListingDetail>(`/listings/mine/${encodeURIComponent(listingId)}`, { token }), apiFetch<ListingPhoto[]>(`/listings/${encodeURIComponent(listingId)}/photos`, { token })]);
        if (!current) return;
        setForm({ title: listing.title, city: listing.city, neighborhood: listing.neighborhood, latitude: String(listing.latitude), longitude: String(listing.longitude), priceRent: String(listing.priceRent), description: listing.description ?? '', availableFrom: listing.availableFrom ?? '', minStayMonths: String(listing.minStayMonths ?? 1) }); setPhotos(currentPhotos);
      } catch (cause) { if (current) setError(errorMessage(cause, 'Impossible de charger votre annonce.')); }
      finally { if (current) setLoading(false); }
    })();
    return () => { current = false; };
  }, [listingId]);

  function update(key: keyof Form, value: string) { setForm((previous) => ({ ...previous, [key]: value })); setDirty(true); }
  function leave() { if (!dirty) { router.back(); return; } Alert.alert('Quitter sans enregistrer ?', 'Vos modifications seront perdues.', [{ text: 'Continuer', style: 'cancel' }, { text: 'Quitter', style: 'destructive', onPress: () => router.back() }]); }
  useEffect(() => { const subscription = BackHandler.addEventListener('hardwareBackPress', () => { leave(); return true; }); return () => subscription.remove(); });

  function numeric(value: string, label: string): number | null { const parsed = Number(value.replace(',', '.')); if (!Number.isFinite(parsed)) { setError(`${label} doit être un nombre valide.`); return null; } return parsed; }
  async function save() {
    const token = await getIdToken(); if (!token || saving) return;
    if (!form.title.trim() || !form.city.trim() || !form.neighborhood.trim()) { setError('Le titre, la ville et le quartier sont obligatoires.'); return; }
    const latitude = numeric(form.latitude, 'La latitude'); const longitude = numeric(form.longitude, 'La longitude'); const priceRent = numeric(form.priceRent, 'Le loyer');
    if (latitude === null || longitude === null || priceRent === null) return;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || priceRent < 0) { setError('Vérifiez les coordonnées et le loyer.'); return; }
    const body: CreateListingRequest = { title: form.title.trim(), city: form.city.trim(), neighborhood: form.neighborhood.trim(), latitude, longitude, priceRent, description: form.description.trim() || null, availableFrom: form.availableFrom.trim() || null, minStayMonths: Number(form.minStayMonths) || 1 };
    setSaving(true); setError(null);
    try {
      const saved = id ? await apiFetch<ListingDetail>(`/listings/${encodeURIComponent(id)}`, { method: 'PATCH', token, body }) : await apiFetch<ListingDetail>('/listings', { method: 'POST', token, body });
      setId(saved.id); setDirty(false); setError(null); Alert.alert('Brouillon enregistré', 'Votre annonce est enregistrée. Ajoutez des photos puis envoyez-la en modération.');
    } catch (cause) { setError(errorMessage(cause, 'Impossible d’enregistrer le brouillon.')); }
    finally { setSaving(false); }
  }

  async function pickPhotos(useCamera: boolean) {
    const token = await getIdToken(); if (!token || !id) { setError('Enregistrez d’abord votre brouillon.'); return; }
    const permission = useCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Autorisez l’accès demandé dans les réglages pour ajouter une photo.'); return; }
    const result = useCamera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.85 });
    if (result.canceled) return;
    setUploading(true); setError(null);
    try {
      for (const [index, asset] of result.assets.entries()) { const uploaded = await apiUpload<ListingPhoto>(`/listings/${encodeURIComponent(id)}/photos`, { uri: asset.uri, name: asset.fileName ?? `photo-${Date.now()}-${index}.jpg`, type: asset.mimeType ?? 'image/jpeg' }, { token, onProgress: setProgress }); setPhotos((previous) => [...previous, uploaded]); }
      setDirty(true);
    } catch (cause) { setError(errorMessage(cause, 'Envoi de la photo impossible.')); }
    finally { setUploading(false); setProgress(0); }
  }
  async function photoAction(photo: ListingPhoto, action: 'cover' | 'delete') { const token = await getIdToken(); if (!token || !id) return; try { if (action === 'delete') { await apiFetch(`/listings/${id}/photos/${photo.id}`, { method: 'DELETE', token }); setPhotos((previous) => previous.filter((item) => item.id !== photo.id)); } else { const updated = await apiFetch<ListingPhoto>(`/listings/${id}/photos/${photo.id}?isCover=true`, { method: 'PATCH', token }); setPhotos((previous) => previous.map((item) => item.id === updated.id ? updated : { ...item, isCover: false })); } setDirty(true); } catch (cause) { setError(errorMessage(cause, 'Modification de la photo impossible.')); } }
  async function submitListing() { const token = await getIdToken(); if (!token || !id) { setError('Enregistrez d’abord le brouillon.'); return; } try { await apiFetch(`/listings/${id}/submit`, { method: 'POST', token }); setDirty(false); Alert.alert('Annonce envoyée', 'Votre annonce est maintenant en attente de modération.', [{ text: 'OK', onPress: () => router.back() }]); } catch (cause) { setError(errorMessage(cause, 'Votre annonce ne peut pas encore être envoyée.')); } }

  if (loading) return <View style={styles.screen}><TopBar title="Publier" onBack={leave} /><View style={styles.center}><ActivityIndicator color={color.brand} /></View></View>;
  return <View style={styles.screen}><TopBar title={id ? 'Modifier l’annonce' : 'Publier une annonce'} onBack={leave} /><ScrollView contentContainerStyle={styles.content}>
    <Text style={[type.bodySm, { color: color.textMuted }]}>Les coordonnées sont réservées à votre annonce et restent protégées par l’API.</Text>
    {error && <Text style={[type.bodySm, styles.error]} accessibilityLiveRegion="assertive">{error}</Text>}
    <TextField label="Titre" value={form.title} onChangeText={(value) => update('title', value)} placeholder="Chambre lumineuse à Gauthier" />
    <View style={styles.row}><View style={styles.half}><TextField label="Ville" value={form.city} onChangeText={(value) => update('city', value)} /></View><View style={styles.half}><TextField label="Quartier" value={form.neighborhood} onChangeText={(value) => update('neighborhood', value)} /></View></View>
    <View style={styles.row}><View style={styles.half}><TextField label="Latitude" value={form.latitude} onChangeText={(value) => update('latitude', value)} keyboardType="numbers-and-punctuation" /></View><View style={styles.half}><TextField label="Longitude" value={form.longitude} onChangeText={(value) => update('longitude', value)} keyboardType="numbers-and-punctuation" /></View></View>
    <TextField label="Loyer mensuel (MAD)" value={form.priceRent} onChangeText={(value) => update('priceRent', value)} keyboardType="numeric" />
    <TextField label="Disponible à partir du (AAAA-MM-JJ)" value={form.availableFrom} onChangeText={(value) => update('availableFrom', value)} placeholder="2026-10-01" />
    <TextField label="Séjour minimum (mois)" value={form.minStayMonths} onChangeText={(value) => update('minStayMonths', value)} keyboardType="numeric" />
    <TextField label="Description" value={form.description} onChangeText={(value) => update('description', value)} multiline numberOfLines={5} style={styles.description} />
    <Button onPress={() => void save()} loading={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le brouillon'}</Button>
    {id && <><Text style={type.h3}>Photos</Text><Text style={[type.bodySm, { color: color.textMuted }]}>Les photos sont ré-encodées par le serveur pour retirer les métadonnées de localisation.</Text><View style={styles.photoActions}><Button variant="secondary" onPress={() => void pickPhotos(false)}>Galerie</Button><Button variant="secondary" onPress={() => void pickPhotos(true)}>Appareil photo</Button></View>{uploading && <Text style={type.bodySm}>Envoi… {Math.round(progress * 100)}%</Text>}<View style={styles.photos}>{photos.map((photo) => <View key={photo.id} style={styles.photoItem}><Image source={{ uri: `${apiOrigin}${photo.url}` }} style={styles.photo} /><View style={styles.photoControls}>{!photo.isCover && <TextButton onPress={() => void photoAction(photo, 'cover')}>Couverture</TextButton>}<TextButton onPress={() => void photoAction(photo, 'delete')}>Supprimer</TextButton></View></View>)}</View><Button onPress={() => void submitListing()}>Envoyer en modération</Button></>}
  </ScrollView></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: color.bgPage }, content: { padding: layout.gutterMobile, gap: 16, paddingBottom: 40 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, error: { color: color.danger }, row: { flexDirection: 'row', gap: 12 }, half: { flex: 1 }, description: { height: 130, textAlignVertical: 'top', paddingTop: 12 }, photoActions: { flexDirection: 'row', gap: 12 }, photos: { gap: 12 }, photoItem: { backgroundColor: color.surfaceCard, borderRadius: radius.card, overflow: 'hidden' }, photo: { width: '100%', height: 180, backgroundColor: color.bgInset }, photoControls: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 } });
