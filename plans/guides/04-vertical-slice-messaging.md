# Guide — Phase 04: Messaging + the Firestore decision

Implementation guide for [`04-vertical-slice-messaging.md`](../04-vertical-slice-messaging.md).

**Read §0 before writing anything.** Half this guide is contingent on a decision that has not been made.

---

## 0. The decision, and a recommendation

The design doc describes messaging as five REST endpoints over Postgres. It never mentions Firestore, realtime, websockets, or mirroring. You named mirroring as a risk, so this guide covers both branches.

**Recommendation: ship REST-only first (§1–§3), then add the mirror (§4–§6) as a separate step — but build the outbox now.**

The reasoning: the mirror's cost is not the code, it is the permanent operational surface — a second datastore with its own billing, SDK, security-rules language and failure modes, run by one person. The user-visible gain is the difference between a message arriving instantly and arriving within a few seconds. At MVP volume, short-interval polling is genuinely adequate and costs nothing to operate.

But **the outbox table is cheap to add now and expensive to retrofit**, because retrofitting means backfilling every message written before it existed. Write messages to an outbox from day one, leave the publisher unimplemented, and the mirror becomes a contained addition rather than a migration.

Take the decision, then delete the branch you did not choose from this file.

| | REST-only + polling | REST + Firestore mirror |
| --- | --- | --- |
| Latency | 3–10s | Sub-second |
| Operational surface | One datastore | Two, plus security rules |
| Failure mode | Slower delivery | Silent drift |
| Mobile (phase 11) | Needs push anyway | Firestore SDK path is well-trodden |
| Cost | Included | Per read; every open thread is a live listener |

---

## 1. Schema

`V6__messaging.sql`:

```sql
CREATE TABLE conversations (
    id               UUID PRIMARY KEY,
    listing_id       UUID REFERENCES listings(id),   -- nullable: outlives its listing (§3)
    participant_a_id UUID NOT NULL REFERENCES users(id),
    participant_b_id UUID NOT NULL REFERENCES users(id),
    last_message_at  TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (participant_a_id <> participant_b_id),
    CHECK (participant_a_id <  participant_b_id)     -- canonical ordering, see below
);

-- One conversation per (listing, participant pair). COALESCE gives listing-less
-- conversations a stable key so the constraint still applies to them.
CREATE UNIQUE INDEX idx_conversations_unique
    ON conversations (COALESCE(listing_id, '00000000-0000-0000-0000-000000000000'::uuid),
                      participant_a_id, participant_b_id);

CREATE INDEX idx_conversations_participant_a ON conversations (participant_a_id, last_message_at DESC);
CREATE INDEX idx_conversations_participant_b ON conversations (participant_b_id, last_message_at DESC);

CREATE TABLE messages (
    id              UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    sender_id       UUID NOT NULL REFERENCES users(id),
    body            TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at         TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ                       -- soft-delete on ban (§6)
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id, sent_at DESC, id DESC);
CREATE INDEX idx_messages_unread
    ON messages (conversation_id) WHERE read_at IS NULL AND deleted_at IS NULL;
```

Two choices worth explaining:

**`CHECK (participant_a_id < participant_b_id)`.** Without a canonical ordering, (Alice, Bob) and (Bob, Alice) are different rows and the uniqueness constraint does nothing. Sort the pair before insert:

```java
UUID a = userA.compareTo(userB) < 0 ? userA : userB;
UUID b = userA.compareTo(userB) < 0 ? userB : userA;
```

**`last_message_at` is denormalised** onto conversations. The thread list sorts by most recent activity; without it that is a correlated subquery per row on the busiest screen in the app.

---

## 2. Authorization

Every messaging route is participant-only. Do it once, in a helper, not per endpoint:

```java
private Conversation requireParticipant(UUID conversationId, User user) {
    var c = conversations.findById(conversationId)
            .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Conversation introuvable"));
    if (!c.getParticipantAId().equals(user.getId()) && !c.getParticipantBId().equals(user.getId()))
        throw new ApiException(404, ErrorCode.NOT_FOUND, "Conversation introuvable");
    return c;
}
```

**404, not 403.** A 403 confirms the conversation exists, which leaks the existence of a thread between two other people.

Write the negative test first. Authorization bugs in messaging are the kind that end up in a news story.

---

## 3. Endpoints

```
GET   /api/v1/conversations                  thread list, sorted by last_message_at
POST  /api/v1/conversations                  {listingId, message} — idempotent
GET   /api/v1/conversations/{id}/messages    cursor-paginated, newest first
POST  /api/v1/conversations/{id}/messages    send
PATCH /api/v1/conversations/{id}/read        mark read up to now
```

