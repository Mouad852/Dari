import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '@/components/Icon';
import { TextButton } from '@/components/Button';
import { TopBar } from '@/components/TopBar';
import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { hasNetwork } from '@/lib/network';
import { clockTime, dayLabel } from '@/lib/format';
import { color, font, radius } from '@/theme/tokens';
import type { Conversation, CursorPage, Message } from '@/types/api';

/**
 * Real send, real history, real mark-read -- deliberately without the web
 * thread page's read-receipt poll or optimistic-send placeholder yet
 * (those are real, tested features there, but porting them is its own
 * pass, not a rider on "does a real message thread work at all"). Router
 * exposes `id` as `string | string[]` for a `[id]` segment -- normalized
 * once at the top rather than asserted at every call site below.
 */
export default function ConversationScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0]! : params.id;

  const [token, setToken] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    let isCurrent = true;
    (async () => {
      const idToken = await getIdToken();
      if (!idToken) {
        if (isCurrent) setError('Connectez-vous pour voir cette conversation.');
        return;
      }
      try {
        const [me, thread, page] = await Promise.all([
          apiFetch<{ id: string }>('/users/me', { token: idToken }),
          apiFetch<Conversation>(`/conversations/${encodeURIComponent(id)}`, { token: idToken }),
          apiFetch<CursorPage<Message>>(`/conversations/${encodeURIComponent(id)}/messages`, { token: idToken }),
        ]);
        if (!isCurrent) return;
        setToken(idToken);
        setMyId(me.id);
        setConversation(thread);
        setMessages(page.items);
        setNextCursor(page.nextCursor);
        void apiFetch(`/conversations/${encodeURIComponent(id)}/read`, { method: 'PATCH', token: idToken }).catch(() => {});
      } catch (cause) {
        if (isCurrent) setError(cause instanceof ApiError ? cause.message : 'Impossible de charger cette conversation.');
      }
    })();
    return () => {
      isCurrent = false;
    };
  }, [id]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      void apiFetch<Conversation>(`/conversations/${encodeURIComponent(id)}`, { token }).then((fresh) => {
        if (!fresh.lastMessageId || !fresh.lastMessageReadAt) return;
        setMessages((previous) => (previous ?? []).map((message) => message.id === fresh.lastMessageId ? { ...message, readAt: fresh.lastMessageReadAt } : message));
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [id, token]);

  async function loadMore() {
    if (!nextCursor || !token || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<CursorPage<Message>>(`/conversations/${encodeURIComponent(id)}/messages?cursor=${encodeURIComponent(nextCursor)}`, { token });
      setMessages((previous) => [...(previous ?? []), ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'INVALID_CURSOR') setNextCursor(null);
      setSendError(cause instanceof ApiError ? cause.message : 'Impossible de charger les anciens messages.');
    } finally { setLoadingMore(false); }
  }

  async function handleSend() {
    const value = draft.trim();
    if (!value || !token || sending) return;
    if (!(await hasNetwork())) { setSendError('Vous êtes hors connexion. Le brouillon est conservé.'); return; }
    setSending(true);
    setSendError(null);
    try {
      const sent = await apiFetch<Message>(`/conversations/${encodeURIComponent(id)}/messages`, {
        method: 'POST',
        token,
        body: { body: value },
      });
      setMessages((prev) => [...(prev ?? []), sent]);
      setDraft('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (cause) {
      setSendError(cause instanceof ApiError ? cause.message : 'Le message n’a pas pu être envoyé.');
    } finally {
      setSending(false);
    }
  }

  if (error) {
    return (
      <View style={styles.centerScreen}>
        <Text style={{ color: color.danger, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  if (!conversation || !messages || !myId) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color={color.brand} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar title={conversation.otherUserDisplayName} onBack={() => router.back()} action={<TextButton onPress={() => router.push({ pathname: '/report' as never, params: { targetType: 'USER', targetId: conversation.otherUserId } })}>Signaler</TextButton>} />
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListFooterComponent={nextCursor ? <Pressable onPress={() => void loadMore()} disabled={loadingMore} style={styles.loadMore}><Text style={styles.loadMoreText}>{loadingMore ? 'Chargement…' : 'Charger les messages suivants'}</Text></Pressable> : null}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item, index }) => {
          const mine = item.senderId === myId;
          const sentAt = new Date(item.sentAt);
          const previous = messages[index - 1];
          const newDay = !previous || new Date(previous.sentAt).toDateString() !== sentAt.toDateString();
          return (
            <View>
              {newDay && <Text style={styles.daySeparator}>{dayLabel(sentAt)}</Text>}
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.body}</Text>
                <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>{clockTime(sentAt)}</Text>
                {mine && item.readAt && <Text style={styles.readReceipt}>Vu</Text>}
              </View>
            </View>
          );
        }}
      />
      <View style={styles.composer}>
        {/*
          A bare TextInput, not TextField: that component always renders its
          uppercase caption label, which has nothing to attach to in a pill-
          shaped composer bar -- same reasoning as the web app's own thread
          page, which reaches for a plain <input> rather than its shared
          Input component here for the identical reason.
        */}
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Écrire un message…"
          placeholderTextColor={color.textMuted}
          style={styles.composerInput}
          multiline
        />
        <Pressable
          onPress={() => void handleSend()}
          disabled={sending || !draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Envoyer"
          style={[styles.sendButton, (sending || !draft.trim()) && styles.sendButtonDisabled]}
        >
          {sending ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="send" size={18} color="#fff" />}
        </Pressable>
      </View>
      {sendError && <View style={styles.sendError}><Text style={styles.sendErrorText}>{sendError}</Text><Pressable onPress={() => void handleSend()} disabled={!draft.trim() || sending}><Text style={styles.retryText}>Réessayer</Text></Pressable></View>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bgPage },
  centerScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bgPage, padding: 20 },
  list: { padding: 16, gap: 8 },
  daySeparator: {
    alignSelf: 'center',
    backgroundColor: color.bgInset,
    color: color.textBody,
    fontFamily: font.uiMedium,
    fontSize: 12,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginVertical: 8,
  },
  bubble: { maxWidth: '78%', borderRadius: radius.md, padding: 12, marginBottom: 8 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: color.brand, borderBottomRightRadius: radius.xs },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: color.surfaceCard, borderWidth: 1, borderColor: color.borderHairline, borderBottomLeftRadius: radius.xs },
  bubbleTextMine: { color: color.textOnBrand, fontFamily: font.uiRegular, fontSize: 15, lineHeight: 21 },
  bubbleTextTheirs: { color: color.textBody, fontFamily: font.uiRegular, fontSize: 15, lineHeight: 21 },
  bubbleTime: { fontFamily: font.uiMedium, fontSize: 11, marginTop: 4, textAlign: 'right' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.8)' },
  bubbleTimeTheirs: { color: color.textMuted },
  readReceipt: { color: 'rgba(255,255,255,0.8)', fontFamily: font.uiMedium, fontSize: 11, textAlign: 'right', marginTop: 2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, backgroundColor: color.surfaceCard, borderTopWidth: 1, borderTopColor: color.borderHairline },
  composerInput: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: color.borderDefault,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceCard,
    color: color.textHeading,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontFamily: font.uiRegular,
    fontSize: 15,
  },
  loadMore: { alignSelf: 'center', padding: 12 },
  loadMoreText: { color: color.brand, fontFamily: font.uiSemibold, fontSize: 13 },
  sendError: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: color.dangerSubtle },
  sendErrorText: { flex: 1, color: color.danger, fontFamily: font.uiRegular, fontSize: 12 },
  retryText: { color: color.brand, fontFamily: font.uiSemibold, fontSize: 12 },
  sendButton: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: color.brand, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
});
