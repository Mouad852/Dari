import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/TopBar';
import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken, onAuthChange } from '@/lib/firebase';
import { relativeTime } from '@/lib/format';
import { color, font, layout, radius, type } from '@/theme/tokens';
import type { Conversation, CursorPage } from '@/types/api';

const TONES = ['brand', 'sand', 'atlas'] as const;

/** Deterministic avatar tint, keyed to the other participant -- ported from apps/web's own messages inbox for the same reasoning (see that file's comment). */
function toneFor(userId: string): (typeof TONES)[number] {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length]!;
}

function avatarColors(tone: (typeof TONES)[number]) {
  if (tone === 'brand') return { bg: color.brandSubtle, fg: '#8B3E24' };
  if (tone === 'sand') return { bg: '#F9E9CC', fg: '#7F521A' };
  return { bg: '#EAF3EF', fg: '#245349' };
}

export default function MessagesScreen() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAuthChange((user) => setSignedIn(Boolean(user))), []);

  const load = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    try {
      const page = await apiFetch<CursorPage<Conversation>>('/conversations', { token });
      setConversations(page.items);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Impossible de charger vos conversations.');
    }
  }, []);

  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn, load]);

  if (signedIn === false) {
    return (
      <View style={styles.screen}>
        <TopBar title="Messages" />
        <View style={styles.centerBox}>
          <Text style={[type.body, { textAlign: 'center' }]}>Connectez-vous pour voir vos conversations.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TopBar title="Messages" />
      {error && (
        <View style={styles.centerBox}>
          <Text style={[type.body, { color: color.danger, textAlign: 'center' }]}>{error}</Text>
        </View>
      )}
      {!error && conversations === null && (
        <View style={styles.centerBox}>
          <ActivityIndicator color={color.brand} />
        </View>
      )}
      {!error && conversations !== null && conversations.length === 0 && (
        <View style={styles.centerBox}>
          <Text style={type.body}>Aucune conversation pour le moment.</Text>
        </View>
      )}
      {!error && conversations !== null && conversations.length > 0 && (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const { bg, fg } = avatarColors(toneFor(item.otherUserId));
            const unread = item.unreadCount > 0;
            return (
              <Pressable
                onPress={() => router.push({ pathname: '/messages/[id]', params: { id: item.id } })}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={[styles.avatar, { backgroundColor: bg }]}>
                  <Text style={[styles.avatarText, { color: fg }]}>{item.otherUserDisplayName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={[type.label, unread && { fontFamily: font.uiBold }]} numberOfLines={1}>
                      {item.otherUserDisplayName}
                    </Text>
                    {item.lastMessageAt && (
                      <Text style={[type.caption, { color: color.textMuted }]}>{relativeTime(new Date(item.lastMessageAt))}</Text>
                    )}
                  </View>
                  <View style={styles.rowBottom}>
                    <Text
                      style={[type.bodySm, { flex: 1, color: unread ? color.textHeading : color.textMuted, fontFamily: unread ? font.uiSemibold : font.uiRegular }]}
                      numberOfLines={1}
                    >
                      {item.lastMessage ?? 'Nouvelle conversation'}
                    </Text>
                    {unread && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bgPage },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: layout.gutterMobile },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: layout.gutterMobile, backgroundColor: color.surfaceCard },
  rowPressed: { opacity: 0.85 },
  avatar: { width: 44, height: 44, borderRadius: radius.avatar, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.uiBold, fontSize: 16 },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontFamily: font.uiBold, fontSize: 10 },
  separator: { height: 1, backgroundColor: color.borderHairline },
});
