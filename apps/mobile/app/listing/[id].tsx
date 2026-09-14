import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { apiFetch, apiOrigin, ApiError } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { color, font, layout, radius, shadow, type } from '@/theme/tokens';
import type { PublicListingDetail } from '@/types/api';

const CHARGE_LABEL: Record<string, string> = {
  INCLUDED: 'Incluse',
  NOT_INCLUDED: 'Non incluse',
  NA: 'Non précisé',
};

const ROOM_TYPE_LABEL: Record<string, string> = {
  PRIVATE: 'Chambre privée',
  SHARED: 'Chambre partagée',
};

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  APARTMENT: 'Appartement',
  HOUSE: 'Maison',
  STUDIO: 'Studio',
};

/**
 * Real fields only, same discipline as ListingCard -- no invented rating,
 * no invented roommate cards, no "12 min du tramway". `ListingScreen.jsx`'s
 * "Colocataires" tab has nothing real behind it (the API has no roommate
 * profile concept at all), so it's not built here; "Le logement" and
 * "Règles" are, since `PublicListingDetail`/`HouseRules` genuinely carry
 * that data. No "Contacter" bar yet either -- that needs a real
 * conversation to open into, which needs the Messages screens this same
 * pass hasn't reached; wiring it to a route that doesn't exist yet would
 * be the same dead-link defect this project has repeatedly fixed on web.
 */
