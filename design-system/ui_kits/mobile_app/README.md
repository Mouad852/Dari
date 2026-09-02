# Dari — mobile app UI kit

Mobile-first click-through of the room-rental app, 390×844 (iPhone 14/15 logical size).
Open `index.html`; it composes the design-system primitives (never re-implements them).

## Flow
Explorer feed → filter sheet → listing detail → *Contacter* → message thread → send.
Favourites toggle from the feed and from the listing header; tab bar switches Explorer / Favoris / Messages / Profil.

## Screens
| File | Screen |
| --- | --- |
| `AppShell.jsx` | Phone frame, status bar, top bar, 64px tab bar with unread badge |
| `FeedScreen.jsx` | Search header, filter chip row, profile-completion prompt, listing feed + empty-state Favoris |
| `FiltersSheet.jsx` | Bottom-sheet filters (segmented type, budget range, city, amenity chips) |
| `ListingScreen.jsx` | Photo header with glass controls, price block, tabs (logement / colocataires / règles), sticky contact bar |
| `MessagesScreen.jsx` | Thread list + conversation with listing context card and composer |
| `ProfileScreen.jsx` | Avatar header, search-profile card, settings switches, account rows |

## Known gaps
- **No photography was supplied**, so every image area renders the warm `sable-200` "PHOTO" placeholder. Drop real images in and pass `image` to `ListingCard`.
- No map view, payment flow, or listing-creation flow — none were specified in the brief.
- Copy is French (the product's primary interface language for Morocco); Arabic/RTL is not yet designed.
