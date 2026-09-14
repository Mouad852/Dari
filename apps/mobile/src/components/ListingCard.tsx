import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { apiOrigin } from '@/lib/api';
import { color, font, radius, shadow, type } from '@/theme/tokens';
import type { PublicListing } from '@/types/api';

/**
 * A real listing, real fields only -- deliberately narrower than the mockup
 * (`FeedScreen.jsx`'s `ListingCard` usage carries a `rating` and a `badge`
 * neither the API nor any Dari page anywhere sends). This project has
 * repeatedly found and removed exactly that pattern on the web app
 * (TODO.md's several "stop inventing numbers" fixes); not reintroducing it
 * here from a mockup that was drawn before the real API existed.
 */
export function ListingCard({ listing, onPress }: { listing: PublicListing; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.photo}>
        {listing.coverPhotoUrl ? (
          <Image source={{ uri: `${apiOrigin}${listing.coverPhotoUrl}` }} style={styles.photoImg} resizeMode="cover" />
        ) : (
          <Text style={styles.photoPlaceholder}>PHOTO</Text>
        )}
      </View>
      <View style={styles.body}>
        <Text style={[type.label, styles.title]} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={[type.caption, styles.location]} numberOfLines={1}>
          {listing.neighborhood}, {listing.city}
        </Text>
        <Text style={[type.price, styles.price]}>
          {Math.round(listing.priceRent).toLocaleString('fr-FR')} MAD/mois
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    backgroundColor: color.surfaceCard,
    borderWidth: 1,
    borderColor: color.borderHairline,
    overflow: 'hidden',
    boxShadow: shadow.xs,
  },
  pressed: { opacity: 0.92 },
  photo: {
    height: 160,
    backgroundColor: color.bgInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImg: { width: '100%', height: '100%' },
  photoPlaceholder: {
    fontFamily: font.uiMedium,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: color.textMuted,
  },
  body: { padding: 14, gap: 4 },
  title: { color: color.textHeading },
  location: { color: color.textMuted },
  price: { marginTop: 2 },
});
