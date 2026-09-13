'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ds/Button';
import { Input } from '@/components/ds/Input';
import { centerFor, distanceMetres } from '@/lib/cities';

/**
 * Pick a listing's position by placing a pin on a map.
 *
 * The publish wizard asked owners to type a latitude and a longitude into two
 * number fields. Nobody knows their own coordinates, so in practice that field
 * pair was either left empty — blocking the save, since both are `@NotNull` —
 * or filled with the placeholder, which put every listing on the same corner of
 * Rabat.
 *
 * ## What the pin means, and who sees it
 *
 * The point placed here is the *exact* address, stored as given. It is not what
 * seekers see: every public read path runs it through `LocationFuzzer`, which
 * displaces it by up to 200 m using the listing id as the seed — so the offset
 * is stable per listing (it does not jitter between page loads, which would let
 * anyone average it away) but the real point never leaves the server. The copy
 * below says so, because an owner deciding how precisely to place a pin needs
 * to know which of the two things they are deciding.
 *
 * ## Why the coordinate fields are still here
 *
 * Collapsed, under the map, and no longer the primary affordance — but present,
 * because a map you can only click is unreachable by keyboard. Leaflet gives a
 * marker keyboard focus but no arrow-key movement, so the numeric pair is the
 * accessible path, and it doubles as the precise one when an owner has real
 * coordinates from somewhere else.
 */

export interface LocationPickerProps {
  /** Latitude as the wizard holds it: a string, possibly empty. */
  latitude: string;
  longitude: string;
  onChange: (latitude: string, longitude: string) => void;
  /** Centres the map before a pin exists, and checks the pin is near it. */
  city: string;
}

/** Six decimals is ~0.1 m. More is noise from a map click. */
const round6 = (n: number) => String(Math.round(n * 1e6) / 1e6);

/** Beyond this from the chosen city centre, the pin is probably a mistake. */
const CITY_SANITY_RADIUS_M = 60_000;

const MapCanvas = dynamic(
  async () => {
    const [{ MapContainer, Marker, TileLayer, useMap, useMapEvents }, leaflet, { useEffect }] =
      await Promise.all([import('react-leaflet'), import('leaflet'), import('react')]);

    // A divIcon, like the search map's: Leaflet's default marker images resolve
    // to paths the bundler does not emit, so the stock icon 404s.
    const pinIcon = leaflet.default.divIcon({
      className: 'dari-map-pin',
      html: '<span style="display:block; width:18px; height:18px; border-radius:999px; background:var(--brand); border:3px solid #fff; box-shadow:0 8px 18px rgba(28,20,16,0.28);"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    /**
     * MapContainer treats `center` as an initial value — changing the prop does
     * nothing. Moving the view therefore has to go through the map instance,
     * which is only reachable from a child.
     *
     * `to` is null whenever the view should stay where the user left it, which
     * is most of the time: see the note on `recenterTo` in the parent.
     */
    function Recenter({ to }: { to: [number, number] | null }) {
      const map = useMap();
      useEffect(() => {
        if (to) map.setView(to, map.getZoom());
      }, [map, to]);
      return null;
    }

    function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
      useMapEvents({
        click: (event) => onPick(event.latlng.lat, event.latlng.lng),
      });
      return null;
    }

    return function LocationPickerCanvas({
      center,
      recenterTo,
      pin,
      onPick,
    }: {
      center: [number, number];
      recenterTo: [number, number] | null;
      pin: [number, number] | null;
      onPick: (lat: number, lng: number) => void;
    }) {
      return (
        <MapContainer
          center={center}
          zoom={pin ? 16 : 12}
          scrollWheelZoom={false}
          style={{ height: 340, width: '100%' }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Recenter to={recenterTo} />
          <ClickToPlace onPick={onPick} />
          {pin && (
            <Marker
              position={pin}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const { lat, lng } = event.target.getLatLng();
                  onPick(lat, lng);
                },
              }}
            />
          )}
        </MapContainer>
      );
    };
  },
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 340,
          display: 'grid',
          placeItems: 'center',
          background: 'var(--sable-100)',
          color: 'var(--text-muted)',
          font: 'var(--type-body-sm)',
        }}
      >
        Chargement de la carte…
      </div>
    ),
  },
);

