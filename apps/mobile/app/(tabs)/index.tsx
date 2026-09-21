import MapView, { Marker, type Region } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, TextButton } from '@/components/Button';
import { ListingCard } from '@/components/ListingCard';
import { TextField } from '@/components/TextField';
import { TopBar } from '@/components/TopBar';
import { apiFetch, ApiError } from '@/lib/api';
import { EMPTY_FILTERS, searchParams, validateFilters, type ListingFilters, type SearchSort, type SearchView } from '@/lib/search';
import { hasNetwork, isAbortError, subscribeToNetwork } from '@/lib/network';
import { color, font, layout, radius, type } from '@/theme/tokens';
import type { CursorPage, MapPin, PublicListing } from '@/types/api';

const OPTIONS = {
  propertyType: [['', 'Tous'], ['APARTMENT', 'Appartement'], ['HOUSE', 'Maison'], ['STUDIO', 'Studio']],
  roomType: [['', 'Toutes'], ['PRIVATE', 'Privée'], ['SHARED', 'Partagée']],
  furnishing: [['', 'Tous'], ['FULLY_FURNISHED', 'Meublé'], ['PARTIALLY_FURNISHED', 'Partiellement meublé'], ['UNFURNISHED', 'Non meublé']],
} as const;

export default function FeedScreen() {
  const [filters, setFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [view, setView] = useState<SearchView>('list');
  const [filterOpen, setFilterOpen] = useState(false);
  const [listings, setListings] = useState<PublicListing[] | null>(null);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const mapRequestRef = useRef<AbortController | null>(null);

  useEffect(() => subscribeToNetwork(setOfflineState), []);
  function setOfflineState(online: boolean) { setOffline(!online); }

  const load = useCallback(async (cursor?: string, refresh = false) => {
    const cacheKey = `dari:public-search:${searchParams(filters)}`;
    if (!(await hasNetwork())) {
      setOffline(true);
      if (!cursor) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) { try { const page = JSON.parse(cached) as CursorPage<PublicListing>; setListings(page.items); setNextCursor(page.nextCursor); setError(null); setLoading(false); return; } catch { await AsyncStorage.removeItem(cacheKey); } }
      }
      setError('Aucune connexion. Vérifiez votre réseau puis réessayez.'); setLoading(false); return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (cursor) setLoadingMore(true); else { setLoading(true); if (refresh) setRefreshing(true); }
    if (!cursor) setError(null);
    try {
      const page = await apiFetch<CursorPage<PublicListing>>(`/listings?${searchParams(filters, cursor)}`, { signal: controller.signal });
      if (cursor) setListings((previous) => [...(previous ?? []), ...page.items]); else setListings(page.items);
      setNextCursor(page.nextCursor);
      if (!cursor) void AsyncStorage.setItem(cacheKey, JSON.stringify(page));
    } catch (cause) {
      if (isAbortError(cause)) return;
      if (cursor && cause instanceof ApiError && cause.code === 'INVALID_CURSOR') {
        setNextCursor(null);
        await load(undefined, true);
        return;
      }
      setError(cause instanceof ApiError ? cause.message : 'Impossible de charger les annonces.');
    } finally {
      if (cursor) setLoadingMore(false); else { setLoading(false); setRefreshing(false); }
    }
  }, [filters]);

  const loadMap = useCallback(async () => {
    if (!(await hasNetwork())) return;
    mapRequestRef.current?.abort();
    const controller = new AbortController();
    mapRequestRef.current = controller;
    setMapLoading(true);
    try {
      const result = await apiFetch<MapPin[]>(`/listings/map?${searchParams(filters)}`, { signal: controller.signal });
      setPins(result);
    } catch (cause) {
      if (!isAbortError(cause)) setError(cause instanceof ApiError ? cause.message : 'Impossible de charger la carte.');
    } finally { setMapLoading(false); }
  }, [filters]);

  useEffect(() => { void load(); void loadMap(); return () => { requestRef.current?.abort(); mapRequestRef.current?.abort(); }; }, [load, loadMap]);

  const region = useMemo<Region>(() => {
    if (pins.length === 0) return { latitude: 33.5731, longitude: -7.5898, latitudeDelta: 4.5, longitudeDelta: 4.5 };
    const latitude = pins.reduce((total, pin) => total + pin.latitude, 0) / pins.length;
    const longitude = pins.reduce((total, pin) => total + pin.longitude, 0) / pins.length;
    return { latitude, longitude, latitudeDelta: 0.35, longitudeDelta: 0.35 };
  }, [pins]);

  function applyFilters() {
    const validation = validateFilters(draftFilters);
    if (validation) { setError(validation); return; }
    setFilters({ ...draftFilters, amenities: [...draftFilters.amenities] });
    setFilterOpen(false);
  }

  function resetFilters() { setDraftFilters(EMPTY_FILTERS); setFilters(EMPTY_FILTERS); setFilterOpen(false); }

  return <View style={styles.screen}>
    <TopBar title="Explorer" action={<Pressable onPress={() => { setDraftFilters(filters); setFilterOpen(true); }} accessibilityRole="button" accessibilityLabel="Ouvrir les filtres" style={styles.filterButton}><Text style={styles.filterLabel}>Filtrer</Text></Pressable>} />
    {offline && <View style={styles.offline}><Text style={[type.caption, { color: color.warning }]}>Hors connexion · les nouvelles recherches sont désactivées.</Text></View>}
    <View style={styles.toolbar}>
      <View style={styles.searchSummary}><Text style={type.bodySm}>{filters.city || 'Toutes les villes'}</Text><Text style={[type.caption, { color: color.textMuted }]}>{filters.sort === 'priceasc' ? 'Prix croissant' : filters.sort === 'pricedesc' ? 'Prix décroissant' : filters.sort === 'updated' ? 'Plus récentes' : 'Recommandées'}</Text></View>
      <View style={styles.viewToggle}><TextButton onPress={() => setView('list')}>Liste</TextButton><TextButton onPress={() => setView('map')}>Carte</TextButton></View>
    </View>
    {error && <View style={styles.errorBox}><Text style={[type.bodySm, styles.error]}>{error}</Text><TextButton onPress={() => void load(undefined, true)}>Réessayer</TextButton></View>}
    {view === 'map' ? <View style={styles.mapWrap}>
      <MapView style={styles.map} initialRegion={region} region={region} accessibilityLabel="Carte des annonces disponibles">
        {pins.map((pin) => <Marker key={pin.id} coordinate={{ latitude: pin.latitude, longitude: pin.longitude }} title={pin.title} description={`${pin.neighborhood}, ${pin.city}`} accessibilityLabel={`Annonce ${pin.title}`} onCalloutPress={() => router.push({ pathname: '/listing/[id]', params: { id: pin.id } })} />)}
      </MapView>
      {mapLoading && <View style={styles.mapLoading}><ActivityIndicator color={color.brand} /></View>}
    </View> : <>
      {loading && listings === null && <View style={styles.centerBox}><ActivityIndicator color={color.brand} /></View>}
      {!loading && listings?.length === 0 && <View style={styles.centerBox}><Text style={type.body}>Aucune annonce ne correspond à ces critères.</Text><TextButton onPress={resetFilters}>Réinitialiser les filtres</TextButton></View>}
      {listings && listings.length > 0 && <FlatListCompat listings={listings} nextCursor={nextCursor} loadingMore={loadingMore} refreshing={refreshing} onRefresh={() => void load(undefined, true)} onLoadMore={() => void load(nextCursor ?? undefined)} />}
    </>}
    <Modal visible={filterOpen} animationType="slide" transparent onRequestClose={() => setFilterOpen(false)}>
      <View style={styles.modalBackdrop}><View style={styles.sheet}>
        <View style={styles.sheetHeader}><Text style={type.h2}>Filtres</Text><TextButton onPress={() => setFilterOpen(false)}>Fermer</TextButton></View>
        <ScrollView contentContainerStyle={styles.form}>
          <TextField label="Ville" value={draftFilters.city} onChangeText={(value) => setDraftFilters((f) => ({ ...f, city: value }))} placeholder="Casablanca" />
          <TextField label="Quartier" value={draftFilters.neighborhood} onChangeText={(value) => setDraftFilters((f) => ({ ...f, neighborhood: value }))} placeholder="Gauthier" />
          <Choice label="Type de logement" value={draftFilters.propertyType} options={OPTIONS.propertyType} onChange={(value) => setDraftFilters((f) => ({ ...f, propertyType: value }))} />
          <Choice label="Type de chambre" value={draftFilters.roomType} options={OPTIONS.roomType} onChange={(value) => setDraftFilters((f) => ({ ...f, roomType: value }))} />
          <Choice label="Mobilier" value={draftFilters.furnishing} options={OPTIONS.furnishing} onChange={(value) => setDraftFilters((f) => ({ ...f, furnishing: value }))} />
          <View style={styles.row}><View style={styles.half}><TextField label="Loyer min. (MAD)" value={draftFilters.priceMin} keyboardType="numeric" onChangeText={(value) => setDraftFilters((f) => ({ ...f, priceMin: value }))} /></View><View style={styles.half}><TextField label="Loyer max. (MAD)" value={draftFilters.priceMax} keyboardType="numeric" onChangeText={(value) => setDraftFilters((f) => ({ ...f, priceMax: value }))} /></View></View>
          <TextField label="Disponible à partir du (AAAA-MM-JJ)" value={draftFilters.availableFrom} onChangeText={(value) => setDraftFilters((f) => ({ ...f, availableFrom: value }))} placeholder="2026-10-01" />
          <Choice label="Trier par" value={draftFilters.sort} options={[[['recommended', 'Recommandées'], ['updated', 'Plus récentes'], ['priceasc', 'Prix croissant'], ['pricedesc', 'Prix décroissant']] as const][0]} onChange={(value) => setDraftFilters((f) => ({ ...f, sort: value as SearchSort }))} />
          <Button onPress={applyFilters}>Appliquer</Button><Button variant="secondary" onPress={resetFilters}>Réinitialiser</Button>
        </ScrollView>
      </View></View>
    </Modal>
  </View>;
}

