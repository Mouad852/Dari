"use client";

import { ArrowLeft, ArrowRight, Heart, List, Map as MapIcon, MapPin as MapPinIcon, SlidersHorizontal } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { apiFetch, ApiError, apiOrigin, type CursorPage } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
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
                  <strong style={{ font: 'var(--type-body-sm)', color: 'var(--text-primary)' }}>{pin.title}</strong>
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

function formatPrice(value: number): string {
  return `${new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(value)} MAD/mois`;
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Récemment';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ListingCard({
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
  const title = listing.title || 'Annonce';
  const badge = listing.createdAt ? 'Nouveau' : undefined;

  return (
    <article
      style={{
        ...cardStyle,
        position: 'relative',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateRows: '170px 1fr',
      }}
    >
      {/* Full-card link, painted under the heart button (z-index) so both stay independently clickable. */}
      <Link href={`/listings/${listing.id}`} aria-label={title} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />

      <div
        style={{
          position: 'relative',
          background: 'var(--sable-200)',
          color: 'var(--sable-500)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: 'var(--type-caption)',
          letterSpacing: 'var(--ls-caps)',
          textTransform: 'uppercase',
        }}
      >
        {listing.coverPhotoUrl ? (
          <img
            src={`${apiOrigin}${listing.coverPhotoUrl}`}
            alt=""
            loading="lazy"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          'Photo'
        )}
        <button
          type="button"
          aria-label={favorited ? 'Retirer des favoris' : 'Enregistrer'}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleFavorite(listing.id);
          }}
          disabled={favoritePending}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 2,
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.9)',
            color: 'var(--brand)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-xs)',
            cursor: favoritePending ? 'default' : 'pointer',
            opacity: favoritePending ? 0.6 : 1,
          }}
        >
          <Heart size={15} fill={favorited ? 'currentColor' : 'none'} />
        </button>
        <div
          style={{
            position: 'absolute',
            inset: 'auto 12px 12px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              background: 'rgba(36, 31, 28, 0.56)',
              backdropFilter: 'blur(12px)',
              color: '#fff',
              borderRadius: '999px',
              padding: '0.45rem 0.7rem',
              font: 'var(--type-label)',
            }}
          >
            {formatPrice(listing.priceRent)}
          </span>
          <span
            style={{
              background: 'rgba(255,255,255,0.82)',
              color: 'var(--text-primary)',
              borderRadius: '999px',
              padding: '0.45rem 0.7rem',
              font: 'var(--type-label)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            {listing.distanceMetres ? (
              <>
                <MapPinIcon size={12} />
                {Math.round(listing.distanceMetres)} m
              </>
            ) : (
              'Nouveau'
            )}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.9rem', padding: '1rem 1rem 1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
          <div>
            <div style={{ font: 'var(--type-eyebrow)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>
              {listing.neighborhood}
            </div>
            <h3 style={{ margin: '0.15rem 0 0', font: 'var(--type-h3)' }}>{title}</h3>
          </div>
          {badge ? (
            <span
              style={{
                background: 'var(--sand-100)',
                color: 'var(--text-primary)',
                borderRadius: '999px',
                padding: '0.35rem 0.65rem',
                font: 'var(--type-label)',
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>
          <span>{listing.city}</span>
          <span>{formatCreatedAt(listing.createdAt)}</span>
        </div>
      </div>
    </article>
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
      const idToken = await getIdToken();
      if (!idToken || !isCurrent) return;
      setFavoriteToken(idToken);
      try {
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
          <button
            type="button"
            style={{
              display: 'inline-flex',
              gap: '0.5rem',
              alignItems: 'center',
              background: 'transparent',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-pill)',
              color: 'var(--text-primary)',
              padding: '0.55rem 0.9rem',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} />
            Accueil
          </button>
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
                <div style={{ display: 'inline-flex', gap: '0.25rem', background: 'var(--surface-muted)', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-hairline)', padding: '0.2rem' }}>
                  <button
                    type="button"
                    onClick={() => toggleView('results')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      border: 'none',
                      borderRadius: 'var(--radius-pill)',
                      background: view === 'results' ? 'var(--sable-900)' : 'transparent',
                      color: view === 'results' ? '#fff' : 'var(--text-primary)',
                      padding: '0.45rem 0.7rem',
                      font: 'var(--type-label)',
                      cursor: 'pointer',
                    }}
                  >
                    <List size={14} />
                    Résultats
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleView('map')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      border: 'none',
                      borderRadius: 'var(--radius-pill)',
                      background: view === 'map' ? 'var(--sable-900)' : 'transparent',
                      color: view === 'map' ? '#fff' : 'var(--text-primary)',
                      padding: '0.45rem 0.7rem',
                      font: 'var(--type-label)',
                      cursor: 'pointer',
                    }}
                  >
                    <MapIcon size={14} />
                    Carte
                  </button>
                </div>

          <div
            className="scroll-row"
            style={{ display: 'inline-flex', flexShrink: 0, maxWidth: '100%', background: 'var(--surface-muted)', borderRadius: 'var(--radius-pill)', padding: '0.25rem', border: '1px solid var(--border-hairline)' }}
          >
            {visibleSorts.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSort(option.value)}
                style={{
                  background: currentSort === option.value ? 'var(--sable-900)' : 'transparent',
                  color: currentSort === option.value ? '#fff' : 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  padding: '0.55rem 0.9rem',
                  font: 'var(--type-body-sm)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          </div>
        </div>

        {/*
          Below 900px the rail is a disclosure panel: a seeker arrives to read
          results, and a full filter column ahead of them is the wrong default.
          Hidden above the breakpoint by CSS, so no viewport check is needed here.
        */}
        <button
          type="button"
          className="search-filters-toggle"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            width: '100%',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--surface-card)',
            color: 'var(--text-primary)',
            padding: '0.8rem 1rem',
            font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)',
            cursor: 'pointer',
          }}
        >
          <SlidersHorizontal size={16} />
          {filtersOpen ? 'Masquer les filtres' : 'Filtres'}
          {activeFilterCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 20,
                height: 20,
                borderRadius: 'var(--radius-pill)',
                background: 'var(--sable-900)',
                color: '#fff',
                font: 'var(--type-label)',
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="search-layout">
          <aside
            className="search-filters"
            data-collapsed={filtersOpen ? 'false' : 'true'}
            style={{ gap: 'var(--space-6)', alignContent: 'start' }}
          >
            <div
              style={{
                ...cardStyle,
                display: 'grid',
                gap: 'var(--space-5)',
                padding: 'var(--card-pad-lg)',
              }}
            >
              <h3 style={{ margin: 0, font: 'var(--type-h3)' }}>Filtres</h3>

              <div style={{ display: 'grid', gap: '0.75rem', color: 'var(--text-muted)', font: 'var(--type-body-md)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setRadius('');
                      setView('results');
                      updateUrl('results', '');
                    }}
                    style={{
                      background: !hasRadiusMode ? 'var(--sable-900)' : 'transparent',
                      color: !hasRadiusMode ? '#fff' : 'var(--text-primary)',
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid var(--border-default)',
                      padding: '0.6rem 0.8rem',
                      font: 'var(--type-body-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    Ville / quartier
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextRadius = radius || '2500';
                      setRadius(nextRadius);
                      setView('results');
                      updateUrl('results', nextRadius);
                    }}
                    style={{
                      background: hasRadiusMode ? 'var(--sable-900)' : 'transparent',
                      color: hasRadiusMode ? '#fff' : 'var(--text-primary)',
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid var(--border-default)',
                      padding: '0.6rem 0.8rem',
                      font: 'var(--type-body-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    Rayon
                  </button>
                </div>

                {hasRadiusMode ? (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <label htmlFor="radius" style={{ font: 'var(--type-label)', color: 'var(--text-subtle)' }}>Rayon (mètres)</label>
                    <input
                      id="radius"
                      type="number"
                      min="250"
                      max="10000"
                      step="250"
                      value={radius}
                      onChange={(event) => {
                        const nextRadius = event.target.value;
                        setRadius(nextRadius);
                        updateUrl(view, nextRadius);
                      }}
                      style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.7rem', font: 'var(--type-body-sm)' }}
                    />
                    <small style={{ color: 'var(--text-muted)', font: 'var(--type-label)' }}>Le rayon reste dans l'URL sans exposer les coordonnées exactes.</small>
                  </div>
                ) : (
                  <>
                    <input
                      value={neighborhood}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setNeighborhood(nextValue);
                        updateUrl(view, radius, { neighborhood: nextValue });
                      }}
                      placeholder="Quartier"
                      aria-label="Quartier"
                      style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.7rem', font: 'var(--type-body-sm)' }}
                    />
                    <select value={propertyType} onChange={(event) => { const nextValue = event.target.value; setPropertyType(nextValue); updateUrl(view, radius, { propertyType: nextValue }); }} aria-label="Type de logement" style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.7rem', font: 'var(--type-body-sm)' }}>
                      <option value="">Tous les logements</option>
                      <option value="APARTMENT">Appartement</option>
                      <option value="HOUSE">Maison</option>
                      <option value="STUDIO">Studio</option>
                    </select>
                    <select value={roomType} onChange={(event) => { const nextValue = event.target.value; setRoomType(nextValue); updateUrl(view, radius, { roomType: nextValue }); }} aria-label="Type de chambre" style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.7rem', font: 'var(--type-body-sm)' }}>
                      <option value="">Toutes les chambres</option>
                      <option value="PRIVATE">Privée</option>
                      <option value="SHARED">Partagée</option>
                    </select>
                    <select value={furnishing} onChange={(event) => { const nextValue = event.target.value; setFurnishing(nextValue); updateUrl(view, radius, { furnishing: nextValue }); }} aria-label="Aménagement" style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.7rem', font: 'var(--type-body-sm)' }}>
                      <option value="">Tous les aménagements</option>
                      <option value="FULLY_FURNISHED">Meublé</option>
                      <option value="PARTIALLY_FURNISHED">Partiellement meublé</option>
                      <option value="UNFURNISHED">Non meublé</option>
                    </select>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      <div style={{ font: 'var(--type-label)', color: 'var(--text-subtle)' }}>Équipements</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {amenityOptions.map((amenity) => {
                          const selected = amenities.includes(amenity);
                          return (
                            <button
                              key={amenity}
                              type="button"
                              onClick={() => toggleAmenity(amenity)}
                              aria-pressed={selected}
                              style={{
                                // Selected chips invert to charcoal, not
                                // terracotta: the design system reserves the
                                // brand colour for the primary action, and a
                                // terracotta chip competes with "Voir les
                                // annonces" sitting directly beneath it.
                                border: selected ? '1px solid var(--sable-900)' : '1px solid var(--border-default)',
                                background: selected ? 'var(--sable-900)' : 'transparent',
                                color: selected ? '#fff' : 'var(--text-primary)',
                                borderRadius: 'var(--radius-pill)',
                                padding: '0.45rem 0.7rem',
                                font: 'var(--type-label)',
                                cursor: 'pointer',
                              }}
                            >
                              {AMENITY_LABELS[amenity] ?? amenity}
                            </button>
                          );
                        })}
                      </div>
                      <small style={{ color: 'var(--text-muted)', font: 'var(--type-label)' }}>Sélection multiple : tous les équipements choisis doivent être présents.</small>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                      <input type="number" min="0" value={priceMin} onChange={(event) => { const nextValue = event.target.value; setPriceMin(nextValue); updateUrl(view, radius, { priceMin: nextValue }); }} placeholder="Prix min" aria-label="Prix minimum" style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.7rem', font: 'var(--type-body-sm)' }} />
                      <input type="number" min="0" value={priceMax} onChange={(event) => { const nextValue = event.target.value; setPriceMax(nextValue); updateUrl(view, radius, { priceMax: nextValue }); }} placeholder="Prix max" aria-label="Prix maximum" style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.7rem', font: 'var(--type-body-sm)' }} />
                    </div>
                    <label style={{ display: 'grid', gap: '0.4rem', color: 'var(--text-subtle)', font: 'var(--type-label)' }}>
                      Disponibilité
                      <input
                        type="date"
                        value={availableFrom}
                        onChange={(event) => { const nextValue = event.target.value; setAvailableFrom(nextValue); updateUrl(view, radius, { availableFrom: nextValue }); }}
                        aria-label="Date de disponibilité"
                        style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.7rem', font: 'var(--type-body-sm)' }}
                      />
                    </label>
                  </>
                )}

                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <button type="button" onClick={applyFilters} style={{ border: 0, borderRadius: 'var(--radius-pill)', background: 'var(--brand)', color: '#fff', padding: '0.7rem 1rem', font: 'var(--type-body-sm)', cursor: 'pointer' }}>
                    {resultCount
                      ? resultCount.capped
                        ? 'Voir plus de 200 annonces'
                        : `Voir ${resultCount.count} annonce${resultCount.count > 1 ? 's' : ''}`
                      : 'Appliquer les filtres'}
                  </button>
                  {/* Offered only when there is something to undo. */}
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      style={{ border: 0, background: 'transparent', color: 'var(--text-muted)', padding: '0.4rem', font: 'var(--type-body-sm)', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>
              </div>
            </div>
          </aside>

          <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
            {error ? (
              <div style={{ ...cardStyle, padding: '1.5rem', color: 'var(--text-primary)' }}>{error}</div>
            ) : null}

            {view === 'map' ? (
              <div style={{ ...cardStyle, overflow: 'hidden', minHeight: 620 }}>
                {mapError ? (
                  <div style={{ padding: '1.5rem', color: 'var(--text-primary)' }}>{mapError}</div>
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
                    <ListingCard
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
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        background: 'transparent',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                        borderRadius: 'var(--radius-pill)',
                        height: '2.75rem',
                        padding: '0 1.2rem',
                        font: 'var(--weight-semibold) var(--type-body-md) var(--font-ui)',
                        cursor: loadingMore ? 'wait' : 'pointer',
                        opacity: loadingMore ? 0.7 : 1,
                      }}
                    >
                      {loadingMore ? 'Chargement…' : 'Afficher plus d\'annonces'}
                      <ArrowRight size={16} />
                    </button>
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

