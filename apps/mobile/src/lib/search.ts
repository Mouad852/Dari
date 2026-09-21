import type { PublicListing } from '@/types/api';

export type SearchSort = 'recommended' | 'updated' | 'priceasc' | 'pricedesc';
export type SearchView = 'list' | 'map';

export interface ListingFilters {
  city: string;
  neighborhood: string;
  propertyType: string;
  roomType: string;
  furnishing: string;
  amenities: string[];
  priceMin: string;
  priceMax: string;
  availableFrom: string;
  sort: SearchSort;
}

export const EMPTY_FILTERS: ListingFilters = {
  city: '', neighborhood: '', propertyType: '', roomType: '', furnishing: '', amenities: [],
  priceMin: '', priceMax: '', availableFrom: '', sort: 'recommended',
};

export function validateFilters(filters: ListingFilters): string | null {
  const min = filters.priceMin.trim() ? Number(filters.priceMin) : null;
  const max = filters.priceMax.trim() ? Number(filters.priceMax) : null;
  if (min !== null && (!Number.isFinite(min) || min < 0)) return 'Le loyer minimum doit être un montant positif.';
  if (max !== null && (!Number.isFinite(max) || max < 0)) return 'Le loyer maximum doit être un montant positif.';
  if (min !== null && max !== null && min > max) return 'Le loyer minimum doit être inférieur au maximum.';
  if (filters.availableFrom && !/^\d{4}-\d{2}-\d{2}$/.test(filters.availableFrom)) return 'Utilisez le format AAAA-MM-JJ pour la disponibilité.';
  return null;
}

export function searchParams(filters: ListingFilters, cursor?: string): string {
  const params = new URLSearchParams();
  const add = (key: string, value: string) => { if (value.trim()) params.append(key, value.trim()); };
  add('city', filters.city);
  add('neighborhood', filters.neighborhood);
  add('propertyType', filters.propertyType);
  add('roomType', filters.roomType);
  add('furnishing', filters.furnishing);
  filters.amenities.forEach((amenity) => add('amenities', amenity));
  add('priceMin', filters.priceMin);
  add('priceMax', filters.priceMax);
  add('availableFrom', filters.availableFrom);
  add('sort', filters.sort);
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

export function dedupeListings(items: PublicListing[]): PublicListing[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}
