"use client";

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { apiFetch, ApiError, apiOrigin, type CursorPage } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { Card } from '@/components/ds/Card';
import { Input } from '@/components/ds/Input';
import { ListingCard } from '@/components/ds/ListingCard';
import { Select } from '@/components/ds/Select';
import { Tabs } from '@/components/ds/Tabs';
import { Tag } from '@/components/ds/Tag';
import { amount, distance } from '@/lib/format';
import { AMENITY_LABELS } from '@/lib/labels';
import type { MapPin, PublicListing } from '@/types/api';

/*
 * Labels say what the sort actually does.
 *
 * These previously read "Pertinence", "Prix" and "Nouveautés" while the backend
 * ignored the sort parameter entirely on non-radius searches — all three
 * returned the same recency ordering. "Pertinence" in particular promised a
 * relevance ranking that does not exist; until one does, the default is named
 * for what it is. "Prix" was ambiguous about direction and is now two options,
 * since the API supports both.
 */
const SORTS = [
  { value: 'recommended', label: 'Plus récentes' },
  { value: 'priceasc', label: 'Prix croissant' },
  { value: 'pricedesc', label: 'Prix décroissant' },
  { value: 'updated', label: 'Récemment mises à jour' },
  { value: 'closest', label: 'Plus proches' },
] as const;

type SortValue = (typeof SORTS)[number]['value'];
type ViewValue = 'results' | 'map';

const CITY_CENTERS: Record<string, [number, number]> = {
  Rabat: [33.9716, -6.8498],
  Casablanca: [33.5731, -7.5898],
  Marrakech: [31.6295, -7.9811],
  Tanger: [35.7595, -5.834],
};

const MapPanel = dynamic(
  async () => {
    const [{ MapContainer, Marker, Popup, TileLayer }, leaflet] = await Promise.all([
      import('react-leaflet'),
      import('leaflet'),
    ]);

    const mapMarkerIcon = leaflet.default.divIcon({
      className: 'dari-map-pin',
      html: '<span style="display:inline-flex; width:14px; height:14px; border-radius:999px; background:var(--brand); border:2px solid #fff; box-shadow:0 8px 18px rgba(28,20,16,0.22);"></span>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    return function ListingsMapPanel({ mapCenter, mapPins }: { mapCenter: [number, number]; mapPins: MapPin[] }) {
      return (
        <MapContainer center={mapCenter} zoom={12} scrollWheelZoom={false} style={{ height: '620px', width: '100%' }}>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {mapPins.map((pin) => (
            <Marker key={pin.id} position={[pin.latitude, pin.longitude]} icon={mapMarkerIcon}>
              <Popup>
                <div style={{ display: 'grid', gap: '0.3rem', minWidth: 160 }}>
                  <strong style={{ font: 'var(--type-body-sm)', color: 'var(--text-heading)' }}>{pin.title}</strong>
                  <span style={{ color: 'var(--text-muted)', font: 'var(--type-label)' }}>{pin.neighborhood}</span>
                  <span style={{ color: 'var(--text-muted)', font: 'var(--type-label)' }}>{pin.city}</span>
                  <Link href={`/listings/${pin.id}`} style={{ color: 'var(--brand)', font: 'var(--weight-medium) var(--type-label) var(--font-ui)' }}>
                    Voir l’annonce
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      );
    };
  },
  { ssr: false },
);

const cardStyle = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-hairline)',
  borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--shadow-sm)',
} as const;

/**
 * A search result, rendered by the design system's own card.
 *
 * This replaces ~150 lines of hand-rolled markup that predated the component
 * port. What the port brings beyond the visuals: the whole card is a real
 * anchor rather than a div with a click handler, the photo is lazy-loaded, and
 * the save button sits above the link instead of beside it.
 *
 * Two deliberate differences from the markup it replaces:
 *
 * - The card no longer prints a creation date. The design's card carries
 *   district, city, price and an optional badge; a date has no slot, and the
 *   sort control already says whether the list is ordered by recency.
 * - "Nouveau" used to appear on every card, because the condition was
 *   `listing.createdAt ? ... : undefined` and a listing always has one. A badge
 *   that is always present says nothing, so it is now shown only for listings
 *   published within the week -- and a proximity search still shows distance,
 *   which is the more useful fact when it exists.
 */
const NEW_FOR_DAYS = 7;

function SearchListingCard({
  listing,
  favorited,
  favoritePending,
  onToggleFavorite,
}: {
  listing: PublicListing;
  favorited: boolean;
  favoritePending: boolean;
  onToggleFavorite: (listingId: string) => void;
}) {
  const published = new Date(listing.createdAt).getTime();
  const isNew =
    Number.isFinite(published) && Date.now() - published < NEW_FOR_DAYS * 24 * 60 * 60 * 1000;

  // distance() rounds to 100m on purpose: metre-accurate distances from
  // several reference points triangulate straight through the location fuzzing.
  const badge = listing.distanceMetres
    ? distance(listing.distanceMetres)
    : isNew
      ? 'Nouveau'
      : undefined;

  return (
    <ListingCard
      title={listing.title || 'Annonce'}
      district={listing.neighborhood}
      city={listing.city}
      price={amount(listing.priceRent)}
      image={listing.coverPhotoUrl ? `${apiOrigin}${listing.coverPhotoUrl}` : undefined}
      badge={badge}
      badgeTone={listing.distanceMetres ? 'neutral' : 'brand'}
      href={`/listings/${listing.id}`}
      saved={favorited}
      onSave={favoritePending ? undefined : () => onToggleFavorite(listing.id)}
    />
  );
}

export function SearchResults() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Chargement des annonces…</div>}>
      <SearchResultsPageContent />
    </Suspense>
  );
}

function SearchResultsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const city = searchParams.get('city') ?? 'Rabat';
  const currentSort = (searchParams.get('sort') ?? 'recommended') as SortValue;
  const [neighborhood, setNeighborhood] = useState(searchParams.get('neighborhood') ?? '');
  const [propertyType, setPropertyType] = useState(searchParams.get('propertyType') ?? '');
  const [roomType, setRoomType] = useState(searchParams.get('roomType') ?? '');
  const [furnishing, setFurnishing] = useState(searchParams.get('furnishing') ?? '');
  const [amenities, setAmenities] = useState<string[]>(() => searchParams.getAll('amenities'));
  const [resultCount, setResultCount] = useState<{ count: number; capped: boolean } | null>(null);
  // Only meaningful below the 900px breakpoint; above it CSS keeps the rail
  // visible regardless, so this never has to know the viewport width.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [amenityOptions, setAmenityOptions] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState(searchParams.get('priceMin') ?? '');
  const [priceMax, setPriceMax] = useState(searchParams.get('priceMax') ?? '');
  const [availableFrom, setAvailableFrom] = useState(searchParams.get('availableFrom') ?? '');
  const [radius, setRadius] = useState(searchParams.get('radius') ?? '');
  const [view, setView] = useState<ViewValue>(searchParams.get('view') === 'map' ? 'map' : 'results');

  useEffect(() => {
    setNeighborhood(searchParams.get('neighborhood') ?? '');
    setPropertyType(searchParams.get('propertyType') ?? '');
    setRoomType(searchParams.get('roomType') ?? '');
    setFurnishing(searchParams.get('furnishing') ?? '');
    setAmenities(searchParams.getAll('amenities'));
    setPriceMin(searchParams.get('priceMin') ?? '');
    setPriceMax(searchParams.get('priceMax') ?? '');
    setAvailableFrom(searchParams.get('availableFrom') ?? '');
    setRadius(searchParams.get('radius') ?? '');
    setView(searchParams.get('view') === 'map' ? 'map' : 'results');
  }, [searchParams]);

  useEffect(() => {
    let isCurrent = true;

    void (async () => {
      try {
        const options = await apiFetch<string[]>('/amenities');
        if (!isCurrent) return;
        setAmenityOptions(options);
      } catch {
        if (!isCurrent) return;
        setAmenityOptions([]);
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, []);

  const [favoriteToken, setFavoriteToken] = useState<string | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [favoritePendingId, setFavoritePendingId] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void (async () => {
      // The try started one line too late: `getIdToken` throws when Firebase is
      // not configured, which escaped as an unhandled rejection on every load.
      // Scoped to this effect on purpose -- knowing which cards are favorited is
      // cosmetic, so it may fail quietly; sign-in and every write still do not.
      try {
        const idToken = await getIdToken();
        if (!idToken || !isCurrent) return;
        setFavoriteToken(idToken);
        const ids = await apiFetch<string[]>('/favorites/ids', { token: idToken });
        if (isCurrent) setFavoritedIds(new Set(ids));
      } catch {
        // Not knowing which cards are favorited is a cosmetic miss, not worth surfacing as an error.
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, []);

  const handleToggleFavorite = (listingId: string) => {
    if (favoritePendingId) return;
    if (!favoriteToken) {
      router.push('/sign-in');
      return;
    }

    const wasFavorited = favoritedIds.has(listingId);
    setFavoritedIds((current) => {
      const next = new Set(current);
      if (wasFavorited) next.delete(listingId); else next.add(listingId);
      return next;
    });
    setFavoritePendingId(listingId);

    void (async () => {
      try {
        await apiFetch(`/favorites/${encodeURIComponent(listingId)}`, {
          method: wasFavorited ? 'DELETE' : 'POST',
          token: favoriteToken,
        });
      } catch {
        setFavoritedIds((current) => {
          const next = new Set(current);
          if (wasFavorited) next.add(listingId); else next.delete(listingId);
          return next;
        });
      } finally {
        setFavoritePendingId(null);
      }
    })();
  };

  const [listings, setListings] = useState<PublicListing[]>([]);
  const [mapPins, setMapPins] = useState<MapPin[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const hasRadiusMode = radius.trim().length > 0;
  const effectiveRadiusM = Number.parseInt(radius, 10);
  const visibleSorts = hasRadiusMode ? SORTS : SORTS.filter((option) => option.value !== 'closest');
  const referencePoint = useMemo(() => {
    const center = (CITY_CENTERS[city] ?? CITY_CENTERS.Rabat ?? [33.9716, -6.8498]) as [number, number];
    return { lat: center[0], lng: center[1] };
  }, [city]);

  const mapCenter = useMemo<[number, number]>(() => {
    const firstPin = mapPins[0];
    if (firstPin) {
      return [firstPin.latitude, firstPin.longitude];
    }
    return [referencePoint.lat, referencePoint.lng];
  }, [mapPins, referencePoint]);

  const updateUrl = (
    nextView: ViewValue = view,
    nextRadius = radius,
    overrides: Partial<{
      neighborhood: string;
      propertyType: string;
      roomType: string;
      furnishing: string;
      amenities: string[];
      priceMin: string;
      priceMax: string;
      availableFrom: string;
    }> = {},
  ) => {
    const currentNeighborhood = overrides.neighborhood ?? neighborhood;
    const currentPropertyType = overrides.propertyType ?? propertyType;
    const currentRoomType = overrides.roomType ?? roomType;
    const currentFurnishing = overrides.furnishing ?? furnishing;
    const currentAmenities = overrides.amenities ?? amenities;
    const currentPriceMin = overrides.priceMin ?? priceMin;
    const currentPriceMax = overrides.priceMax ?? priceMax;
    const currentAvailableFrom = overrides.availableFrom ?? availableFrom;

    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', currentSort);
    params.set('view', nextView);

    if (nextRadius.trim()) {
      params.delete('city');
      params.delete('neighborhood');
      params.set('radius', nextRadius.trim());
    } else {
      params.delete('radius');
      params.set('city', city.trim() || 'Rabat');
      if (currentNeighborhood.trim()) params.set('neighborhood', currentNeighborhood.trim());
      else params.delete('neighborhood');
    }

    for (const [key, value] of Object.entries({
      propertyType: currentPropertyType,
      roomType: currentRoomType,
      furnishing: currentFurnishing,
      priceMin: currentPriceMin,
      priceMax: currentPriceMax,
      availableFrom: currentAvailableFrom,
    })) {
      if (typeof value === 'string' && value.trim()) params.set(key, value.trim());
      else params.delete(key);
    }

    params.delete('amenities');
    for (const amenity of currentAmenities) {
      const cleaned = amenity.trim();
      if (cleaned) params.append('amenities', cleaned);
    }

    if (params.toString() !== searchParams.toString()) {
      router.replace(`/listings?${params.toString()}`, { scroll: false });
    }
  };

  const setSort = (value: SortValue) => {
    const nextSort = hasRadiusMode ? 'closest' : value;
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', nextSort);
    params.set('view', view);

    if (radius.trim()) {
      params.delete('city');
      params.delete('neighborhood');
      params.set('radius', radius.trim());
    } else {
      params.set('city', city.trim() || 'Rabat');
      if (neighborhood.trim()) params.set('neighborhood', neighborhood.trim());
      else params.delete('neighborhood');
    }

    appendFilterParams(params);

    if (params.toString() !== searchParams.toString()) {
      router.replace(`/listings?${params.toString()}`, { scroll: false });
    }
  };

  useEffect(() => {
    if (hasRadiusMode && currentSort !== 'closest') {
      setSort('closest');
    }
  }, [currentSort, hasRadiusMode]);

  const applyFilters = () => {
    updateUrl();
  };

  /**
   * Clears every narrowing filter, keeping the city.
   *
   * The city is the search itself rather than a refinement of it, so resetting
   * to no city would empty the page instead of widening it.
   */
  const resetFilters = () => {
    setNeighborhood('');
    setPropertyType('');
    setRoomType('');
    setFurnishing('');
    setPriceMin('');
    setPriceMax('');
    setAvailableFrom('');
    setAmenities([]);
    // Every cleared field is passed as an override, not left to state: these
    // setters have not flushed yet when updateUrl runs, so reading state here
    // would rebuild the URL from the values being cleared.
    updateUrl(view, radius, {
      neighborhood: '',
      propertyType: '',
      roomType: '',
      furnishing: '',
      amenities: [],
      priceMin: '',
      priceMax: '',
      availableFrom: '',
    });
  };

  const toggleView = (nextView: ViewValue) => {
    setView(nextView);
    updateUrl(nextView);
  };

  const appendFilterParams = (params: URLSearchParams) => {
    for (const [key, value] of Object.entries({
      propertyType,
      roomType,
      furnishing,
      priceMin,
      priceMax,
      availableFrom,
    })) {
      if (typeof value === 'string' && value.trim()) params.set(key, value.trim());
      else params.delete(key);
    }

    params.delete('amenities');
    for (const amenity of amenities) {
      const cleaned = amenity.trim();
      if (cleaned) params.append('amenities', cleaned);
    }
  };

  const toggleAmenity = (amenity: string) => {
    const nextAmenities = amenities.includes(amenity)
      ? amenities.filter((item) => item !== amenity)
      : [...amenities, amenity];
    setAmenities(nextAmenities);
    updateUrl(view, radius, { amenities: nextAmenities });
  };

  useEffect(() => {
    let isCurrent = true;

    async function loadListings(cursor?: string) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('sort', currentSort);
      params.set('view', view);
      if (cursor) params.set('cursor', cursor); else params.delete('cursor');

      if (hasRadiusMode && Number.isFinite(effectiveRadiusM) && effectiveRadiusM > 0) {
        params.delete('city');
        params.delete('neighborhood');
        params.set('lat', String(referencePoint.lat));
        params.set('lng', String(referencePoint.lng));
        params.set('radiusM', String(effectiveRadiusM));
      } else {
        params.delete('lat');
        params.delete('lng');
        params.delete('radiusM');
        params.set('city', city);
        if (neighborhood.trim()) params.set('neighborhood', neighborhood.trim());
        else params.delete('neighborhood');
      }

      appendFilterParams(params);

      // The count belongs to the filter set, not the page, so it is fetched only
      // on a fresh search and never while paginating. It is also deliberately
      // not awaited with the results: a slower count must not delay the list.
      if (!cursor) {
        const countParams = new URLSearchParams(params);
        countParams.delete('sort');
        countParams.delete('view');
        countParams.delete('cursor');
        void apiFetch<{ count: number; capped: boolean }>(`/listings/count?${countParams.toString()}`)
          .then((result) => {
            if (isCurrent) setResultCount(result);
          })
          .catch(() => {
            // A missing count degrades the heading to a neutral one; it must
            // never take the results down with it.
            if (isCurrent) setResultCount(null);
          });
      }

      try {
        const page = await apiFetch<CursorPage<PublicListing>>(`/listings?${params.toString()}`);
        if (!isCurrent) return;
        setListings(cursor ? (prev) => [...prev, ...page.items] : page.items);
        setNextCursor(page.nextCursor);
        setError(null);
      } catch (err) {
        if (!isCurrent) return;
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue');
      } finally {
        if (isCurrent) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }

    setLoading(true);
    setLoadingMore(false);
    void loadListings();

    return () => {
      isCurrent = false;
    };
  }, [city, currentSort, effectiveRadiusM, hasRadiusMode, neighborhood, referencePoint.lat, referencePoint.lng, searchParams, view]);

  useEffect(() => {
    if (view !== 'map') return;

    let isCurrent = true;

    async function loadMapPins() {
      setMapLoading(true);
      setMapError(null);

      const params = new URLSearchParams(searchParams.toString());
      params.delete('cursor');
      params.delete('view');
      params.set('sort', currentSort);

      const cityValue = (searchParams.get('city') ?? city ?? 'Rabat').trim();
      const neighborhoodValue = (searchParams.get('neighborhood') ?? neighborhood ?? '').trim();

      if (hasRadiusMode && Number.isFinite(effectiveRadiusM) && effectiveRadiusM > 0) {
        params.delete('city');
        params.delete('neighborhood');
        params.set('lat', String(referencePoint.lat));
        params.set('lng', String(referencePoint.lng));
        params.set('radiusM', String(effectiveRadiusM));
      } else {
        params.set('city', cityValue);
        if (neighborhoodValue) params.set('neighborhood', neighborhoodValue);
        else params.delete('neighborhood');
        params.delete('lat');
        params.delete('lng');
        params.delete('radiusM');
      }

      appendFilterParams(params);

      try {
        const pins = await apiFetch<MapPin[]>(`/listings/map?${params.toString()}`);
        if (!isCurrent) return;
        setMapPins(pins);
      } catch (err) {
        if (!isCurrent) return;
        setMapError(err instanceof ApiError ? err.message : 'Une erreur est survenue');
      } finally {
        if (isCurrent) setMapLoading(false);
      }
    }

    void loadMapPins();

    return () => {
      isCurrent = false;
    };
  }, [city, currentSort, effectiveRadiusM, furnishing, hasRadiusMode, neighborhood, priceMax, priceMin, propertyType, referencePoint.lat, referencePoint.lng, roomType, searchParams, view]);

  /**
   * How many filters are actually narrowing the search.
   *
   * City is excluded: every search has one, so counting it would mean the
   * button always claimed at least one active filter and "Réinitialiser" would
   * look like it had something to undo on a completely untouched page.
   */
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (neighborhood.trim()) n += 1;
    if (propertyType) n += 1;
    if (roomType) n += 1;
    if (furnishing) n += 1;
    if (priceMin) n += 1;
    if (priceMax) n += 1;
    n += amenities.length;
    if (availableFrom) n += 1;
    return n;
  }, [amenities, availableFrom, furnishing, neighborhood, priceMax, priceMin, propertyType, roomType]);

  const resultHeading = useMemo(() => {
    // Previously this reported listings.length -- the number of rows *loaded* --
    // so a search of 12,500 listings in Rabat announced "20 annonces à Rabat"
    // and grew as you paged. It now reports the real total, capped.
    if (!resultCount) return `Annonces à ${city}`;
    if (resultCount.capped) return `Plus de ${resultCount.count} annonces à ${city}`;
    const n = resultCount.count;
    return `${n} annonce${n > 1 ? 's' : ''} à ${city}`;
  }, [city, resultCount]);

  const handleLoadMore = () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    void (async () => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('sort', currentSort);
      params.set('cursor', nextCursor);
      if (hasRadiusMode && Number.isFinite(effectiveRadiusM) && effectiveRadiusM > 0) {
        params.delete('city');
        params.delete('neighborhood');
        params.set('lat', String(referencePoint.lat));
        params.set('lng', String(referencePoint.lng));
        params.set('radiusM', String(effectiveRadiusM));
      } else {
        params.set('city', city);
        params.delete('lat');
        params.delete('lng');
        params.delete('radiusM');
      }
      appendFilterParams(params);
      try {
        const page = await apiFetch<CursorPage<PublicListing>>(`/listings?${params.toString()}`);
        setListings((prev) => [...prev, ...page.items]);
        setNextCursor(page.nextCursor);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue');
      } finally {
        setLoadingMore(false);
      }
    })();
  };

  return (
    <main style={{ padding: 'var(--space-7) var(--gutter-desktop) var(--space-10)' }}>
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          {/*
            This had no onClick at all: a control that looks like a back button
            and does nothing. The kit passes an `onBack`; here the label says
            Accueil, so that is where it goes.
          */}
          <Button variant="ghost" size="sm" iconLeft="chevron-left" onClick={() => router.push('/')}>
            Accueil
          </Button>
          <span style={{ font: 'var(--type-caption)', color: 'var(--text-subtle)' }}>{city} · Colocation</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-5)', flexWrap: 'wrap', minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, font: 'var(--weight-bold) clamp(24px, 5vw, 32px)/1.2 var(--font-display)' }}>{resultHeading}</h1>
            <p style={{ marginTop: 6, font: 'var(--type-body-sm, 13px)', color: 'var(--text-muted)' }}>Mises à jour aujourd'hui · loyers charges comprises</p>
          </div>

          {/*
            The view switch lives with the results, not inside the filter panel.
            It controls how results are presented, not what is matched -- and in
            a 300px rail its row measured 341px, which is what pushed the panel's
            contents under the results grid.
          */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
                <Tabs
                  variant="segmented"
                  label="Présentation des résultats"
                  value={view}
                  onChange={(value) => toggleView(value as ViewValue)}
                  tabs={[
                    { value: 'results', label: 'Résultats' },
                    { value: 'map', label: 'Carte' },
                  ]}
                />

          {/*
            The kit's own control for this row: `Tabs variant="segmented"`. Hand-
            rolling it cost the keyboard behaviour the tablist role promises --
            arrow keys now move between sorts, which they never did here.
          */}
          <div className="scroll-row" style={{ maxWidth: '100%' }}>
            <Tabs
              variant="segmented"
              label="Trier les annonces"
              value={currentSort}
              onChange={(value) => setSort(value as SortValue)}
              tabs={visibleSorts.map((option) => ({ value: option.value, label: option.label }))}
            />
          </div>
          </div>
        </div>

        {/*
          Below 900px the rail is a disclosure panel: a seeker arrives to read
          results, and a full filter column ahead of them is the wrong default.
          Hidden above the breakpoint by CSS, so no viewport check is needed here.
        */}
        {/*
          The class goes on a wrapper, not on the Button. Button sets
          `display: inline-flex` inline, and an inline declaration beats the
          class rule that hides this above 900px -- the toggle would have stayed
          visible on desktop. app.css already carries that warning; this is the
          third time it has been the answer.
        */}
        <div className="search-filters-toggle">
        <Button
          variant="secondary"
          fullWidth
          iconLeft="sliders-horizontal"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
        >
          {filtersOpen ? 'Masquer les filtres' : 'Filtres'}
          {activeFilterCount > 0 && (
            <Badge tone="inverse" size="sm" style={{ marginLeft: 'var(--space-2)' }}>
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        </div>

        <div className="search-layout">
          <aside
            className="search-filters"
            data-collapsed={filtersOpen ? 'false' : 'true'}
            style={{ gap: 'var(--space-6)', alignContent: 'start' }}
          >
            {/*
              Rebuilt against `design-system/ui_kits/website/SearchResultsPage.jsx`.
              Everything here was a raw <input>/<select>/<button> with its border,
              radius and padding written out by hand -- eleven copies of the same
              four declarations, none of which had a focus ring, a real label, or
              the control height the design specifies.
            */}
            {/*
              minmax(0, 1fr) on both grids, not `auto`. An implicit grid track is
              sized to its content, so the selects and the tag row sized the rail
              from the inside and spilled it under the results -- the same bug
              the .search-filters rule in app.css was written to fix, reappearing
              one level deeper.
            */}
            <Card
              padding="var(--card-pad-lg)"
              style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-5)' }}
            >
              <h3 style={{ margin: 0, font: 'var(--type-h3)' }}>Filtres</h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-4)' }}>
                {/*
                  City/neighbourhood and radius are mutually exclusive modes, not
                  two filters -- which is what a segmented control says and what
                  two independent pill buttons did not.
                */}
                <Tabs
                  variant="segmented"
                  label="Mode de recherche"
                  value={hasRadiusMode ? 'radius' : 'place'}
                  onChange={(value) => {
                    if (value === 'radius') {
                      const nextRadius = radius || '2500';
                      setRadius(nextRadius);
                      setView('results');
                      updateUrl('results', nextRadius);
                    } else {
                      setRadius('');
                      setView('results');
                      updateUrl('results', '');
                    }
                  }}
                  tabs={[
                    { value: 'place', label: 'Ville / quartier' },
                    { value: 'radius', label: 'Rayon' },
                  ]}
                />

                {hasRadiusMode ? (
                  <Input
                    label="Rayon"
                    type="number"
                    min={250}
                    max={10000}
                    step={250}
                    suffix="m"
                    value={radius}
                    onChange={(event) => {
                      const nextRadius = event.target.value;
                      setRadius(nextRadius);
                      updateUrl(view, nextRadius);
                    }}
                    helper="Le rayon reste dans l’URL sans exposer les coordonnées exactes."
                  />
                ) : (
                  <>
                    <Input
                      label="Quartier"
                      value={neighborhood}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setNeighborhood(nextValue);
                        updateUrl(view, radius, { neighborhood: nextValue });
                      }}
                      placeholder="Agdal, Maarif, Gueliz"
                    />

                    <Select
                      label="Type de logement"
                      placeholder="Tous les logements"
                      value={propertyType}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setPropertyType(nextValue);
                        updateUrl(view, radius, { propertyType: nextValue });
                      }}
                      options={[
                        { value: 'APARTMENT', label: 'Appartement' },
                        { value: 'HOUSE', label: 'Maison' },
                        { value: 'STUDIO', label: 'Studio' },
                      ]}
                    />

                    <Select
                      label="Type de chambre"
                      placeholder="Toutes les chambres"
                      value={roomType}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setRoomType(nextValue);
                        updateUrl(view, radius, { roomType: nextValue });
                      }}
                      options={[
                        { value: 'PRIVATE', label: 'Privée' },
                        { value: 'SHARED', label: 'Partagée' },
                      ]}
                    />

                    <Select
                      label="Aménagement"
                      placeholder="Tous les aménagements"
                      value={furnishing}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setFurnishing(nextValue);
                        updateUrl(view, radius, { furnishing: nextValue });
                      }}
                      options={[
                        { value: 'FULLY_FURNISHED', label: 'Meublé' },
                        { value: 'PARTIALLY_FURNISHED', label: 'Partiellement meublé' },
                        { value: 'UNFURNISHED', label: 'Non meublé' },
                      ]}
                    />

                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                      <span style={{ font: 'var(--type-label)', color: 'var(--text-heading)' }}>Équipements</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                        {/*
                          The design-system Tag. The charcoal-when-selected rule
                          this replaces was re-derived by hand here before the
                          component was ported -- Tag already specified it.
                        */}
                        {amenityOptions.map((amenity) => (
                          <Tag
                            key={amenity}
                            selected={amenities.includes(amenity)}
                            onClick={() => toggleAmenity(amenity)}
                          >
                            {AMENITY_LABELS[amenity] ?? amenity}
                          </Tag>
                        ))}
                      </div>
                      <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                        Sélection multiple : tous les équipements choisis doivent être présents.
                      </span>
                    </div>

                    {/* Two columns, as the kit lays out its price pair. minmax(0,…)
                        because a grid item's default min-width is its content:
                        the field padding plus the MAD suffix was enough to push
                        the pair wider than the rail. */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--space-4)' }}>
                      <Input
                        label="Min."
                        type="number"
                        min={0}
                        suffix="MAD"
                        value={priceMin}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setPriceMin(nextValue);
                          updateUrl(view, radius, { priceMin: nextValue });
                        }}
                        placeholder="2 000"
                      />
                      <Input
                        label="Max."
                        type="number"
                        min={0}
                        suffix="MAD"
                        value={priceMax}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setPriceMax(nextValue);
                          updateUrl(view, radius, { priceMax: nextValue });
                        }}
                        placeholder="4 500"
                      />
                    </div>

                    <Input
                      label="Disponibilité"
                      type="date"
                      value={availableFrom}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setAvailableFrom(nextValue);
                        updateUrl(view, radius, { availableFrom: nextValue });
                      }}
                    />
                  </>
                )}

                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <Button fullWidth onClick={applyFilters}>
                    {resultCount
                      ? resultCount.capped
                        ? 'Voir plus de 200 annonces'
                        : `Voir ${resultCount.count} annonce${resultCount.count > 1 ? 's' : ''}`
                      : 'Appliquer les filtres'}
                  </Button>
                  {/* Offered only when there is something to undo. */}
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" fullWidth onClick={resetFilters}>
                      Réinitialiser
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </aside>

          <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
            {error ? (
              <div style={{ ...cardStyle, padding: '1.5rem', color: 'var(--text-heading)' }}>{error}</div>
            ) : null}

            {view === 'map' ? (
              <div style={{ ...cardStyle, overflow: 'hidden', minHeight: 620 }}>
                {mapError ? (
                  <div style={{ padding: '1.5rem', color: 'var(--text-heading)' }}>{mapError}</div>
                ) : mapLoading ? (
                  <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Chargement de la carte…</div>
                ) : (
                  <MapPanel mapCenter={mapCenter} mapPins={mapPins} />
                )}
              </div>
            ) : (
              <>
                <div className="results-grid">
                  {!loading && listings.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', ...cardStyle, padding: '2rem', color: 'var(--text-muted)' }}>
                      Aucune annonce n'a été trouvée pour cette recherche.
                    </div>
                  ) : null}

                  {listings.map((listing) => (
                    <SearchListingCard
                      key={listing.id}
                      listing={listing}
                      favorited={favoritedIds.has(listing.id)}
                      favoritePending={favoritePendingId === listing.id}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </div>

                {loading ? (
                  <div style={{ color: 'var(--text-muted)' }}>Chargement des annonces…</div>
                ) : nextCursor ? (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-4)' }}>
                    <Button
                      variant="secondary"
                      iconRight="arrow-right"
                      loading={loadingMore}
                      onClick={handleLoadMore}
                    >
                      Afficher plus d’annonces
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