function FlatListCompat({ listings, nextCursor, loadingMore, refreshing, onRefresh, onLoadMore }: { listings: PublicListing[]; nextCursor: string | null; loadingMore: boolean; refreshing: boolean; onRefresh: () => void; onLoadMore: () => void }) {
  return <FlatList<PublicListing> data={listings} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => <ListingCard listing={item} onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })} />} onEndReachedThreshold={0.4} onEndReached={() => { if (nextCursor) onLoadMore(); }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.brand} />} ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={color.brand} /> : null} />;
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void }) {
  return <View style={styles.choice}><Text style={styles.choiceLabel}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>{options.map(([option, text]) => <Pressable key={option} onPress={() => onChange(option)} accessibilityRole="radio" accessibilityState={{ selected: value === option }} style={[styles.chip, value === option && styles.chipSelected]}><Text style={[styles.chipText, value === option && styles.chipTextSelected]}>{text}</Text></Pressable>)}</ScrollView></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bgPage }, filterButton: { padding: 8 }, filterLabel: { fontFamily: font.uiSemibold, fontSize: 13, color: color.brand },
  offline: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: color.warningSubtle }, toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, gap: 12 }, searchSummary: { gap: 2 }, viewToggle: { flexDirection: 'row', gap: 14 }, centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 }, list: { padding: layout.gutterMobile, gap: 16 }, footer: { marginVertical: 16 }, errorBox: { padding: 14, gap: 6, backgroundColor: color.dangerSubtle, borderBottomWidth: 1, borderBottomColor: color.dangerBorder }, error: { color: color.danger },
  mapWrap: { flex: 1, overflow: 'hidden' }, map: { flex: 1 }, mapLoading: { position: 'absolute', top: 16, right: 16, padding: 10, borderRadius: radius.pill, backgroundColor: color.surfaceCard },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: color.surfaceScrim }, sheet: { maxHeight: '92%', backgroundColor: color.bgPage, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: 20 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }, form: { gap: 16, paddingBottom: 24 }, row: { flexDirection: 'row', gap: 12 }, half: { flex: 1 }, choice: { gap: 7 }, choiceLabel: { fontFamily: font.uiSemibold, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: color.textMuted }, choices: { gap: 8 }, chip: { borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: color.surfaceCard }, chipSelected: { borderColor: color.brand, backgroundColor: color.brandSubtle }, chipText: { fontFamily: font.uiMedium, fontSize: 12, color: color.textBody }, chipTextSelected: { color: color.brandPress },
});
