# Guide — Phase 09: Profiles, favorites and account

Implementation guide for [`09-profiles-favorites-account.md`](../09-profiles-favorites-account.md).

The smallest backend phase. Most of the work is frontend, and most of the risk is in two things the design doc never specified: what "verification tier" means, and what account deletion does.

---

## 0. Decisions to settle first

**Account deletion → soft-delete the internal row, delete the Firebase identity, soft-delete listings, retain messages.** The design doc is silent, and the delete button will otherwise decide this by accident.

Reasoning: deleting the Firebase identity is what actually ends the user's access, and it is what a user means by "delete my account". Soft-deleting the internal row preserves the audit trail that §6 requires for moderation. Messages stay, because a conversation is two people's data and one party cannot unilaterally erase the other's history — the sender is shown as a deleted user instead.

State it in the UI plainly, because it is a promise: *"Votre profil et vos annonces sont supprimés. Vos messages restent visibles pour vos correspondants, sans votre nom."*

**Verification tier → derive it, do not store it.** §2 mentions a tier; §3 gives only `email_verified` and `phone_verified`. Do not add a column that can drift from the booleans:

```java
public enum VerificationTier { NONE, EMAIL, EMAIL_PHONE }

public static VerificationTier of(User u) {
    if (u.isPhoneVerified() && u.isEmailVerified()) return EMAIL_PHONE;
    if (u.isEmailVerified())                        return EMAIL;
    return NONE;
}
```

Phone verification is a fast-follow, so `EMAIL_PHONE` is unreachable at MVP. Design the badge with room for it anyway.

**Profile completeness → display name, city, bio, and a photo.** The mockup has a completion prompt, which implies a rule nobody has written. Four fields, all cheap to fill, all useful to an owner deciding whether to reply.

---

## 1. Schema

`V10__favorites.sql`:

```sql
CREATE TABLE favorites (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, listing_id)
);

-- The favorites screen sorts by when it was saved.
CREATE INDEX idx_favorites_user ON favorites (user_id, created_at DESC);
```

The composite primary key gives idempotent favoriting for free — `ON CONFLICT DO NOTHING` and a double-tap is harmless.

Add to `users` for deletion and photos:

```sql
ALTER TABLE users
    ADD COLUMN avatar_url  TEXT,
    ADD COLUMN deleted_at  TIMESTAMPTZ;
```

---

## 2. Favorites

```
GET    /api/v1/favorites
POST   /api/v1/favorites/{listingId}
DELETE /api/v1/favorites/{listingId}
```

```java
@Transactional
public void add(User user, UUID listingId) {
    // Only published listings can be favorited in the first place.
    if (!publishedListings.existsById(listingId))
        throw new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable");
    favorites.insertIgnoringConflict(user.getId(), listingId);
}
```

### The rule that matters: favorites outlive availability

A listing that becomes `ROOM_FOUND`, `SUSPENDED` or `EXPIRED` **stays in the list, marked unavailable** — it does not vanish. A saved item disappearing without explanation reads as a bug, and the user has no way to know what happened.

That means the favorites query reads the `listings` table, not the `published_listings` view — one of the few legitimate cases, alongside phase 04's conversation context. Comment it as such.

```java
public record FavoriteResponse(
        PublicListingResponse listing,   // still fuzzed — phase 02 chokepoint applies
        boolean available,
        String unavailableLabel,         // "Chambre trouvée" / "Annonce suspendue" / "Annonce expirée"
        Instant savedAt) {}
```

Soft-deleted listings are the exception: those are removed entirely, not shown as unavailable.

---

## 3. Public profile

```
GET /api/v1/users/{id}
```

This is what an owner sees before deciding whether to reply to a stranger, so it is a **trust surface** — more load-bearing than it first appears on an anti-scam platform.

```java
/** Public projection. No email, no phone, no firebase_uid, no internal status. */
public record PublicProfileResponse(
        UUID id,
        String displayName,          // display_name only — never first_name + last
        String city,
        String bio,
        String avatarUrl,
        VerificationTier verification,
        Instant memberSince,
        int activeListingCount) {}
```

Never expose the entity. The same rule as phase 02's coordinates: give the DTO no field that could hold private data, so a leak requires deliberately adding one.

`activeListingCount` counts through `published_listings` — an owner's suspended listings are not public information.

A `BANNED` or deleted user's profile returns 404. A `SUSPENDED` user's profile is still visible; suspension is temporary and their conversation history remains accessible per §4.

---

## 4. Account

