import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { color, layout, type } from '@/theme/tokens';

/**
 * Ported from `AppShell.jsx`'s `TopBar` (`design-system/ui_kits/mobile_app/`):
 * a title, an optional back chevron, and an optional trailing action slot.
 * `Stack`'s native header is turned off globally (`app/_layout.tsx`) so
 * every screen renders one of these instead, matching the kit and the web
 * app's own custom-drawn `SiteNav` rather than the platform default.
 */
export function TopBar({ title, onBack, action }: { title: string; onBack?: () => void; action?: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top, height: layout.navHMobile + insets.top }]}>
      {onBack && (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8} style={styles.back}>
          <Icon name="chevron-left" size={24} color={color.textHeading} />
        </Pressable>
      )}
      <Text style={[type.h2, styles.title]} numberOfLines={1}>
        {title}
      </Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: layout.gutterMobile,
    backgroundColor: color.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: color.borderHairline,
  },
  back: {
    width: layout.tapMin,
    height: layout.tapMin,
    marginLeft: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
  },
});
