'use client';

import { useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

/**
 * The seeded neighborhoods of a city (`GET /neighborhoods?city=`) as a
 * `<datalist>` for a free-text "Quartier" field. Owners and seekers who pick a
 * suggestion type the same spelling, so their searches meet; anything else
 * can still be typed. Suggestions are a convenience, so a failed load
 * renders an empty list rather than an error.
 */
export function NeighborhoodDatalist({ id, city }: { id: string; city: string }) {
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    const trimmed = city.trim();
    if (!trimmed) {
      setNames([]);
      return;
    }
    let isCurrent = true;
    apiFetch<string[]>(`/neighborhoods?city=${encodeURIComponent(trimmed)}`)
      .then((result) => {
        if (isCurrent) setNames(result);
      })
      .catch(() => {
        if (isCurrent) setNames([]);
      });
    return () => {
      isCurrent = false;
    };
  }, [city]);

  return (
    <datalist id={id}>
      {names.map((name) => (
        <option key={name} value={name} />
      ))}
    </datalist>
  );
}