### Creating a conversation

`POST /conversations` is where a seeker first contacts an owner, from the contact dialog. It must be **idempotent** — the same pair contacting about the same listing twice returns the existing thread, never a duplicate:

```java
@Transactional
public ConversationResponse startOrGet(User initiator, StartConversationRequest req) {
    var listing = publishedListings.findById(req.listingId())
            .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));

    if (listing.getOwnerId().equals(initiator.getId()))
        throw new ApiException(400, ErrorCode.SELF_CONVERSATION,
                "Vous ne pouvez pas contacter votre propre annonce");

    var pair = ParticipantPair.of(initiator.getId(), listing.getOwnerId());
    var conversation = conversations
            .findByListingAndParticipants(listing.getId(), pair.a(), pair.b())
            .orElseGet(() -> conversations.save(Conversation.create(listing, pair)));

    sendMessage(conversation, initiator, req.message());
    return ConversationResponse.of(conversation);
}
```

Note it resolves the listing through `publishedListings` — you cannot open a new conversation about an unpublished listing. Existing threads about a listing that later becomes unavailable stay open; that is §4's rule and it is different from this one.

### Listings that go unavailable

Per §4, a suspended or expired listing does not lock its conversations — but the thread must show it:

```java
public record ConversationListingContext(
        UUID id, String title, String neighborhood, String city,
        BigDecimal priceRent,
        boolean available,        // status=PUBLISHED && availability=AVAILABLE
        String unavailableLabel   // "Annonce suspendue" / "Annonce expirée" / "Chambre trouvée"
) {}
```

Resolve this from the `listings` table, not the `published_listings` view — this is one of the few legitimate reasons to read the table directly, and it deserves a comment saying so.

### Pagination

Reuse the phase 02 cursor encoder. Messages are `(sent_at DESC, id DESC)`, the same shape as the recency branch.

---

## 4. The outbox — build this even in the REST-only branch

`V7__message_outbox.sql`:

```sql
CREATE TABLE message_outbox (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id   UUID        NOT NULL REFERENCES messages(id),
    payload      JSONB       NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    attempts     INT         NOT NULL DEFAULT 0,
    last_error   TEXT
);

CREATE INDEX idx_outbox_unpublished
    ON message_outbox (created_at) WHERE published_at IS NULL;
```

The insert happens **in the same transaction as the message**:

```java
@Transactional
public Message sendMessage(Conversation c, User sender, String body) {
    var message = messages.save(Message.create(c, sender, body));
    c.setLastMessageAt(message.getSentAt());
    outbox.save(MessageOutboxEntry.of(message));      // same transaction — this is the point
    return message;
}
```

This is what makes the mirror safe. A post-commit hook loses the event if the process dies between commit and publish; an outbox row commits atomically with the message, so the publisher can crash freely and pick up where it left off.

In the REST-only branch, leave the publisher unimplemented and add a job that prunes rows older than a few days. The table costs almost nothing and buys the option.

---

## 5. Firestore mirror — only if chosen

### Document layout

```
conversations/{conversationId}
  participants: [uidA, uidB]        // Firebase UIDs, not internal ids — rules match on these
  listingId, lastMessageAt, lastMessagePreview

conversations/{conversationId}/messages/{messageId}
  senderId, body, sentAt, readAt
```

Participants are stored as **Firebase UIDs** because security rules can only compare against `request.auth.uid`. That means the mirror needs the UID, so carry it in the outbox payload rather than looking it up at publish time.

