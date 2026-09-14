import { Tabs } from 'expo-router';

import { Icon } from '@/components/Icon';
import { color, font, layout } from '@/theme/tokens';

/**
 * Explorer / Favoris / Messages / Profil, verbatim from the mobile UI kit's
 * `AppShell.jsx` `TABS` array (`design-system/ui_kits/mobile_app/`) -- same
 * four tabs, same icons, same order the web app's own `SiteNav.tsx` mobile
 * bottom bar already ported from the same source. `@react-navigation/
 * bottom-tabs` (which `expo-router`'s `Tabs` wraps) handles the safe-area
 * bottom inset itself, unlike the web version which had to compute and
 * reserve it by hand.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.brand,
        tabBarInactiveTintColor: color.textSubtle,
        tabBarStyle: {
          height: layout.tabbarH,
          backgroundColor: color.surfaceCard,
          borderTopColor: color.borderHairline,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontFamily: font.uiMedium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explorer',
          tabBarIcon: ({ color: tint, size }) => <Icon name="search" size={size} color={tint as string} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favoris',
          tabBarIcon: ({ color: tint, size }) => <Icon name="heart" size={size} color={tint as string} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color: tint, size }) => <Icon name="message-circle" size={size} color={tint as string} />,
          // Wired to the real unread count once the API client and auth land
          // -- see TODO.md's React Native entry.
          tabBarBadge: undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color: tint, size }) => <Icon name="user-round" size={size} color={tint as string} />,
        }}
      />
    </Tabs>
  );
}
