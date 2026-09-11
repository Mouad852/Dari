'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { Card } from '@/components/ds/Card';
import { Icon } from '@/components/ds/Icon';
import { IconButton } from '@/components/ds/IconButton';
import { Input } from '@/components/ds/Input';
import { Select } from '@/components/ds/Select';
import { Switch } from '@/components/ds/Switch';
import { Tag } from '@/components/ds/Tag';
import { Textarea } from '@/components/ds/Textarea';
import { LocationPicker } from '@/components/LocationPicker';
import { apiFetch, ApiError, apiOrigin } from '@/lib/api';
import { CITIES } from '@/lib/cities';
import { getIdToken } from '@/lib/firebase';
import { AMENITY_LABELS, LISTING_ROOM_TYPE_LABELS, PROPERTY_TYPE_LABELS, ROOM_TYPE_LABELS } from '@/lib/labels';
import type { HouseRules, ListingPhoto, ListingRoom, ListingRoomType, ListingStatus, PropertyType, RoomType } from '@/types/api';

const HOURS = ['20:00', '21:00', '22:00', '23:00', '00:00', '06:00', '07:00', '08:00', '09:00'];

const STEPS = [
  'Annonce',
  'Pièces',
  'Chambre',
  'Règles',
  'Photos',
  'Validation',
] as const;

type DraftListing = {
  id: string;
  title: string;
  city: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  priceRent: number;
  description: string | null;
  propertyType: PropertyType | null;
  roomType: RoomType | null;
  amenityCodes: string[];
  houseRules: HouseRules | null;
  rooms: ListingRoom[];
  status: ListingStatus;
};

/** A room row while it's being edited in the wizard. `key` is client-only, never sent to the API. */
type WizardRoom = {
  key: string;
  roomType: ListingRoomType;
  isRentable: boolean;
  isShared: boolean;
  description: string;
};

/**
 * useSearchParams forces a Suspense boundary in the App Router; without one the
 * route cannot be statically rendered and the build fails.
 */
