import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, TextButton } from '@/components/Button';
import { DeleteAccountModal } from '@/components/DeleteAccountModal';
import { LegalLinks } from '@/components/LegalLinks';
import { TextField } from '@/components/TextField';
import { TopBar } from '@/components/TopBar';
import { apiFetch, ApiError, apiUpload, errorMessage, mediaUrl, reportUnexpected } from '@/lib/api';
import { fieldErrors, MAX_LENGTH } from '@/lib/fields';
import { SITE_URL } from '@/lib/config';
import { getIdToken, onAuthChange, signOut } from '@/lib/firebase';
import { profileUpdateBody } from '@/lib/profile';
import { reportError } from '@/lib/reporting';
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
  /** The API's per-field messages from the last failed save (audit P1-4). */
  const [fieldIssues, setFieldIssues] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Bumped by "Réessayer". Setting signedIn to the true it already was re-ran nothing.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => onAuthChange((user) => setSignedIn(Boolean(user))), []);
  useEffect(() => {
    if (!signedIn) { setProfile(null); return; }
    let current = true;
    setLoading(true);
    setError(null);
    void (async () => {
      const token = await getIdToken();
      if (!token) { if (current) setLoading(false); return; }
      try {
        const value = await apiFetch<Me>('/users/me', { token });
        if (!current) return;
        setProfile(value); setFirstName(value.firstName ?? ''); setDisplayName(value.displayName); setCity(value.city ?? ''); setBio(value.bio ?? ''); setError(null);
      } catch (cause) {
        // Signed in to Firebase with no Dari profile yet: finish it rather than show an error.
        if (cause instanceof ApiError && cause.isMissingProfile) { if (current) router.replace('/profile-recovery'); return; }
        if (current) setError(errorMessage(cause, 'Impossible de charger votre profil.')); reportUnexpected(cause, 'profile');
      }
      finally { if (current) setLoading(false); }
    })();
    return () => { current = false; };
  }, [signedIn, reloadKey]);

  async function save() {
    const token = await getIdToken(); if (!token || saving) return;
    if (displayName.trim().length < 2) { setError('Le nom affiché doit contenir au moins 2 caractères.'); return; }
    setSaving(true); setError(null); setFieldIssues({});
    try { setProfile(await apiFetch<Me>('/users/me', { method: 'PATCH', token, body: profileUpdateBody({ firstName, displayName, city, bio }) })); }
    catch (cause) { setError(errorMessage(cause, 'Impossible d’enregistrer votre profil.')); setFieldIssues(fieldErrors(cause)); }
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
    catch (cause) { setError(errorMessage(cause, 'Envoi de la photo impossible.')); }
    finally { setAvatarBusy(false); }
  }

  async function deleteAccount() {
    const token = await getIdToken(); if (!token || deleting) return;
    setDeleting(true); setDeleteError(null);
    try { await apiFetch('/users/me', { method: 'DELETE', token }); setDeleteOpen(false); await signOut(); }
    catch (cause) { setDeleteError(errorMessage(cause, 'Suppression impossible. Réessayez.')); reportUnexpected(cause, 'account-deletion'); }
    finally { setDeleting(false); }
  }

  /**
   * Publishing lives on the web wizard (owner decision P0-4): the in-app form
   * could never submit a listing the API accepts, so it is gone rather than
   * half-working.
   */
  function openWebPublish() {
    Linking.openURL(`${SITE_URL}/publish`).catch((cause: unknown) => reportError(cause, { kind: 'web-publish-link' }));
  }

  function openDelete() {
    setDeleteError(null);
    setDeleteOpen(true);
  }

  if (signedIn === false) return <View style={styles.screen}><TopBar title="Profil" /><View style={styles.center}><Text style={[type.body, styles.centerText]}>Connectez-vous pour gérer votre compte, vos annonces et vos favoris.</Text><Button onPress={() => router.push('/sign-in')}>Se connecter</Button><Button variant="secondary" onPress={() => router.push('/sign-up')}>Créer un compte</Button><LegalLinks /></View></View>;
  if (loading || !profile) return <View style={styles.screen}><TopBar title="Profil" /><View style={styles.center}><Text style={type.body}>{error ?? 'Chargement…'}</Text>{error && <TextButton onPress={() => setReloadKey((key) => key + 1)}>Réessayer</TextButton>}</View></View>;
  return <View style={styles.screen}><TopBar title="Profil" /><ScrollView contentContainerStyle={styles.content}>
    {error && <Text style={[type.bodySm, styles.error]} accessibilityLiveRegion="assertive">{error}</Text>}
    <View style={styles.avatarWrap}>{profile.avatarUrl ? <Image source={{ uri: mediaUrl(profile.avatarUrl) }} style={styles.avatar} /> : <Text style={styles.avatarInitial}>{profile.displayName.charAt(0).toUpperCase()}</Text>}</View>
    <TextButton onPress={() => void changeAvatar()} disabled={avatarBusy}>{avatarBusy ? 'Envoi…' : 'Modifier la photo'}</TextButton>
    <TextField label="Nom affiché" value={displayName} onChangeText={setDisplayName} maxLength={MAX_LENGTH.displayName} error={fieldIssues.displayName} />
    <TextField label="Prénom" value={firstName} onChangeText={setFirstName} maxLength={MAX_LENGTH.firstName} error={fieldIssues.firstName} />
    <TextField label="Ville" value={city} onChangeText={setCity} maxLength={MAX_LENGTH.profileCity} error={fieldIssues.city} />
    <TextField label="Bio" value={bio} onChangeText={setBio} multiline numberOfLines={4} style={styles.bioInput} maxLength={MAX_LENGTH.bio} error={fieldIssues.bio} />
    <Button onPress={() => void save()} loading={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
    {SITE_URL && <View style={styles.webPublish}>
      <Text style={[type.bodySm, styles.webPublishNote]}>La publication et la gestion des annonces se font sur le site web de Dari.</Text>
      <Button variant="secondary" onPress={openWebPublish}>Publier sur le site web</Button>
    </View>}
    <Button variant="secondary" onPress={() => void signOut()}>Se déconnecter</Button>
    <TextButton onPress={openDelete}>Supprimer définitivement mon compte</TextButton>
    <LegalLinks />
  </ScrollView>
    <DeleteAccountModal visible={deleteOpen} busy={deleting} error={deleteError} onCancel={() => setDeleteOpen(false)} onConfirm={() => void deleteAccount()} />
  </View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: color.bgPage }, content: { padding: layout.gutterMobile, gap: 16, alignItems: 'stretch' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: layout.gutterMobile }, centerText: { textAlign: 'center' }, error: { color: color.danger }, avatarWrap: { alignSelf: 'center', width: 88, height: 88, borderRadius: radius.avatar, backgroundColor: color.brandSubtle, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatar: { width: '100%', height: '100%' }, avatarInitial: { fontFamily: type.h1.fontFamily, fontSize: 32, color: color.brand }, bioInput: { height: 110, textAlignVertical: 'top', paddingTop: 12 }, webPublish: { gap: 8 }, webPublishNote: { color: color.textMuted, textAlign: 'center' } });