### Security rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /conversations/{conversationId} {
      allow read: if request.auth != null
                  && request.auth.uid in resource.data.participants;
      allow write: if false;                     // server only, always

      match /messages/{messageId} {
        allow read: if request.auth != null
                    && request.auth.uid in
                       get(/databases/$(db)/documents/conversations/$(conversationId))
                         .data.participants;
        allow write: if false;                   // server only, always
      }
    }
  }
}
```

`allow write: if false` everywhere is the whole architecture in one line. Clients send messages through `POST /conversations/{id}/messages` so that authorization, ban checks and moderation live in exactly one place. The moment a client can write to Firestore directly, every rule in the backend has to be duplicated in the rules language and kept in sync — which it will not be.

### Publisher

```java
@Scheduled(fixedDelay = 1000)
@Transactional
public void publishPending() {
    var batch = outbox.findUnpublished(PageRequest.of(0, 100));   // FOR UPDATE SKIP LOCKED
    for (var entry : batch) {
        try {
            firestore.document(pathFor(entry)).set(entry.getPayload()).get(5, SECONDS);
            entry.setPublishedAt(Instant.now());
        } catch (Exception e) {
            entry.setAttempts(entry.getAttempts() + 1);
            entry.setLastError(truncate(e.getMessage(), 500));
            // exponential backoff; alert past ~10 attempts
        }
    }
}
```

`FOR UPDATE SKIP LOCKED` matters if you ever run two instances. Without it both publish the same rows.

### Reconciliation — the part that actually matters

The risk is not Firestore being down. It is **silent drift**: the mirror subtly wrong while the UI reads the mirror, so nobody notices.

```java
@Scheduled(cron = "0 */15 * * * *")
public void detectDrift() {
    // For conversations touched in the last hour, compare Postgres message count
    // and latest sent_at against Firestore. Emit a gauge; repair from Postgres.
    meterRegistry.gauge("messaging.mirror.drift_count", driftedConversations.size());
}
```

Alert on the gauge. A drift metric nobody looks at is not monitoring.

### Deliberate failure test

```java
@Test void mirrorFailureLeavesPostgresCorrectAndSelfHeals() {
    firestoreStub.failNext(3);
    var sent = sendMessage(conversation, alice, "Bonjour");

    assertThat(messages.findById(sent.getId())).isPresent();      // Postgres correct
    assertThat(outbox.findUnpublished()).hasSize(1);              // event durable

    firestoreStub.recover();
    publisher.publishPending();
    assertThat(firestoreStub.get(path(sent))).isNotNull();        // converged
}
```

### Soft-delete must reach the mirror

Phase 06 soft-deletes a banned user's messages. If that only applies to Postgres, the content stays live in Firestore — exactly the drift that matters. Route deletions through the outbox as tombstone events, and test it.

---

## 6. Frontend

Port from `design-system/ui_kits/mobile_app/MessagesScreen.jsx` — thread list, conversation view with the listing context card, composer. The web contact dialog is in `ui_kits/website/index.html`: dialog → *Envoyer* → success toast (*"Message envoyé à Nadia"*).

**Optimistic send**, since a message that appears only after a round-trip feels broken:

```tsx
function useSendMessage(conversationId: string) {
  return useMutation({
    mutationFn: (body: string) => api.post(`/conversations/${conversationId}/messages`, { body }),
    onMutate: async (body) => {
      const optimistic = { id: `pending-${crypto.randomUUID()}`, body, pending: true,
                           sentAt: new Date().toISOString() };
      // insert immediately; reconcile or mark failed on settle
    },
  });
}
```

Give a failed send a visible retry rather than a silent disappearance.

Read path depends on the branch: subscribe to the Firestore subcollection, or poll `GET /messages` every 5s while the thread is focused and stop when it is not. Either way keep it behind one hook so the choice is swappable:

```tsx
const messages = useMessages(conversationId);   // hides Firestore-vs-polling entirely
```

---

## 7. Tests

| Test | Asserts |
| --- | --- |
| Two users converse | End to end, both directions |
| Non-participant hits every route | 404 on all five |
| `POST /conversations` twice, same pair + listing | One conversation, two messages |
| Contact own listing | 400 `SELF_CONVERSATION` |
| (Alice,Bob) then (Bob,Alice) | Same conversation row |
| Listing suspended mid-thread | Thread readable, `available: false`, label correct |
| Message pagination with identical `sent_at` | No rows lost |
| Banned user's messages | Soft-deleted, hidden, present in DB — and in the mirror if it exists |
| **Mirror:** publisher fails 3× then recovers | Postgres correct throughout, mirror converges |
| **Mirror:** client attempts a Firestore write | Denied by rules |

---

## 8. Done checklist

- [ ] Two browsers hold a conversation about a listing
- [ ] Non-participants get 404 everywhere
- [ ] Suspending the listing leaves the thread readable and visibly marked
- [ ] Outbox rows are written in the message transaction
- [ ] **Mirror only:** message appears without refresh; kill-and-recover converges; drift gauge exists and alerts; client writes denied
- [ ] **Written down in this file: the Firestore decision, and the reasoning.** Phase 11 depends on it — if there is no mirror, mobile needs push notifications instead.

## Known gap worth raising now

**Message content has no moderation path.** Reports target `LISTING` or `USER` only (§3), never a message or a conversation. On a platform whose core promise is protection from scams, and where the scam happens in the chat, that is a real hole. It is out of MVP scope as written — but the schema decision (whether `reports.target_type` can ever take `MESSAGE`) is easier to make now than after the enum ships.
