import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, TextButton } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { TopBar } from '@/components/TopBar';
import { apiFetch, apiOrigin, apiUpload, ApiError } from '@/lib/api';
import { getIdToken, onAuthChange, signOut } from '@/lib/firebase';
import type { Me } from '@/types/api';
import { color, layout, radius, type } from '@/theme/tokens';

export default function ProfileScreen() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<Me | null>(null);
  const [firstName, setFirstName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAuthChange((user) => setSignedIn(Boolean(user))), []);
  useEffect(() => {
    if (!signedIn) { setProfile(null); return; }
    let current = true;
    setLoading(true);
    void (async () => {
      const token = await getIdToken();
      if (!token) return;
      try {
        const value = await apiFetch<Me>('/users/me', { token });
        if (!current) return;
        setProfile(value); setFirstName(value.firstName ?? ''); setDisplayName(value.displayName); setCity(value.city ?? ''); setBio(value.bio ?? ''); setError(null);
      } catch (cause) { if (current) setError(cause instanceof ApiError ? cause.message : 'Impossible de charger votre profil.'); }
      finally { if (current) setLoading(false); }
    })();
    return () => { current = false; };
  }, [signedIn]);

  async function save() {
    const token = await getIdToken(); if (!token || saving) return;
    if (displayName.trim().length < 2) { setError('Le nom affiché doit contenir au moins 2 caractères.'); return; }
    setSaving(true); setError(null);
    try { setProfile(await apiFetch<Me>('/users/me', { method: 'PATCH', token, body: { firstName: firstName.trim() || null, displayName: displayName.trim(), city: city.trim() || null, bio: bio.trim() || null } })); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Impossible d’enregistrer votre profil.'); }
    finally { setSaving(false); }
  }

  async function changeAvatar() {
    const token = await getIdToken(); if (!token || avatarBusy) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Autorisez l’accès à vos photos dans les réglages pour ajouter une photo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0]; setAvatarBusy(true); setError(null);
    try { setProfile(await apiUpload<Me>('/users/me/avatar', { uri: asset.uri, name: asset.fileName ?? 'avatar.jpg', type: asset.mimeType ?? 'image/jpeg' }, { token })); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Envoi de la photo impossible.'); }
    finally { setAvatarBusy(false); }
  }

  async function deleteAccount() {
    const token = await getIdToken(); if (!token) return;
    setLoading(true);
    try { await apiFetch('/users/me', { method: 'DELETE', token }); await signOut(); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Suppression impossible. Réessayez.'); }
    finally { setLoading(false); }
  }

  function confirmDelete() {
    const start = () => {
      if (Platform.OS === 'ios') Alert.prompt('Confirmation', 'Tapez SUPPRIMER pour confirmer.', (value) => { if (value === 'SUPPRIMER') void deleteAccount(); });
      else void deleteAccount();
    };
    Alert.alert('Supprimer le compte ?', 'Cette action est définitive et retirera vos annonces. Vos conversations seront conservées pour les autres participants.', [
      { text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: start },
    ]);
  }

  if (signedIn === false) return <View style={styles.screen}><TopBar title="Profil" /><View style={styles.center}><Text style={[type.body, styles.centerText]}>Connectez-vous pour gérer votre compte, vos annonces et vos favoris.</Text><Button onPress={() => router.push('/sign-in')}>Se connecter</Button><Button variant="secondary" onPress={() => router.push('/sign-up')}>Créer un compte</Button></View></View>;
  if (loading || !profile) return <View style={styles.screen}><TopBar title="Profil" /><View style={styles.center}><Text style={type.body}>{error ?? 'Chargement…'}</Text>{error && <TextButton onPress={() => setSignedIn(true)}>Réessayer</TextButton>}</View></View>;
  return <View style={styles.screen}><TopBar title="Profil" /><ScrollView contentContainerStyle={styles.content}>
    {error && <Text style={[type.bodySm, styles.error]} accessibilityLiveRegion="assertive">{error}</Text>}
    <View style={styles.avatarWrap}>{profile.avatarUrl ? <Image source={{ uri: `${apiOrigin}${profile.avatarUrl}` }} style={styles.avatar} /> : <Text style={styles.avatarInitial}>{profile.displayName.charAt(0).toUpperCase()}</Text>}</View>
    <TextButton onPress={() => void changeAvatar()} disabled={avatarBusy}>{avatarBusy ? 'Envoi…' : 'Modifier la photo'}</TextButton>
    <TextField label="Nom affiché" value={displayName} onChangeText={setDisplayName} />
    <TextField label="Prénom" value={firstName} onChangeText={setFirstName} />
    <TextField label="Ville" value={city} onChangeText={setCity} />
    <TextField label="Bio" value={bio} onChangeText={setBio} multiline numberOfLines={4} style={styles.bioInput} />
    <Button onPress={() => void save()} loading={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
    <Button variant="secondary" onPress={() => router.push('/publish' as never)}>Publier une annonce</Button>
    <Button variant="secondary" onPress={() => void signOut()}>Se déconnecter</Button>
    <TextButton onPress={confirmDelete}>Supprimer définitivement mon compte</TextButton>
  </ScrollView></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: color.bgPage }, content: { padding: layout.gutterMobile, gap: 16, alignItems: 'stretch' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: layout.gutterMobile }, centerText: { textAlign: 'center' }, error: { color: color.danger }, avatarWrap: { alignSelf: 'center', width: 88, height: 88, borderRadius: radius.avatar, backgroundColor: color.brandSubtle, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatar: { width: '100%', height: '100%' }, avatarInitial: { fontFamily: type.h1.fontFamily, fontSize: 32, color: color.brand }, bioInput: { height: 110, textAlignVertical: 'top', paddingTop: 12 } });