export function LocationPicker({ latitude, longitude, onChange, city }: LocationPickerProps) {
  const [manualOpen, setManualOpen] = useState(false);

  const pin = useMemo<[number, number] | null>(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!latitude || !longitude || Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return [lat, lng];
  }, [latitude, longitude]);

  const cityCenter = centerFor(city);
  const center = pin ?? cityCenter;

  /**
   * Once the owner has touched the map, the view is theirs.
   *
   * Recentring is for the two cases where the map would otherwise be looking at
   * the wrong place through no fault of the user: the city changed and no pin
   * exists yet, or a pin arrived from outside this component — a resumed draft,
   * or a coordinate typed into the manual pair, where following the number is
   * the whole point. A click or a drag sets this, and the view then stays put,
   * because panning the point you just clicked into the centre of the map is
   * disorienting in exactly the moment the user is concentrating on it.
   */
  const mapTouched = useRef(false);
  const recenterTo: [number, number] | null = pin
    ? (mapTouched.current ? null : pin)
    : cityCenter;

  const farFromCity =
    pin !== null && distanceMetres(pin, cityCenter) > CITY_SANITY_RADIUS_M;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-3)' }}>
      <div>
        <span style={{ display: 'block', font: 'var(--type-label)', color: 'var(--text-heading)', marginBottom: 'var(--space-2)' }}>
          Emplacement
        </span>
        <p style={{ margin: '0 0 var(--space-3)', font: 'var(--type-body-sm)', color: 'var(--text-body)' }}>
          Cliquez sur la carte pour placer votre logement, puis déplacez le point pour l’ajuster.
        </p>
      </div>

      <div
        style={{
          borderRadius: 'var(--radius-card)',
          overflow: 'hidden',
          border: '1px solid var(--border-hairline)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <MapCanvas
          center={center}
          recenterTo={recenterTo}
          pin={pin}
          onPick={(lat, lng) => {
            mapTouched.current = true;
            onChange(round6(lat), round6(lng));
          }}
        />
      </div>

      <p
        role="status"
        style={{ margin: 0, font: 'var(--type-caption)', color: pin ? 'var(--text-muted)' : 'var(--text-body)' }}
      >
        {pin
          ? `Point placé : ${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}. Les chercheurs verront une zone approximative d’environ 200 mètres autour, jamais votre adresse exacte.`
          : 'Aucun point placé. Cliquez sur la carte pour indiquer où se trouve le logement.'}
      </p>

      {farFromCity && (
        <p role="status" style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--warning)' }}>
          Ce point est loin de {city}. Vérifiez la ville sélectionnée : une annonce placée hors de sa
          ville n’apparaît pas dans les résultats de cette ville.
        </p>
      )}

      {/*
        A disclosure rather than a <details>: the DS Input is a <label> and works
        the same either way, but a controlled toggle keeps the button styled like
        every other secondary action on the page instead of a bare summary marker.
      */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          iconLeft={manualOpen ? 'chevron-down' : 'chevron-right'}
          aria-expanded={manualOpen}
          onClick={() => setManualOpen((open) => !open)}
        >
          Saisir les coordonnées manuellement
        </Button>
      </div>

      {manualOpen && (
        <div className="wizard-pair">
          <Input
            label="Latitude"
            type="number"
            step={0.000001}
            value={latitude}
            onChange={(event) => onChange(event.target.value, longitude)}
            placeholder="34.0209"
          />
          <Input
            label="Longitude"
            type="number"
            step={0.000001}
            value={longitude}
            onChange={(event) => onChange(latitude, event.target.value)}
            placeholder="-6.8416"
          />
        </div>
      )}
    </div>
  );
}
