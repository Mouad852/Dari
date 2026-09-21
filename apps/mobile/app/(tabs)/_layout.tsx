import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';

import { Icon } from '@/components/Icon';
import { apiFetch } from '@/lib/api';
import { getIdToken, onAuthChange } from '@/lib/firebase';
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
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const refresh = async () => { const token = await getIdToken(); if (!token) return; try { const result = await apiFetch<{ unreadCount: number }>('/conversations/unread-count', { token }); setUnread(result.unreadCount); } catch { /* badge is best effort */ } };
    const unsubscribe = onAuthChange((user) => {
      if (interval) clearInterval(interval);
      if (!user) { setUnread(0); return; }
      void refresh();
      interval = setInterval(() => void refresh(), 15000);
    });
    return () => { unsubscribe(); if (interval) clearInterval(interval); };
  }, []);
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
          tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
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
