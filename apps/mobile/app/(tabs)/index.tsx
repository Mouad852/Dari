import { StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/TopBar';
import { color, type } from '@/theme/tokens';

/**
 * Explorer / feed screen -- stub for now. Real content (search header,
 * filter chip row, profile-completion prompt, listing feed, per
 * `FeedScreen.jsx`) lands once the API client exists to fetch real
 * listings from; a fabricated feed here would be exactly the kind of
 * invented-data gap this project has spent real effort removing elsewhere.
 */
export default function FeedScreen() {
  return (
    <View style={styles.screen}>
      <TopBar title="Explorer" />
      <View style={styles.body}>
        <Text style={type.body}>Le fil d’annonces arrive avec le client API.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bgPage },
  body: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
});
