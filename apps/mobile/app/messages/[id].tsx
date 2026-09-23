import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
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
import { apiFetch, ApiError, errorMessage, reportUnexpected } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { hasNetwork } from '@/lib/network';
import { clockTime, dayLabel } from '@/lib/format';
import { mergeMessages } from '@/lib/messages';
import { color, font, radius } from '@/theme/tokens';
import type { Conversation, CursorPage, Message } from '@/types/api';

/**
 * Real send, real history, real mark-read, and the same 5 s poll as the web
 * thread for new replies and read receipts -- without the web page's
 * optimistic-send placeholder. The thread opens on its newest page; older
 * pages load above. Router exposes `id` as `string | string[]` for a `[id]`
 * segment -- normalized once at the top rather than asserted at every call
 * site below.
 */
const SIGN_IN_REQUIRED = 'Connectez-vous pour voir cette conversation.';

export default function ConversationScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0]! : params.id;

  const [token, setToken] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by "Réessayer", which re-runs the load.
  const [reloadKey, setReloadKey] = useState(0);
  // Set while the poll keeps failing: new replies are not arriving, and the reader should know.
  const [pollError, setPollError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  // The newest message this screen has *fetched*. Never one it just sent: see the poll.
  const anchorRef = useRef<string | null>(null);
  const sendingRef = useRef(false);
  const atBottomRef = useRef(true);
  // Scroll to the end on the next content change: on opening, after sending,
  // and for a reply that arrives while the reader is already at the end.
  const followRef = useRef(true);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    let isCurrent = true;
    setError(null);
    (async () => {
      const idToken = await getIdToken();
      if (!idToken) {
        if (isCurrent) setError(SIGN_IN_REQUIRED);
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
        anchorRef.current = page.items.at(-1)?.id ?? null;
        followRef.current = true;
        setMessages(page.items);
        setNextCursor(page.nextCursor ?? null);
        void apiFetch(`/conversations/${encodeURIComponent(id)}/read`, { method: 'PATCH', token: idToken }).catch(() => {});
      } catch (cause) {
        if (isCurrent) setError(errorMessage(cause, 'Impossible de charger cette conversation.'));
        reportUnexpected(cause, 'thread');
      }
    })();
    return () => {
      isCurrent = false;
    };
  }, [id, reloadKey]);

  /**
   * The thread's poll, every 5 s while the app is in the foreground, and at
   * once when it comes back: messages `after=` the newest one this screen has
   * fetched, then the conversation summary for "Vu". Nothing runs while the
   * app is in the background.
   *
   * The anchor is only ever a message that came from a GET, never one just
   * sent: a reply written a moment before one's own message is newer than the
   * anchor, so it still arrives. No poll runs while a send is in flight, so
   * the sent message cannot land twice.
   */
  useEffect(() => {
    if (!token || !myId) return;
    let isCurrent = true;
    let polling = false;
    const threadPath = `/conversations/${encodeURIComponent(id)}`;

    const fetchNewer = async () => {
      let anchor = anchorRef.current;
      // Bounded: each round is one page at most.
      for (let round = 0; round < 5; round += 1) {
        const requestedAfter = anchor;
        let page: CursorPage<Message>;
        try {
          page = await apiFetch<CursorPage<Message>>(`${threadPath}/messages${requestedAfter ? `?after=${encodeURIComponent(requestedAfter)}` : ''}`, { token });
        } catch (cause) {
          // The anchor is no longer a visible message: start over from the newest page.
          if (requestedAfter && cause instanceof ApiError && cause.code === 'INVALID_CURSOR') { anchor = null; continue; }
          throw cause;
        }
        if (!isCurrent) return;
        const last = page.items.at(-1);
        if (last) {
          anchor = last.id;
          anchorRef.current = last.id;
          followRef.current = atBottomRef.current;
          setMessages((previous) => mergeMessages(previous ?? [], page.items, 'newer'));
          // Seen on an open thread in the foreground: read, as on opening it.
          if (page.items.some((message) => message.senderId !== myId)) {
            void apiFetch(`${threadPath}/read`, { method: 'PATCH', token }).catch(() => {});
          }
        }
        // Without an anchor this was the newest page, whose hasMore means *older*.
        if (!requestedAfter || !page.hasMore) return;
      }
    };

    const poll = async () => {
      if (polling || sendingRef.current || AppState.currentState !== 'active') return;
      polling = true;
      try {
        await fetchNewer();
        const fresh = await apiFetch<Conversation>(threadPath, { token });
        if (!isCurrent) return;
        setPollError(null);
        if (!fresh.lastMessageId || !fresh.lastMessageReadAt) return;
        setMessages((previous) => (previous ?? []).map((message) => message.id === fresh.lastMessageId ? { ...message, readAt: fresh.lastMessageReadAt } : message));
      } catch (cause) {
        // Retried by the next cycle a few seconds later; said meanwhile.
        if (isCurrent) setPollError(errorMessage(cause, 'Actualisation impossible pour le moment.'));
        reportUnexpected(cause, 'thread-poll');
      } finally {
        polling = false;
      }
    };

    const interval = setInterval(() => void poll(), 5000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void poll(); });
    return () => {
      isCurrent = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, [id, token, myId]);

  async function loadMore() {
    if (!nextCursor || !token || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<CursorPage<Message>>(`/conversations/${encodeURIComponent(id)}/messages?cursor=${encodeURIComponent(nextCursor)}`, { token });
      // Older messages go above; maintainVisibleContentPosition keeps the reader where they were.
      setMessages((previous) => mergeMessages(previous ?? [], page.items, 'older'));
      setNextCursor(page.nextCursor ?? null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'INVALID_CURSOR') setNextCursor(null);
      setSendError(errorMessage(cause, 'Impossible de charger les anciens messages.'));
    } finally { setLoadingMore(false); }
  }

  async function handleSend() {
    const value = draft.trim();
    if (!value || !token || sending) return;
    if (!(await hasNetwork())) { setSendError('Vous êtes hors connexion. Le brouillon est conservé.'); return; }
    setSending(true);
    sendingRef.current = true;
    setSendError(null);
    try {
      const sent = await apiFetch<Message>(`/conversations/${encodeURIComponent(id)}/messages`, {
        method: 'POST',
        token,
        body: { body: value },
      });
      followRef.current = true;
      setMessages((prev) => mergeMessages(prev ?? [], [sent], 'newer'));
      setDraft('');
    } catch (cause) {
      setSendError(errorMessage(cause, 'Le message n’a pas pu être envoyé.'));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <TopBar title="Conversation" onBack={() => router.back()} />
        <View style={styles.centerScreen}>
          <Text style={{ color: color.danger, textAlign: 'center' }} accessibilityLiveRegion="assertive">{error}</Text>
          {error === SIGN_IN_REQUIRED
            ? <TextButton onPress={() => router.push('/sign-in')}>Se connecter</TextButton>
            : <TextButton onPress={() => setReloadKey((key) => key + 1)}>Réessayer</TextButton>}
        </View>
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
      {pollError && <Text style={styles.pollError} accessibilityLiveRegion="polite">{pollError} Les nouveaux messages s’afficheront dès que possible.</Text>}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        // Older messages load above: keep the first visible one in place.
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        ListHeaderComponent={nextCursor ? <Pressable onPress={() => void loadMore()} disabled={loadingMore} accessibilityRole="button" style={styles.loadMore}><Text style={styles.loadMoreText}>{loadingMore ? 'Chargement…' : 'Charger les messages précédents'}</Text></Pressable> : null}
        scrollEventThrottle={100}
        onScroll={(event) => {
          const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
          atBottomRef.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;
        }}
        onContentSizeChange={() => {
          if (!followRef.current) return;
          followRef.current = false;
          listRef.current?.scrollToEnd({ animated: hasScrolledRef.current });
          hasScrolledRef.current = true;
          atBottomRef.current = true;
        }}
        // The keyboard or the composer growing shrinks the list: a reader at the end stays there.
        onLayout={() => { if (atBottomRef.current) listRef.current?.scrollToEnd({ animated: false }); }}
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
  centerScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: color.bgPage, padding: 20 },
  pollError: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: color.warningSubtle, color: color.textBody, fontFamily: font.uiRegular, fontSize: 12 },
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
