import { StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/TopBar';
import { color, type } from '@/theme/tokens';

export default function MessagesScreen() {
  return (
    <View style={styles.screen}>
      <TopBar title="Messages" />
      <View style={styles.body}>
        <Text style={type.body}>Vos conversations arrivent avec le client API.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bgPage },
  body: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
});
