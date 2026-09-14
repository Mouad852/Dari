import { StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/TopBar';
import { color, type } from '@/theme/tokens';

export default function ProfileScreen() {
  return (
    <View style={styles.screen}>
      <TopBar title="Profil" />
      <View style={styles.body}>
        <Text style={type.body}>Le compte et l’authentification arrivent ensuite.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bgPage },
  body: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
});