```
PATCH  /api/v1/users/me
POST   /api/v1/users/me/avatar
DELETE /api/v1/users/me
POST   /api/v1/users/me/phone-verification   -- stub, per §7
```

Avatar upload reuses phase 05's `PhotoStorage` and the same processing pipeline — **including EXIF stripping**. A profile photo carries GPS just as readily as a listing photo, and it is likely to be taken at home.

### Deletion

```java
@Transactional
public void deleteAccount(User user) {
    user.setDeletedAt(Instant.now());
    user.setDisplayName("Utilisateur supprimé");
    user.setBio(null);
    user.setAvatarUrl(null);
    user.setCity(null);

    listings.findByOwnerId(user.getId())
            .forEach(l -> l.setDeletedAt(Instant.now()));

    favorites.deleteByUserId(user.getId());

    // Messages are retained — a conversation is two people's data.
    // The sender renders as a deleted user in the other party's thread.

    firebaseAuth.deleteUser(user.getFirebaseUid());   // ends access, last
    audit(user, "SELF_DELETE");
}
```

Delete the Firebase identity **last**. If it succeeds and the transaction then rolls back, the user is locked out of an account that still exists — the worst of both outcomes.

Note the interaction with phase 06: a deleted account does not enter `banned_identities`, so the same email can sign up again. That is correct — deletion is not a ban.

---

## 5. Frontend

### Favorites screen

`ui_kits/mobile_app/FeedScreen.jsx` already contains the empty state. Use its copy verbatim:

> *"Touchez le cœur sur une annonce pour la retrouver ici."*

It follows the empty-state rule — name the action that fills it — and it is already written. Do not paraphrase it.

Optimistic toggle, since a heart that waits for a round-trip feels broken:

```tsx
const toggle = useMutation({
  mutationFn: (id: string) => saved ? api.delete(`/favorites/${id}`) : api.post(`/favorites/${id}`),
  onMutate: async (id) => { /* flip immediately, snapshot for rollback */ },
  onError: (_e, _id, ctx) => { /* revert; no toast — a failed heart is not worth interrupting */ },
});
```

Unavailable favorites render with a `--sable-200` overlay and the label. Keep them tappable — the user may want to open the conversation they started about it.

### Profile

Port `ui_kits/mobile_app/ProfileScreen.jsx`: avatar header, search-profile card, settings switches, account rows. `Switch` from the design system, not a native checkbox.

The **completion prompt** in the feed shows only when the four fields are not all filled, and it must be dismissible — a prompt that cannot be dismissed becomes an ad for your own product.

### Deletion flow

Two-step, with the consequences stated:

```tsx
<Dialog title="Supprimer votre compte">
  <p>Votre profil et vos annonces sont supprimés définitivement.</p>
  <p>Vos messages restent visibles pour vos correspondants, sans votre nom.</p>
  <Input label="Tapez SUPPRIMER pour confirmer" />
</Dialog>
```

Type-to-confirm, not a second "are you sure". And the copy rules still apply — plain, factual, no exclamation marks, no attempt to guilt the user into staying.

---

## 6. Tests

| Test | Asserts |
| --- | --- |
| Favorite, sign out, sign in | Persists |
| Favorite twice | Idempotent, one row |
| Favorite an unpublished listing | 404 |
| Favourited listing becomes `ROOM_FOUND` | Still listed, `available: false` |
| Favourited listing soft-deleted | Removed from list |
| `GET /users/{id}` raw JSON | No email, phone, `firebase_uid`, or internal status |
| Public profile of a banned user | 404 |
| `activeListingCount` with a suspended listing | Not counted |
| Avatar with GPS EXIF | Stripped |
| Delete account | Firebase identity gone, row soft-deleted, listings soft-deleted, messages retained |
| Deleted user's messages | Visible to the other party, name anonymised |
| Sign up again with a deleted account's email | Allowed |

The raw-JSON assertion on the public profile is worth writing literally — read the response body as a string and assert the absent field names, rather than trusting the DTO's shape.

---

## 7. Done checklist

- [ ] Favouriting works from feed and detail, persists across devices
- [ ] Unavailable favorites stay listed and clearly marked
- [ ] Public profile shows trust signals and no private data — verified against raw JSON
- [ ] Profile edits round-trip; completion prompt clears when complete
- [ ] Account deletion behaves as documented, and the documentation matches the code
- [ ] Avatar photos carry no metadata
- [ ] **Written down:** the deletion policy, in the product's own words, on a page users can read
