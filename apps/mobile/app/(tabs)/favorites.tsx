import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Button, TextButton } from '@/components/Button';
import { ListingCard } from '@/components/ListingCard';
import { TopBar } from '@/components/TopBar';
import { apiFetch, ApiError, errorMessage } from '@/lib/api';
import { hasNetwork } from '@/lib/network';
import { getIdToken, onAuthChange } from '@/lib/firebase';
import { color, layout, type } from '@/theme/tokens';
import type { CursorPage, PublicListing } from '@/types/api';

export default function FavoritesScreen() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [items, setItems] = useState<PublicListing[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAuthChange((user) => setSignedIn(Boolean(user))), []);

  const load = useCallback(async (refresh = false) => {
    const token = await getIdToken();
    if (!token) return;
    if (!(await hasNetwork())) {
      setError('Vous êtes hors connexion. Reconnectez-vous pour actualiser vos favoris.');
      return;
    }
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      const page = await apiFetch<CursorPage<PublicListing>>('/favorites', { token });
      setItems(page.items);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      setError(errorMessage(cause, 'Impossible de charger vos favoris.'));
    } finally {
      if (refresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (signedIn) void load(); }, [signedIn, load]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const token = await getIdToken();
    if (!token) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<CursorPage<PublicListing>>(`/favorites?cursor=${encodeURIComponent(nextCursor)}`, { token });
      setItems((previous) => [...(previous ?? []), ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'INVALID_CURSOR') await load(true);
      else setError(errorMessage(cause, 'Impossible de charger la suite.'));
    } finally {
      setLoadingMore(false);
    }
  }, [load, loadingMore, nextCursor]);

  async function removeFavorite(id: string) {
    const token = await getIdToken();
    if (!token) return;
    const previous = items ?? [];
    setItems(previous.filter((item) => item.id !== id));
    try {
      await apiFetch(`/favorites/${encodeURIComponent(id)}`, { method: 'DELETE', token });
    } catch (cause) {
      setItems(previous);
      setError(errorMessage(cause, 'Le favori n’a pas pu être retiré.'));
    }
  }

  if (signedIn === false) return <View style={styles.screen}><TopBar title="Favoris" /><View style={styles.centerBox}>
    <Text style={[type.body, styles.centerText]}>Connectez-vous pour retrouver vos annonces sauvegardées.</Text>
    <Button onPress={() => router.push('/sign-in')}>Se connecter</Button>
  </View></View>;

  return <View style={styles.screen}>
    <TopBar title="Favoris" />
    {error && <View style={styles.errorBox}><Text style={[type.bodySm, styles.error]}>{error}</Text><TextButton onPress={() => void load(true)}>Réessayer</TextButton></View>}
    {!error && items === null && <View style={styles.centerBox}><ActivityIndicator color={color.brand} /></View>}
    {!error && items !== null && items.length === 0 && <View style={styles.centerBox}><Text style={type.body}>Aucune annonce sauvegardée.</Text></View>}
    {items !== null && items.length > 0 && <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => <View><ListingCard listing={item} onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })} /><TextButton onPress={() => void removeFavorite(item.id)}>Retirer des favoris</TextButton></View>}
      onEndReachedThreshold={0.4}
      onEndReached={() => void loadMore()}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={color.brand} />}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={color.brand} /> : null}
    />}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bgPage },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: layout.gutterMobile },
  centerText: { textAlign: 'center' },
  list: { padding: layout.gutterMobile, gap: 18 },
  footer: { marginVertical: 16 },
  errorBox: { padding: 16, gap: 8, backgroundColor: color.dangerSubtle, borderBottomWidth: 1, borderBottomColor: color.dangerBorder },
  error: { color: color.danger },
});