export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [listing, setListing] = useState<PublicListingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    (async () => {
      try {
        const detail = await apiFetch<PublicListingDetail>(`/listings/${encodeURIComponent(id)}`);
        if (isCurrent) setListing(detail);
      } catch (cause) {
        if (isCurrent) setError(cause instanceof ApiError ? cause.message : 'Impossible de charger cette annonce.');
      }
    })();
    return () => {
      isCurrent = false;
    };
  }, [id]);

  useEffect(() => {
    let isCurrent = true;
    (async () => {
      const token = await getIdToken();
      if (!isCurrent) return;
      setSignedIn(Boolean(token));
      if (!token) return;
      try {
        const ids = await apiFetch<string[]>('/favorites/ids', { token });
        if (isCurrent) setSaved(ids.includes(id));
      } catch {
        // A failed favourites check just leaves the heart unfilled -- not worth its own error state.
      }
    })();
    return () => {
      isCurrent = false;
    };
  }, [id]);

  async function toggleSave() {
    const token = await getIdToken();
    if (!token) {
      router.push('/sign-in');
      return;
    }
    const next = !saved;
    setSaved(next);
    try {
      await apiFetch(`/favorites/${encodeURIComponent(id)}`, { method: next ? 'POST' : 'DELETE', token });
    } catch {
      setSaved(!next);
    }
  }

  if (error) {
    return (
      <View style={styles.centerScreen}>
        <Text style={[type.body, { color: color.danger, textAlign: 'center' }]}>{error}</Text>
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color={color.brand} />
      </View>
    );
  }

  // `coverPhotoUrl` (from `PublicListing`) is on `PublicListingDetail`'s
  // type only because it extends `PublicListing`, which really does carry
  // it on /listings' list rows -- but GET /listings/{id} itself never sends
  // that field at all, only the full `photos[]` array. Found live: this
  // screen showed the "PHOTO" placeholder for a listing the feed card,
  // one screen back, had just rendered a real photo for. The web app's own
  // detail page never made this mistake -- it always reads `photos[0]`,
  // never `coverPhotoUrl` -- this fixes the mobile app to match.
  const coverPhoto = listing.photos.find((photo) => photo.isCover) ?? listing.photos[0] ?? null;

  const facts: Array<[string, string]> = [
    listing.propertyType ? ['Type de logement', PROPERTY_TYPE_LABEL[listing.propertyType] ?? listing.propertyType] : null,
    listing.roomType ? ['Chambre', ROOM_TYPE_LABEL[listing.roomType] ?? listing.roomType] : null,
    listing.numBedrooms != null ? ['Chambres', String(listing.numBedrooms)] : null,
    listing.numBathrooms != null ? ['Salles de bain', String(listing.numBathrooms)] : null,
    listing.minStayMonths != null ? ['Séjour minimum', `${listing.minStayMonths} mois`] : null,
    listing.availableFrom ? ['Disponible à partir du', listing.availableFrom] : null,
  ].filter((entry): entry is [string, string] => entry !== null);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.photo}>
        {coverPhoto ? (
          <Image source={{ uri: `${apiOrigin}${coverPhoto.url}` }} style={styles.photoImg} resizeMode="cover" />
        ) : (
          <Text style={styles.photoPlaceholder}>PHOTO</Text>
        )}
        <View style={[styles.photoControls, { top: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" style={styles.glassButton}>
            <Icon name="chevron-left" size={20} color={color.textHeading} />
          </Pressable>
          <Pressable
            onPress={() => void toggleSave()}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Retirer des favoris' : 'Enregistrer'}
            style={styles.glassButton}
          >
            <Icon name="heart" size={20} color={saved ? color.brand : color.textHeading} fill={saved ? color.brand : undefined} />
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={type.h1}>{listing.title}</Text>
        <View style={styles.locationRow}>
          <Icon name="map-pin" size={14} color={color.textMuted} />
          <Text style={[type.bodySm, { color: color.textMuted }]}>
            {listing.neighborhood}, {listing.city}
          </Text>
        </View>
        <Text style={[type.price, { fontSize: 24 }]}>
          {Math.round(listing.priceRent).toLocaleString('fr-FR')}{' '}
          <Text style={[type.caption, { color: color.textMuted }]}>MAD/mois</Text>
        </Text>

        {listing.description && (
          <View style={styles.section}>
            <Text style={type.h3}>À propos du logement</Text>
            <Text style={[type.body, { marginTop: 6 }]}>{listing.description}</Text>
          </View>
        )}

        {facts.length > 0 && (
          <View style={styles.section}>
            <Text style={type.h3}>Détails</Text>
            <View style={styles.factsGrid}>
              {facts.map(([label, value]) => (
                <View key={label} style={styles.factRow}>
                  <Text style={[type.bodySm, { color: color.textMuted }]}>{label}</Text>
                  <Text style={type.bodySm}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={type.h3}>Charges et disponibilité</Text>
          <View style={styles.factsGrid}>
            <View style={styles.factRow}>
              <Text style={[type.bodySm, { color: color.textMuted }]}>Wi-Fi</Text>
              <Text style={type.bodySm}>{CHARGE_LABEL[listing.wifiIncluded]}</Text>
            </View>
            <View style={styles.factRow}>
              <Text style={[type.bodySm, { color: color.textMuted }]}>Électricité</Text>
              <Text style={type.bodySm}>{CHARGE_LABEL[listing.electricityIncluded]}</Text>
            </View>
            <View style={styles.factRow}>
              <Text style={[type.bodySm, { color: color.textMuted }]}>Eau</Text>
              <Text style={type.bodySm}>{CHARGE_LABEL[listing.waterIncluded]}</Text>
            </View>
          </View>
        </View>

        {listing.houseRules && (
          <View style={styles.section}>
            <Text style={type.h3}>Règles de la maison</Text>
            <View style={{ gap: 8, marginTop: 6 }}>
              {listing.houseRules.smokingAllowed !== null && (
                <RuleLine ok={listing.houseRules.smokingAllowed} label="Fumeur accepté" />
              )}
              {listing.houseRules.petsAllowed !== null && <RuleLine ok={listing.houseRules.petsAllowed} label="Animaux acceptés" />}
              {listing.houseRules.guestsAllowed !== null && <RuleLine ok={listing.houseRules.guestsAllowed} label="Invités acceptés" />}
              {listing.houseRules.quietHoursStart && listing.houseRules.quietHoursEnd && (
                <Text style={type.bodySm}>
                  Heures calmes : {listing.houseRules.quietHoursStart.slice(0, 5)} – {listing.houseRules.quietHoursEnd.slice(0, 5)}
                </Text>
              )}
              {listing.houseRules.otherRules && <Text style={type.bodySm}>{listing.houseRules.otherRules}</Text>}
            </View>
          </View>
        )}

        {!signedIn && (
          <Text style={[type.bodySm, { color: color.textMuted, marginTop: 20 }]}>
            Connectez-vous pour contacter le propriétaire.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function RuleLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon name={ok ? 'check' : 'x'} size={16} color={ok ? color.success : color.textMuted} />
      <Text style={type.bodySm}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bgPage },
  centerScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bgPage, padding: layout.gutterMobile },
  photo: { height: 260, backgroundColor: color.bgInset, alignItems: 'center', justifyContent: 'center' },
  photoImg: { width: '100%', height: '100%' },
  photoPlaceholder: {
    fontFamily: font.uiMedium,
    fontSize: 12,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: color.textMuted,
  },
  photoControls: {
    position: 'absolute',
    left: layout.gutterMobile,
    right: layout.gutterMobile,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  glassButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadow.sm,
  },
  body: { padding: layout.gutterMobile, gap: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  section: { marginTop: 20 },
  factsGrid: { marginTop: 8, gap: 8 },
  factRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
