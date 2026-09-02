# Dari — marketing website UI kit

Desktop recreation of dari.ma at 1280 wide (container 1200, 48px gutters). Open `index.html`.

## Flow
Homepage hero + search → *Rechercher* / *Voir les chambres* → results page with sticky filter rail → click a card → contact dialog → success toast → back to Accueil.

## Files
| File | Surface |
| --- | --- |
| `SiteChrome.jsx` | Glass sticky header with type-set wordmark, nav, auth + publish CTAs; charcoal footer with link columns |
| `HomePage.jsx` | Hero, elevated search bar, featured-listing grid, 4-step "Comment ça marche", city tiles with scrims, terracotta CTA band |
| `SearchResultsPage.jsx` | Breadcrumb, result count, segmented sort, sticky filter rail, 3-up listing grid, load-more |

## Known gaps
- No photography supplied — hero, city tiles and cards use the `sable-200` "PHOTO" placeholder.
- No logo file supplied — the wordmark is plain type (`Wordmark` in `SiteChrome.jsx`).
- Blog, city landing pages, pricing and dashboard views were not specified and are intentionally absent.
