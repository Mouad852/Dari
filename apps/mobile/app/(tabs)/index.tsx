import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ListingCard } from '@/components/ListingCard';
import { TopBar } from '@/components/TopBar';
import { apiFetch, ApiError } from '@/lib/api';
import { color, layout, type } from '@/theme/tokens';
import type { CursorPage, PublicListing } from '@/types/api';

/**
 * Explorer / feed screen -- real listings from the real API, forward cursor
 * pagination via FlatList's onEndReached. Deliberately narrower than
 * `FeedScreen.jsx`'s mockup: no search header, filter chips, sort control,
 * or profile-completion card yet, since none of those have anything real
 * behind them to do (no FiltersSheet, no sort param wiring, no completion
 * calculation ported) -- a chip that doesn't filter anything is the exact
 * "looks interactive, does nothing" defect this project has repeatedly
 * found and fixed on the web app. Nationwide by default (no `city` param),
 * matching the web app's own fix for the same silent-Rabat-default bug.
 */
export default function FeedScreen() {
  const [listings, setListings] = useState<PublicListing[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const page = await apiFetch<CursorPage<PublicListing>>('/listings');
      setListings(page.items);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Impossible de charger les annonces.');
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<CursorPage<PublicListing>>(`/listings?cursor=${encodeURIComponent(nextCursor)}`);
      setListings((prev) => [...(prev ?? []), ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      // A failed "load more" leaves the list as-is; the user can retry by scrolling again.
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  return (
    <View style={styles.screen}>
      <TopBar title="Explorer" />
      {error && (
        <View style={styles.centerBox}>
          <Text style={[type.body, styles.error]}>{error}</Text>
        </View>
      )}
      {!error && listings === null && (
        <View style={styles.centerBox}>
          <ActivityIndicator color={color.brand} />
        </View>
      )}
      {!error && listings !== null && listings.length === 0 && (
        <View style={styles.centerBox}>
          <Text style={type.body}>Aucune annonce pour le moment.</Text>
        </View>
      )}
      {!error && listings !== null && listings.length > 0 && (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          numColumns={1}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListingCard listing={item} onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })} />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => void loadMore()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={color.brand} />}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerSpinner} color={color.brand} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bgPage },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: layout.gutterMobile },
  error: { color: color.danger, textAlign: 'center' },
  list: { padding: layout.gutterMobile, gap: 16 },
  footerSpinner: { marginVertical: 16 },
});