export default function PublishWizardPage() {
  return (
    <Suspense fallback={<main style={{ padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-muted)' }}>Chargement…</main>}>
      <PublishWizard />
    </Suspense>
  );
}

function PublishWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  // The step-chip jump (below) moves `stepIndex` from a `<button>` that then
  // unmounts -- the step it points at stops being "done" the moment it
  // becomes current, so it re-renders as a plain span. The browser has
  // nowhere to put focus when the element holding it disappears mid-click and
  // drops it to <body>, stranding a keyboard user with no sense of where they
  // landed. `Suivant`/`Retour` do not have this problem: that button stays
  // mounted across every step, so focus already survives without help.
  const stepHeadingRef = useRef<HTMLDivElement>(null);
  const pendingStepHeadingFocus = useRef(false);
  useEffect(() => {
    if (pendingStepHeadingFocus.current) {
      pendingStepHeadingFocus.current = false;
      stepHeadingRef.current?.focus();
    }
  }, [stepIndex]);
  // These start empty on purpose. They previously shipped a fully written
  // sample listing ("Chambre lumineuse", 3 200 MAD, a complete description),
  // so an owner who clicked through without editing published someone else's
  // words as their own. City and property/room type keep a default only
  // because they are closed selects that must hold a valid value.
  const [city, setCity] = useState<string>('Rabat');
  const [district, setDistrict] = useState('');
  const [title, setTitle] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [description, setDescription] = useState('');
  const [amenityOptions, setAmenityOptions] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [guestsAllowed, setGuestsAllowed] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('');
  const [quietHoursEnd, setQuietHoursEnd] = useState('');
  const [otherRules, setOtherRules] = useState('');
  const [rooms, setRooms] = useState<WizardRoom[]>([]);
  const [propertyType, setPropertyType] = useState<PropertyType>('STUDIO');
  const [roomType, setRoomType] = useState<RoomType>('PRIVATE');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  // Present when the owner arrived from "Modifier" on /account/listings.
  const editingId = searchParams.get('listing');
  const [editingStatus, setEditingStatus] = useState<ListingStatus | null>(null);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isCurrent = true;
    async function loadDraft() {
      // getIdToken rejects rather than resolving null when Firebase is missing
      // or misconfigured, and this call sat outside the try — so a bad config
      // surfaced as an unhandled promise rejection in the console and the step
      // simply never populated. Nothing is said here on purpose: an anonymous
      // visitor has no draft to resume either, and pressing Suivant reports the
      // failure through the save path, which is where it is actionable.
      let token: string | null = null;
      try {
        token = await getIdToken();
      } catch {
        return;
      }
      if (!token) return;
      try {
        // Editing a named listing reads the owner-scoped route, never
        // GET /listings/{id}: that one fuzzes coordinates even for the owner,
        // so an edit form fed by it would PATCH the fuzzed position back and
        // drift the listing away from its real location on every save.
        const draft = editingId
          ? await apiFetch<DraftListing>(`/listings/mine/${editingId}`, { token })
          : await apiFetch<DraftListing>('/listings/draft', { token });
        // Resuming picks up drafts only; an explicit edit opens any status.
        if (!isCurrent || (!editingId && draft.status !== 'DRAFT')) return;
        setEditingStatus(draft.status);
        setDraftId(draft.id);
        setTitle(draft.title);
        setCity(draft.city);
        setDistrict(draft.neighborhood);
        setLatitude(String(draft.latitude));
        setLongitude(String(draft.longitude));
        setMonthlyRent(String(draft.priceRent));
        setDescription(draft.description ?? '');
        setPropertyType(draft.propertyType ?? 'STUDIO');
        setRoomType(draft.roomType ?? 'PRIVATE');
        setSelectedAmenities(draft.amenityCodes);
        setSmokingAllowed(draft.houseRules?.smokingAllowed ?? false);
        setPetsAllowed(draft.houseRules?.petsAllowed ?? false);
        setGuestsAllowed(draft.houseRules?.guestsAllowed ?? false);
        setQuietHoursStart(draft.houseRules?.quietHoursStart?.slice(0, 5) ?? '');
        setQuietHoursEnd(draft.houseRules?.quietHoursEnd?.slice(0, 5) ?? '');
        setOtherRules(draft.houseRules?.otherRules ?? '');
        setRooms(draft.rooms.map((room) => ({
          key: room.id,
          roomType: room.roomType,
          isRentable: room.isRentable,
          isShared: room.isShared,
          description: room.description ?? '',
        })));

        // A resumed draft may already have photos. Nothing could read them back
        // before GET /listings/{id}/photos existed, so the step always looked
        // empty even when the server held images.
        try {
          const existing = await apiFetch<ListingPhoto[]>(`/listings/${draft.id}/photos`, { token });
          if (isCurrent) setPhotos(existing);
        } catch (cause) {
          // Photos are additive to the step, so this does not block resuming the
          // rest of the draft — but it is no longer silent. The publish button
          // is disabled while the list looks empty, and an owner whose photos
          // simply failed to load deserves to know that is why.
          if (isCurrent) {
            setPhotoError(
              cause instanceof ApiError
                ? cause.message
                : 'Impossible de charger les photos déjà envoyées.',
            );
          }
        }
      } catch (cause) {
        // A 404 is normal when simply landing on /publish with no draft yet.
        // It is not normal when an id was named, so that one surfaces.
        if (cause instanceof ApiError && isCurrent && (editingId || cause.status !== 404)) {
          setError(cause.message);
        }
      }
    }

    void loadDraft();
    apiFetch<string[]>('/amenities')
      .then((codes) => {
        if (isCurrent) setAmenityOptions(codes);
      })
      .catch(() => {
        // The step still works with no options rendered; nothing to select
        // beats a broken step.
      });
    return () => {
      isCurrent = false;
    };
  }, [editingId]);

  const isEditing = editingId !== null;
  // "Live" in the sense that matters here: currently reachable by the public,
  // so an edit has a visible cost.
  const wasLive = editingStatus === 'PUBLISHED';

  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  const step = STEPS[stepIndex];

  const toggleAmenity = (value: string) => {
    setSelectedAmenities((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const addRoom = (roomType: ListingRoomType) => {
    setRooms((current) => [
      ...current,
      { key: crypto.randomUUID(), roomType, isRentable: false, isShared: false, description: '' },
    ]);
  };

  const removeRoom = (index: number) => {
    setRooms((current) => current.filter((_, i) => i !== index));
  };

  const updateRoom = (index: number, patch: Partial<WizardRoom>) => {
    setRooms((current) => current.map((room, i) => (i === index ? { ...room, ...patch } : room)));
  };

  /** At most one room is "the one offered" — selecting one clears it on every other. */
  const setOfferedRoom = (index: number) => {
    setRooms((current) => current.map((room, i) => ({ ...room, isRentable: i === index })));
  };

  const canGoNext = stepIndex < STEPS.length - 1;
  const canGoBack = stepIndex > 0;

  const draftPayload = () => ({
    title: title.trim(),
    city,
    neighborhood: district.trim(),
    latitude: Number(latitude),
    longitude: Number(longitude),
    priceRent: Number(monthlyRent.replace(/\s/g, '')),
    description: description.trim(),
    roomType,
    propertyType,
    amenityCodes: selectedAmenities,
    houseRules: {
      smokingAllowed,
      petsAllowed,
      guestsAllowed,
      quietHoursStart: quietHoursStart ? `${quietHoursStart}:00` : null,
      quietHoursEnd: quietHoursEnd ? `${quietHoursEnd}:00` : null,
      otherRules: otherRules.trim() || null,
    },
    rooms: rooms.map((room) => ({
      roomType: room.roomType,
      isRentable: room.isRentable,
      isShared: room.isShared,
      description: room.description.trim() || null,
    })),
  });


  /**
   * The six fields `CreateListingRequest` marks @NotBlank/@NotNull, checked so
   * the wizard names the missing one instead of bouncing off a 400 — but only
   * as far as the step the owner has actually reached.
   *
   * This is checked per step because the whole-form version could not be
   * satisfied from step 1: the rent lives on step 2, so pressing Suivant on
   * step 1 asked for a field that was not on screen and the wizard could never
   * advance. That was true before the guard named its fields too — the old
   * condition required `monthlyRent` on the same first press — so publishing
   * has never worked from a fresh start. Found by walking the flow in a browser
   * with a real account, which nothing before this could do.
   *
   * `through` is the index of the last step whose fields count. Step 0
   * (Annonce) and step 1 (Pièces) collect everything but the rent; step 2
   * (Chambre) adds it.
   */
  const missingThrough = (through: number): string | null => {
    if (!title.trim()) return 'Donnez un titre à votre annonce avant de continuer.';
    if (!city.trim()) return 'Choisissez une ville avant de continuer.';
    if (!district.trim()) return 'Renseignez le quartier avant de continuer.';
    if (!latitude || !longitude) return 'Placez un point sur la carte pour indiquer où se trouve le logement.';
    if (through >= 2 && !monthlyRent.trim()) return 'Renseignez le loyer mensuel avant de continuer.';
    return null;
  };

  /** Everything the API requires. Null means a draft row can be written. */
  const missingRequired = (): string | null => missingThrough(STEPS.length - 1);

  const persistDraft = async (token: string) => {
    const missing = missingRequired();
    if (missing) {
      throw new ApiError(400, 'VALIDATION_FAILED', missing);
    }
    const options = { method: draftId ? 'PATCH' : 'POST', token, body: draftPayload() } as const;
    const draft = await apiFetch<DraftListing>(
      draftId ? `/listings/${draftId}` : '/listings',
      options,
    );
    if (!draftId) setDraftId(draft.id);
    return draft;
  };

  /**
   * Photos attach to a listing row, so one has to exist before the first upload.
   * Reaching this step normally creates the draft already (each Next persists),
   * but a direct landing or an earlier failure can leave draftId null.
   */
  const ensureDraft = async (token: string): Promise<string> => {
    if (draftId) return draftId;
    const draft = await persistDraft(token);
    return draft.id;
  };

  const refreshPhotos = useCallback(async (token: string, listingId: string) => {
    const current = await apiFetch<ListingPhoto[]>(`/listings/${listingId}/photos`, { token });
    setPhotos(current);
  }, []);

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setPhotoError('Connectez-vous pour ajouter des photos.');
        return;
      }
      const listingId = await ensureDraft(token);

      // Uploaded one at a time, not in parallel: the endpoint takes a single
      // file, and sequential upload keeps sortOrder and the first-photo-is-cover
      // rule deterministic instead of dependent on which response lands first.
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        await apiFetch<ListingPhoto>(`/listings/${listingId}/photos`, {
          method: 'POST',
          token,
          body: form,
        });
      }
      await refreshPhotos(token, listingId);
    } catch (cause) {
      setPhotoError(cause instanceof ApiError ? cause.message : 'Envoi de la photo impossible.');
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = async (photoId: string) => {
    if (!draftId) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      await apiFetch(`/listings/${draftId}/photos/${photoId}`, { method: 'DELETE', token });
      await refreshPhotos(token, draftId);
    } catch (cause) {
      setPhotoError(cause instanceof ApiError ? cause.message : 'Suppression impossible.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const makeCover = async (photoId: string) => {
    if (!draftId) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      await apiFetch(`/listings/${draftId}/photos/${photoId}?isCover=true`, { method: 'PATCH', token });
      await refreshPhotos(token, draftId);
    } catch (cause) {
      setPhotoError(cause instanceof ApiError ? cause.message : 'Impossible de définir la couverture.');
    } finally {
      setPhotoBusy(false);
    }
  };

  /**
   * Swaps a photo with its neighbour by writing both sort orders.
   *
   * Buttons rather than drag-and-drop: reordering has to work with a keyboard
   * and on touch, and hand-rolled drag gives neither. The ordering result is
   * identical either way.
   */
  const movePhoto = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (!draftId || target < 0 || target >= photos.length) return;
    const a = photos[index];
    const b = photos[target];
    if (!a || !b) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      await apiFetch(`/listings/${draftId}/photos/${a.id}?sortOrder=${b.sortOrder}`, { method: 'PATCH', token });
      await apiFetch(`/listings/${draftId}/photos/${b.id}?sortOrder=${a.sortOrder}`, { method: 'PATCH', token });
      await refreshPhotos(token, draftId);
    } catch (cause) {
      setPhotoError(cause instanceof ApiError ? cause.message : 'Réorganisation impossible.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const saveAndContinue = async () => {
    // Only what this step was responsible for. Complaining about the rent while
    // standing on the step before it is what made the wizard impassable.
    const missingHere = missingThrough(stepIndex);
    if (missingHere) {
      setError(missingHere);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setError('Connectez-vous pour enregistrer votre brouillon.');
        return;
      }
      // The draft row cannot exist until the API has all six required fields,
      // so step 1 advances without writing anything and the badge keeps telling
      // the truth: "Brouillon non enregistré" until there is a row to enregistrer.
      if (!missingRequired()) {
        await persistDraft(token);
      }
      setStepIndex((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Impossible d’enregistrer le brouillon.');
    } finally {
      setSubmitting(false);
    }
  };

  const publish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setError('Connectez-vous pour publier une annonce.');
        return;
      }

      const draft = await persistDraft(token);

      // Only a DRAFT or a REJECTED listing can be submitted. Editing a live one
      // is already a submission: the PATCH above moves PUBLISHED back to
      // PENDING_REVIEW server-side, so calling /submit here would be an illegal
      // transition and 409.
      const needsExplicitSubmit = draft.status === 'DRAFT' || draft.status === 'REJECTED';
      if (needsExplicitSubmit) {
        await apiFetch(`/listings/${draft.id}/submit`, { method: 'POST', token });
      }
      setEditingStatus(needsExplicitSubmit ? 'PENDING_REVIEW' : draft.status);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Publication impossible. Vérifiez vos informations.');
    } finally {
      setSubmitting(false);
    }
  };

  const isLastStep = stepIndex === STEPS.length - 1;
  const missingPhotos = photos.length === 0;

  /**
   * What `ListingSearchService.submit` demands on top of what a draft needs.
   *
   * A draft row only needs the six fields the create DTO marks required. The
   * submit gate adds four more — description, at least one photo, a property
   * type and a room type — and this wizard only knew about the photo, so
   * pressing Publier with everything else filled in returned a bare
   * "Description requise" from the server. Found by publishing a real listing
   * with a real account, which is a thing that has never worked from a fresh
   * start until now.
   *
   * Property and room type are closed selects that hold a default, so they
   * cannot actually be empty here; they are listed because the server checks
   * them and this function is meant to be a mirror of that gate, not a subset
   * that happens to pass today.
   */
  const missingForSubmit = (): string | null =>
    missingRequired() ??
    (!description.trim() ? 'Ajoutez une description avant de publier.' : null) ??
    (missingPhotos ? 'Ajoutez au moins une photo avant de publier.' : null) ??
    (!propertyType ? 'Choisissez un type de bien avant de publier.' : null) ??
    (!roomType ? 'Choisissez un type de chambre avant de publier.' : null);

  const submitBlocker = isLastStep ? missingForSubmit() : null;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--bg-page) 0%, var(--sable-50) 100%)',
        color: 'var(--text-heading)',
        padding: 'var(--space-6) var(--gutter-mobile) var(--space-8)',
      }}
    >
      <div
        style={{
          maxWidth: 'var(--container-prose)',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 'var(--space-5)',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Publier
            </div>
            <h1 style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>
              {isEditing ? 'Modifier l’annonce' : 'Nouvelle annonce'}
            </h1>
          </div>

          {/*
            Reflects whether a draft row actually exists on the server. This was
            previously fixed text, so it made the same claim about draft safety
            before anything had been sent as it did afterwards.
          */}
          <Badge tone={draftId ? 'brand' : 'neutral'} icon={draftId ? 'check' : undefined}>
            {draftId ? 'Brouillon enregistré' : 'Brouillon non enregistré'}
          </Badge>
        </header>

        <Card padding="var(--card-pad-lg)" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-4)' }}>
          <div
            ref={stepHeadingRef}
            tabIndex={-1}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}
          >
            <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Étape {stepIndex + 1} sur {STEPS.length}
            </div>
            <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{step}</div>
          </div>

          {/*
            A native progress element rather than two nested divs: it announces
            the value to a screen reader, which the divs did not, and it carries
            the same semantics the visual bar implies.
          */}
          <div
            role="progressbar"
            aria-valuenow={stepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-label="Progression du formulaire"
            style={{ width: '100%', height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--sable-100)', overflow: 'hidden' }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'var(--brand)',
                borderRadius: 'inherit',
                transition: 'width var(--dur-med) var(--ease-standard)',
              }}
            />
          </div>

          {/*
            The step chips were decorative spans: they highlighted the current
            step but said nothing about which ones were done, and they could not
            be clicked. A completed step is now a real button back to itself —
            no capability the Retour button did not already have, just fewer
            presses — while an upcoming step stays inert, because moving forward
            has to go through the save that Suivant performs.

            Written out rather than built on Tag on purpose. Tag is a filter
            chip: it sets `aria-pressed` from `selected`, which is right for a
            toggle and wrong here, where a step is a position in a sequence.
            `aria-current="step"` is the attribute that says that, and the
            markup below is small enough not to be worth bending Tag around.
          */}
          <ol
            className="scroll-row"
            style={{ display: 'flex', gap: 'var(--space-2)', listStyle: 'none', margin: 0, padding: 0 }}
          >
            {STEPS.map((label, index) => {
              const done = index < stepIndex;
              const current = index === stepIndex;
              const chip: CSSProperties = {
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 36,
                padding: '0 14px',
                whiteSpace: 'nowrap',
                borderRadius: 'var(--radius-chip)',
                font: 'var(--weight-medium) var(--text-body-sm)/1 var(--font-ui)',
                background: current ? 'var(--sable-900)' : 'var(--surface-card)',
                color: current ? 'var(--text-on-inverse)' : done ? 'var(--text-body)' : 'var(--text-muted)',
                border: `1px solid ${current ? 'var(--sable-900)' : 'var(--border-hairline)'}`,
                transition: 'var(--transition-control)',
              };
              return (
                <li key={label} aria-current={current ? 'step' : undefined}>
                  {done ? (
                    <button
                      type="button"
                      onClick={() => {
                        // This button is about to unmount -- it only renders
                        // while its step is done, and jumping to it makes it
                        // current instead. Move focus to the step heading
                        // above so a keyboard user lands somewhere real
                        // rather than on <body>.
                        pendingStepHeadingFocus.current = true;
                        setStepIndex(index);
                      }}
                      style={{ ...chip, cursor: 'pointer' }}
                    >
                      <Icon name="check" size={15} />
                      {label}
                    </button>
                  ) : (
                    <span style={chip}>
                      {index + 1}. {label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>

        <Card padding="var(--card-pad-lg)" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>
          {step === 'Annonce' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-5)' }}>
              <Input
                label="Titre de l’annonce"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Chambre meublée proche du tramway"
                helper="Décrivez la chambre en quelques mots. C’est la première chose que lit un chercheur."
              />

              <div className="wizard-pair">
                <Select
                  label="Ville"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  options={[...CITIES]}
                />
                {/*
                  Free text, not a select. The select here offered four fixed
                  options -- Agdal, Gauthier, Hassan, Médina -- for every city,
                  which is one neighbourhood list from Rabat and one from
                  Casablanca shown to owners in Marrakech and Tanger. Worse, the
                  state started empty while the closed select displayed "Agdal",
                  so the form showed a neighbourhood it was not going to send.
                  The API takes a free string and the search page already treats
                  it as one.
                */}
                <Input
                  label="Quartier"
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                  placeholder="Agdal"
                />
              </div>

              {/*
                A map, not two number fields. Nobody knows their own latitude, so
                the pair this replaces was either left empty -- blocking the save,
                since both are @NotNull -- or filled with the placeholder, which
                put every listing on the same corner of Rabat. The manual pair is
                still there, collapsed inside the picker, because a map you can
                only click is unreachable by keyboard.
              */}
              <LocationPicker
                latitude={latitude}
                longitude={longitude}
                city={city}
                onChange={(lat, lng) => {
                  setLatitude(lat);
                  setLongitude(lng);
                }}
              />

              <Textarea
                label="Description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                placeholder="Le logement, le quartier, les colocataires, les règles de vie."
              />
            </div>
          )}

          {step === 'Pièces' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-5)' }}>
              <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
                Ajoutez chaque pièce du logement, indiquez celle qui est proposée et ce qui est partagé.
              </p>

              {rooms.map((room, index) => (
                <Card key={room.key} padding="var(--space-4)" style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
                    <Select
                      label="Type de pièce"
                      value={room.roomType}
                      onChange={(event) => updateRoom(index, { roomType: event.target.value as ListingRoomType })}
                      options={(Object.keys(LISTING_ROOM_TYPE_LABELS) as ListingRoomType[]).map((value) => ({
                        value,
                        label: LISTING_ROOM_TYPE_LABELS[value],
                      }))}
                      style={{ flex: 1 }}
                    />
                    <IconButton
                      icon="trash-2"
                      variant="ghost"
                      label={`Retirer la pièce ${index + 1}`}
                      onClick={() => removeRoom(index)}
                      style={{ color: 'var(--danger)' }}
                    />
                  </div>

                  <Tag
                    icon={room.isRentable ? 'check' : 'plus'}
                    selected={room.isRentable}
                    onClick={() => setOfferedRoom(index)}
                  >
                    C’est la pièce proposée
                  </Tag>

                  <Switch
                    label="Espace partagé"
                    checked={room.isShared}
                    onChange={(event) => updateRoom(index, { isShared: event.target.checked })}
                  />

                  <Input
                    label="Description"
                    value={room.description}
                    onChange={(event) => updateRoom(index, { description: event.target.value })}
                    placeholder="Facultatif"
                  />
                </Card>
              ))}

              <fieldset style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
                <legend style={{ padding: 0, font: 'var(--type-label)', color: 'var(--text-heading)' }}>
                  Ajouter une pièce
                </legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                  {(Object.keys(LISTING_ROOM_TYPE_LABELS) as ListingRoomType[]).map((roomType) => (
                    <Tag key={roomType} icon="plus" onClick={() => addRoom(roomType)}>
                      {LISTING_ROOM_TYPE_LABELS[roomType]}
                    </Tag>
                  ))}
                </div>
                <p style={{ margin: 'var(--space-3) 0 0', font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                  Un salon peut être la pièce proposée : ajoutez-le puis marquez-le comme non partagé.
                </p>
              </fieldset>
            </div>
          )}

          {step === 'Chambre' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-5)' }}>
              <div className="wizard-pair">
                <Input
                  label="Loyer mensuel"
                  value={monthlyRent}
                  onChange={(event) => setMonthlyRent(event.target.value)}
                  inputMode="numeric"
                  placeholder="3 200"
                  suffix="MAD"
                />
                <Select
                  label="Type de bien"
                  value={propertyType}
                  onChange={(event) => setPropertyType(event.target.value as PropertyType)}
                  options={(Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]).map((value) => ({
                    value,
                    label: PROPERTY_TYPE_LABELS[value],
                  }))}
                />
              </div>

              <Select
                label="Type de chambre"
                value={roomType}
                onChange={(event) => setRoomType(event.target.value as RoomType)}
                options={(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map((value) => ({
                  value,
                  label: ROOM_TYPE_LABELS[value],
                }))}
              />

              <fieldset style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
                <legend style={{ padding: 0, font: 'var(--type-label)', color: 'var(--text-heading)' }}>
                  Équipements
                </legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                  {amenityOptions.map((amenity) => {
                    const isSelected = selectedAmenities.includes(amenity);
                    return (
                      <Tag
                        key={amenity}
                        icon={isSelected ? 'check' : 'plus'}
                        selected={isSelected}
                        onClick={() => toggleAmenity(amenity)}
                      >
                        {AMENITY_LABELS[amenity] ?? amenity}
                      </Tag>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          )}

          {step === 'Règles' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-5)' }}>
              <Switch
                label="Fumeur accepté"
                description="À l’intérieur du logement"
                checked={smokingAllowed}
                onChange={(event) => setSmokingAllowed(event.target.checked)}
              />
              <Switch
                label="Animaux acceptés"
                description="Chats et petits chiens"
                checked={petsAllowed}
                onChange={(event) => setPetsAllowed(event.target.checked)}
              />
              <Switch
                label="Invités autorisés"
                description="Une nuit occasionnelle, prévenue à l’avance"
                checked={guestsAllowed}
                onChange={(event) => setGuestsAllowed(event.target.checked)}
              />

              <div>
                <div style={{ font: 'var(--type-label)', color: 'var(--text-heading)', marginBottom: 'var(--space-2)' }}>
                  Heures calmes
                </div>
                <div className="wizard-pair">
                  <Select
                    label="De"
                    value={quietHoursStart}
                    onChange={(event) => setQuietHoursStart(event.target.value)}
                    options={HOURS}
                  />
                  <Select
                    label="À"
                    value={quietHoursEnd}
                    onChange={(event) => setQuietHoursEnd(event.target.value)}
                    options={HOURS}
                  />
                </div>
              </div>

              <Textarea
                label="Autres règles"
                value={otherRules}
                onChange={(event) => setOtherRules(event.target.value)}
                rows={4}
                placeholder="Ménage des parties communes à tour de rôle, une semaine chacun."
                helper="Facultatif. Une règle par phrase."
              />
            </div>
          )}

          {step === 'Photos' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-5)' }}>
              <div
                style={{
                  border: '1px dashed var(--border-default)',
                  borderRadius: 'var(--radius-card)',
                  background: 'var(--sable-50)',
                  padding: 'var(--space-6) var(--space-5)',
                  display: 'grid',
                  justifyItems: 'center',
                  textAlign: 'center',
                  gap: 'var(--space-4)',
                }}
              >
                <span
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--brand-subtle)',
                    color: 'var(--clay-700)',
                  }}
                >
                  <Icon name="upload-cloud" size={26} />
                </span>
                <div>
                  <div style={{ font: 'var(--type-h3)', color: 'var(--text-heading)' }}>Ajouter des photos</div>
                  <p style={{ margin: '6px 0 0', font: 'var(--type-body-sm)', color: 'var(--text-body)' }}>
                    La première photo devient la couverture. Formats JPG, PNG ou WebP, 5 Mo maximum.
                    Les métadonnées GPS sont retirées à l’enregistrement.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(event) => void uploadFiles(event.target.files)}
                  style={{ display: 'none' }}
                />
                <Button
                  loading={photoBusy}
                  iconLeft={photoBusy ? undefined : 'plus'}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoBusy ? 'Envoi en cours…' : 'Sélectionner des fichiers'}
                </Button>
              </div>

              {photoError && (
                <p role="alert" style={{ margin: 0, color: 'var(--danger)', font: 'var(--type-body-sm)' }}>
                  {photoError}
                </p>
              )}

              {photos.length === 0 ? (
                <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-body)' }}>
                  Au moins une photo est requise pour publier votre annonce.
                </p>
              ) : (
                <ul
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'grid',
                    gap: 'var(--space-3)',
                    // 168px floor: four 36px action buttons plus their gaps and
                    // the tile's own padding need 162, so a narrower track puts
                    // the control row wider than the tile holding it.
                    gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
                  }}
                >
                  {photos.map((photo, index) => (
                    <li
                      key={photo.id}
                      style={{
                        border: '1px solid var(--border-hairline)',
                        borderRadius: 'var(--radius-card)',
                        overflow: 'hidden',
                        background: 'var(--surface-card)',
                        minWidth: 0,
                      }}
                    >
                      <div style={{ position: 'relative', aspectRatio: '4 / 3', background: 'var(--sable-200)' }}>
                        <img
                          src={`${apiOrigin}${photo.url}`}
                          alt={`Photo ${index + 1} de l’annonce`}
                          loading="lazy"
                          decoding="async"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        {photo.isCover && (
                          <Badge tone="brand" icon="star" size="sm" style={{ position: 'absolute', top: 8, left: 8 }}>
                            Couverture
                          </Badge>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: 'var(--space-2)' }}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <IconButton
                            icon="arrow-left"
                            size="sm"
                            variant="ghost"
                            label={`Déplacer la photo ${index + 1} vers la gauche`}
                            disabled={photoBusy || index === 0}
                            onClick={() => void movePhoto(index, -1)}
                          />
                          <IconButton
                            icon="arrow-right"
                            size="sm"
                            variant="ghost"
                            label={`Déplacer la photo ${index + 1} vers la droite`}
                            disabled={photoBusy || index === photos.length - 1}
                            onClick={() => void movePhoto(index, 1)}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {!photo.isCover && (
                            <IconButton
                              icon="star"
                              size="sm"
                              variant="ghost"
                              label={`Définir la photo ${index + 1} comme couverture`}
                              disabled={photoBusy}
                              onClick={() => void makeCover(photo.id)}
                            />
                          )}
                          <IconButton
                            icon="trash-2"
                            size="sm"
                            variant="ghost"
                            label={`Supprimer la photo ${index + 1}`}
                            disabled={photoBusy}
                            onClick={() => void removePhoto(photo.id)}
                            style={{ color: 'var(--danger)' }}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === 'Validation' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--text-heading)' }}>
                <Icon name="shield-check" size={18} color="var(--success)" />
                <span style={{ font: 'var(--weight-semibold) var(--type-body) var(--font-ui)' }}>
                  Vérification avant publication
                </span>
              </div>

              {/*
                A description list, and every row reads real state. The photo row
                previously said "1 ajoutée" as fixed text: an owner who had
                uploaded nothing, or six, was told the same thing, and the one
                number on the page that decides whether publishing succeeds was
                the one number that was invented.
              */}
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-3)' }}>
                <SummaryRow required label="Titre" value={title.trim() || undefined} />
                <SummaryRow required label="Ville" value={city} />
                <SummaryRow required label="Quartier" value={district.trim() || undefined} />
                <SummaryRow
                  required
                  label="Emplacement"
                  value={latitude && longitude ? `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}` : undefined}
                  missingLabel="Aucun point placé"
                />
                <SummaryRow required label="Loyer" value={monthlyRent.trim() ? `${monthlyRent.trim()} MAD` : undefined} />
                <SummaryRow label="Type de bien" value={PROPERTY_TYPE_LABELS[propertyType]} />
                <SummaryRow label="Type de chambre" value={ROOM_TYPE_LABELS[roomType]} />
                {/* Required: submit() refuses a listing with a blank description. */}
                <SummaryRow required label="Description" value={description.trim() ? 'Rédigée' : undefined} />
                <SummaryRow
                  label="Équipements"
                  value={selectedAmenities.length > 0 ? `${selectedAmenities.length} sélectionné${selectedAmenities.length > 1 ? 's' : ''}` : undefined}
                  missingLabel="Aucun"
                />
                <SummaryRow
                  label="Pièces"
                  value={rooms.length > 0 ? `${rooms.length} déclarée${rooms.length > 1 ? 's' : ''}` : undefined}
                  missingLabel="Aucune"
                />
                <SummaryRow
                  required
                  label="Photos"
                  value={photos.length > 0 ? `${photos.length} ajoutée${photos.length > 1 ? 's' : ''}` : undefined}
                  missingLabel="Aucune"
                />
              </dl>

              {submitBlocker && (
                <p role="alert" style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--danger)' }}>
                  {submitBlocker} Revenez à l’étape concernée pour la compléter.
                </p>
              )}

              <div
                style={{
                  background: 'var(--sable-50)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-card-inner)',
                  padding: 'var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  minWidth: 0,
                }}
              >
                <Icon name="map-pin" size={18} color="var(--brand)" />
                <span style={{ color: 'var(--text-body)', minWidth: 0 }}>
                  {[title.trim(), [district.trim(), city].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                </span>
              </div>
            </div>
          )}
        </Card>

        {error ? <p role="alert" style={{ margin: 0, color: 'var(--danger)', font: 'var(--type-body-sm)' }}>{error}</p> : null}
        {saved ? <p role="status" style={{ margin: 0, color: 'var(--success)', font: 'var(--type-body-sm)' }}>Annonce envoyée pour validation.</p> : null}
        {/*
          Stated up front, not discovered after saving: an edit to a live
          listing takes it out of public search until a moderator approves it
          again.
        */}
        {isEditing && wasLive && !saved ? (
          <p style={{ margin: 0, color: 'var(--text-body)', font: 'var(--type-body-sm)' }}>
            Cette annonce est en ligne. Après modification, elle repassera en validation et ne sera
            pas visible dans les résultats de recherche tant qu’elle n’aura pas été approuvée.
          </p>
        ) : null}

        <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <Button
            variant="secondary"
            iconLeft="chevron-left"
            disabled={!canGoBack}
            onClick={() => canGoBack && setStepIndex((value) => value - 1)}
          >
            Retour
          </Button>

          <Button
            variant="primary"
            iconRight={isLastStep ? undefined : 'chevron-right'}
            loading={submitting}
            disabled={saved || submitBlocker !== null}
            onClick={() => {
              if (isLastStep) {
                void publish();
              } else if (canGoNext) {
                void saveAndContinue();
              }
            }}
          >
            {submitting
              ? 'Enregistrement…'
              : saved
                ? 'Annonce envoyée'
                : isLastStep
                  ? (isEditing ? 'Enregistrer les modifications' : 'Publier l’annonce')
                  : 'Suivant'}
          </Button>
        </footer>
      </div>
    </main>
  );
}

/**
 * One line of the pre-publication summary.
 *
 * A field the owner never filled shows as missing rather than as an empty gap,
 * so the review step reads as a checklist instead of as a list with holes in it.
 *
 * `required` marks the six fields the API refuses a listing without. Only those
 * are red: an empty description is a choice, and colouring it like a blocker
 * would put seven alarms on a page where three are real.
 */
function SummaryRow({
  label,
  value,
  required = false,
  missingLabel = 'Non renseigné',
}: {
  label: string;
  value?: string;
  required?: boolean;
  missingLabel?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--space-2) var(--space-4)',
        borderBottom: '1px solid var(--border-hairline)',
        paddingBottom: 'var(--space-3)',
      }}
    >
      <dt style={{ color: 'var(--text-body)', font: 'var(--type-body-sm)' }}>{label}</dt>
      <dd
        style={{
          margin: 0,
          minWidth: 0,
          textAlign: 'right',
          font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)',
          color: value ? 'var(--text-heading)' : required ? 'var(--danger)' : 'var(--text-muted)',
        }}
      >
        {value ?? (required ? `${missingLabel} — obligatoire` : missingLabel)}
      </dd>
    </div>
  );
}
