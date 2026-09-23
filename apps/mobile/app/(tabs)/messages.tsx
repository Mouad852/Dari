import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Button, TextButton } from '@/components/Button';
import { TopBar } from '@/components/TopBar';
import { apiFetch, ApiError, errorMessage } from '@/lib/api';
import { hasNetwork } from '@/lib/network';
import { getIdToken, onAuthChange } from '@/lib/firebase';
import { relativeTime } from '@/lib/format';
import { color, font, layout, radius, type } from '@/theme/tokens';
import type { Conversation, CursorPage } from '@/types/api';

const TONES = ['brand', 'sand', 'atlas'] as const;
function toneFor(userId: string): (typeof TONES)[number] { let hash = 0; for (let i = 0; i < userId.length; i += 1) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0; return TONES[hash % TONES.length]!; }
function avatarColors(tone: (typeof TONES)[number]) { if (tone === 'brand') return { bg: color.brandSubtle, fg: '#8B3E24' }; if (tone === 'sand') return { bg: '#F9E9CC', fg: '#7F521A' }; return { bg: '#EAF3EF', fg: '#245349' }; }

export default function MessagesScreen() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => onAuthChange((user) => setSignedIn(Boolean(user))), []);

  const load = useCallback(async (refresh = false) => {
    const token = await getIdToken();
    if (!token) return;
    if (!(await hasNetwork())) { setError('Vous êtes hors connexion. Réessayez quand le réseau sera disponible.'); return; }
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      const page = await apiFetch<CursorPage<Conversation>>('/conversations', { token });
      setConversations(page.items); setNextCursor(page.nextCursor);
    } catch (cause) { setError(errorMessage(cause, 'Impossible de charger vos conversations.')); }
    finally { if (refresh) setRefreshing(false); }
  }, []);
  useEffect(() => { if (signedIn) void load(); else setConversations(null); }, [signedIn, load]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const token = await getIdToken(); if (!token) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<CursorPage<Conversation>>(`/conversations?cursor=${encodeURIComponent(nextCursor)}`, { token });
      setConversations((previous) => [...(previous ?? []), ...page.items]); setNextCursor(page.nextCursor);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'INVALID_CURSOR') await load(true);
      else setError(errorMessage(cause, 'Impossible de charger la suite.'));
    } finally { setLoadingMore(false); }
  }, [load, loadingMore, nextCursor]);

  if (signedIn === false) return <View style={styles.screen}><TopBar title="Messages" /><View style={styles.centerBox}><Text style={[type.body, styles.centerText]}>Connectez-vous pour voir vos conversations.</Text><Button onPress={() => router.push('/sign-in')}>Se connecter</Button></View></View>;
  return <View style={styles.screen}><TopBar title="Messages" />
    {error && <View style={styles.errorBox}><Text style={[type.bodySm, styles.error]}>{error}</Text><TextButton onPress={() => void load(true)}>Réessayer</TextButton></View>}
    {!error && conversations === null && <View style={styles.centerBox}><ActivityIndicator color={color.brand} /></View>}
    {!error && conversations !== null && conversations.length === 0 && <View style={styles.centerBox}><Text style={type.body}>Aucune conversation pour le moment.</Text></View>}
    {conversations && conversations.length > 0 && <FlatList<Conversation>
      data={conversations} keyExtractor={(item) => item.id} onEndReachedThreshold={0.4} onEndReached={() => void loadMore()}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={color.brand} />}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={color.brand} /> : null}
      renderItem={({ item }) => { const { bg, fg } = avatarColors(toneFor(item.otherUserId)); const unread = item.unreadCount > 0; return <Pressable onPress={() => router.push({ pathname: '/messages/[id]', params: { id: item.id } })} accessibilityRole="button" accessibilityLabel={`Conversation avec ${item.otherUserDisplayName}`} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <View style={[styles.avatar, { backgroundColor: bg }]}><Text style={[styles.avatarText, { color: fg }]}>{item.otherUserDisplayName.charAt(0).toUpperCase()}</Text></View>
        <View style={styles.rowBody}><View style={styles.rowTop}><Text style={[type.label, unread && { fontFamily: font.uiBold }]} numberOfLines={1}>{item.otherUserDisplayName}</Text>{item.lastMessageAt && <Text style={[type.caption, { color: color.textMuted }]}>{relativeTime(new Date(item.lastMessageAt))}</Text>}</View><View style={styles.rowBottom}><Text style={[type.bodySm, { flex: 1, color: unread ? color.textHeading : color.textMuted, fontFamily: unread ? font.uiSemibold : font.uiRegular }]} numberOfLines={1}>{item.lastMessage ?? 'Nouvelle conversation'}</Text>{unread && <View style={styles.badge}><Text style={styles.badgeText}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text></View>}</View></View>
      </Pressable>; }}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />}
  </View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: color.bgPage }, centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: layout.gutterMobile }, centerText: { textAlign: 'center' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: layout.gutterMobile, backgroundColor: color.surfaceCard }, rowPressed: { opacity: 0.85 }, avatar: { width: 44, height: 44, borderRadius: radius.avatar, alignItems: 'center', justifyContent: 'center' }, avatarText: { fontFamily: font.uiBold, fontSize: 16 }, rowBody: { flex: 1, gap: 2 }, rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }, rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 }, badge: { minWidth: 18, height: 18, borderRadius: radius.pill, backgroundColor: color.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }, badgeText: { color: '#fff', fontFamily: font.uiBold, fontSize: 10 }, separator: { height: 1, backgroundColor: color.borderHairline }, footer: { marginVertical: 16 }, errorBox: { padding: 16, gap: 8, backgroundColor: color.dangerSubtle }, error: { color: color.danger },
});
