'use client';

import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, MapPin, Plus, ShieldCheck, Star, Trash2, UploadCloud } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch, ApiError, apiOrigin } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { AMENITY_LABELS, PROPERTY_TYPE_LABELS, ROOM_TYPE_LABELS } from '@/lib/labels';
import type { ListingPhoto, ListingStatus, PropertyType, RoomType } from '@/types/api';

const STEPS = [
  'Annonce',
  'Chambre',
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
  status: ListingStatus;
};

const photoActionStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  border: '1px solid var(--border-hairline)',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--surface-card)',
  color: 'var(--text-muted)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.45 : 1,
  padding: 0,
});

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
  // These start empty on purpose. They previously shipped a fully written
  // sample listing ("Chambre lumineuse", 3 200 MAD, a complete description),
  // so an owner who clicked through without editing published someone else's
  // words as their own. City and property/room type keep a default only
  // because they are closed selects that must hold a valid value.
  const [city, setCity] = useState('Rabat');
  const [district, setDistrict] = useState('');
  const [title, setTitle] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [description, setDescription] = useState('');
  const [amenityOptions, setAmenityOptions] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
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
      const token = await getIdToken();
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

        // A resumed draft may already have photos. Nothing could read them back
        // before GET /listings/{id}/photos existed, so the step always looked
        // empty even when the server held images.
        try {
          const existing = await apiFetch<ListingPhoto[]>(`/listings/${draft.id}/photos`, { token });
          if (isCurrent) setPhotos(existing);
        } catch {
          // Photos are additive to the step; failing to list them should not
          // block resuming the rest of the draft.
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

  const canGoNext = stepIndex < STEPS.length - 1;
  const canGoBack = stepIndex > 0;

  const draftPayload = () => ({
    title: title.trim(),
    city,
    neighborhood: district,
    latitude: Number(latitude),
    longitude: Number(longitude),
    priceRent: Number(monthlyRent.replace(/\s/g, '')),
    description: description.trim(),
    roomType,
    propertyType,
    amenityCodes: selectedAmenities,
  });

  const persistDraft = async (token: string) => {
    if (!latitude || !longitude || !monthlyRent.trim()) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Renseignez la localisation et le loyer avant de continuer.');
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
    setSubmitting(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setError('Connectez-vous pour enregistrer votre brouillon.');
        return;
      }
      await persistDraft(token);
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

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--bg-page) 0%, var(--sable-50) 100%)',
        color: 'var(--text-primary)',
        padding: 'var(--space-6) var(--gutter-mobile) var(--space-8)',
      }}
    >
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-5)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
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
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 32,
              borderRadius: 'var(--radius-pill)',
              background: draftId ? 'var(--brand-subtle)' : 'var(--sable-100)',
              color: draftId ? 'var(--brand)' : 'var(--text-muted)',
              padding: '0.45rem 0.8rem',
              font: 'var(--weight-medium) var(--type-label) var(--font-ui)',
            }}
          >
            {draftId ? 'Brouillon enregistré' : 'Brouillon non enregistré'}
          </span>
        </header>

        <section
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-xs)',
            padding: 'var(--space-5)',
            display: 'grid',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Étape {stepIndex + 1} sur {STEPS.length}
            </div>
            <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{step}</div>
          </div>

          <div
            style={{
              width: '100%',
              height: 8,
              borderRadius: '999px',
              background: 'var(--sable-100)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(135deg, var(--brand), var(--brand-hover))',
                borderRadius: 'inherit',
                transition: 'width 180ms ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {STEPS.map((label, index) => (
              <span
                key={label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 80,
                  borderRadius: 'var(--radius-pill)',
                  background: index === stepIndex ? 'var(--brand-subtle)' : 'var(--sable-50)',
                  color: index === stepIndex ? 'var(--brand)' : 'var(--text-muted)',
                  padding: '0.45rem 0.7rem',
                  font: 'var(--type-label)',
                  border: index === stepIndex ? '1px solid var(--brand-border)' : '1px solid var(--border-hairline)',
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </section>

        <section
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-xs)',
            padding: 'var(--space-5)',
          }}
        >
          {step === 'Annonce' && (
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>
                  <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>Titre de l’annonce</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    style={{
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--surface-card)',
                      color: 'var(--text-primary)',
                      padding: '0.82rem 0.9rem',
                      font: 'var(--type-body-md)',
                    }}
                  />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>
                    <span style={{ font: 'var(--type-label)' }}>Latitude</span>
                    <input required type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="34.0209" style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.82rem 0.9rem', font: 'var(--type-body-md)' }} />
                  </label>
                  <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>
                    <span style={{ font: 'var(--type-label)' }}>Longitude</span>
                    <input required type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="-6.8416" style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.82rem 0.9rem', font: 'var(--type-body-md)' }} />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>
                    <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>Ville</span>
                    <select value={city} onChange={(event) => setCity(event.target.value)} style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', color: 'var(--text-primary)', padding: '0.82rem 0.9rem', font: 'var(--type-body-md)' }}>
                      <option>Rabat</option>
                      <option>Casablanca</option>
                      <option>Marrakech</option>
                      <option>Tanger</option>
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>
                    <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>Quartier</span>
                    <select value={district} onChange={(event) => setDistrict(event.target.value)} style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', color: 'var(--text-primary)', padding: '0.82rem 0.9rem', font: 'var(--type-body-md)' }}>
                      <option>Agdal</option>
                      <option>Gauthier</option>
                      <option>Hassan</option>
                      <option>Médina</option>
                    </select>
                  </label>
                </div>
              </div>

              <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>
                <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={5}
                  style={{
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-card)',
                    color: 'var(--text-primary)',
                    padding: '0.82rem 0.9rem',
                    font: 'var(--type-body-md)',
                    resize: 'vertical',
                  }}
                />
              </label>
            </div>
          )}

          {step === 'Chambre' && (
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>
                  <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>Loyer mensuel</span>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={monthlyRent}
                      onChange={(event) => setMonthlyRent(event.target.value)}
                      style={{
                        width: '100%',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface-card)',
                        color: 'var(--text-primary)',
                        padding: '0.82rem 2.7rem 0.82rem 0.9rem',
                        font: 'var(--type-body-md)',
                      }}
                    />
                    <span style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', font: 'var(--type-label)' }}>MAD</span>
                  </div>
                </label>

                <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>
                  <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>Type de bien</span>
                  <select
                    value={propertyType}
                    onChange={(event) => setPropertyType(event.target.value as PropertyType)}
                    style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', color: 'var(--text-primary)', padding: '0.82rem 0.9rem', font: 'var(--type-body-md)' }}
                  >
                    {(Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]).map((value) => (
                      <option key={value} value={value}>{PROPERTY_TYPE_LABELS[value]}</option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>
                  <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>Type de chambre</span>
                  <select
                    value={roomType}
                    onChange={(event) => setRoomType(event.target.value as RoomType)}
                    style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', color: 'var(--text-primary)', padding: '0.82rem 0.9rem', font: 'var(--type-body-md)' }}
                  >
                    {(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map((value) => (
                      <option key={value} value={value}>{ROOM_TYPE_LABELS[value]}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Équipements</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {amenityOptions.map((amenity) => {
                    const isSelected = selectedAmenities.includes(amenity);
                    return (
                      <button
                        key={amenity}
                        type="button"
                        onClick={() => toggleAmenity(amenity)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          borderRadius: 'var(--radius-pill)',
                          border: isSelected ? '1px solid var(--brand-border)' : '1px solid var(--border-default)',
                          background: isSelected ? 'var(--brand-subtle)' : 'var(--surface-card)',
                          color: isSelected ? 'var(--brand)' : 'var(--text-primary)',
                          padding: '0.6rem 0.8rem',
                          font: 'var(--type-body-sm)',
                          cursor: 'pointer',
                        }}
                      >
                        {isSelected ? <Check size={14} /> : <Plus size={14} />}
                        {AMENITY_LABELS[amenity] ?? amenity}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 'Photos' && (
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <div
                style={{
                  border: '1px dashed var(--border-default)',
                  borderRadius: 'var(--radius-card)',
                  background: 'var(--sable-50)',
                  padding: 'var(--space-6)',
                  display: 'grid',
                  justifyItems: 'center',
                  textAlign: 'center',
                  gap: 'var(--space-3)',
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
                    color: 'var(--brand)',
                  }}
                >
                  <UploadCloud size={26} />
                </span>
                <div>
                  <div style={{ font: 'var(--type-h3)', color: 'var(--text-heading)' }}>Ajouter des photos</div>
                  <div style={{ marginTop: 6, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
                    La première photo devient la couverture. Formats JPG, PNG ou WebP, 5 Mo maximum.
                    Les métadonnées GPS sont retirées à l’enregistrement.
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(event) => void uploadFiles(event.target.files)}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: 'none',
                    background: 'var(--brand)',
                    color: '#fff',
                    borderRadius: 'var(--radius-pill)',
                    padding: '0.9rem 1.2rem',
                    font: 'var(--weight-semibold) var(--type-body-md) var(--font-ui)',
                    cursor: photoBusy ? 'wait' : 'pointer',
                    opacity: photoBusy ? 0.7 : 1,
                    boxShadow: 'var(--shadow-brand)',
                  }}
                >
                  {photoBusy ? 'Envoi en cours…' : 'Sélectionner des fichiers'}
                </button>
              </div>

              {photoError && (
                <p role="alert" style={{ margin: 0, color: 'var(--danger)', font: 'var(--type-body-sm)' }}>
                  {photoError}
                </p>
              )}

              {photos.length === 0 ? (
                <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
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
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
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
                      }}
                    >
                      <div style={{ position: 'relative', aspectRatio: '4 / 3', background: 'var(--sable-200)' }}>
                        <img
                          src={`${apiOrigin}${photo.url}`}
                          alt={`Photo ${index + 1} de l’annonce`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        {photo.isCover && (
                          <span
                            style={{
                              position: 'absolute',
                              top: 8,
                              left: 8,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              borderRadius: 'var(--radius-pill)',
                              background: 'var(--brand)',
                              color: '#fff',
                              padding: '0.25rem 0.6rem',
                              font: 'var(--weight-medium) var(--type-label) var(--font-ui)',
                            }}
                          >
                            <Star size={12} fill="currentColor" /> Couverture
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button
                            type="button"
                            aria-label="Déplacer la photo vers la gauche"
                            disabled={photoBusy || index === 0}
                            onClick={() => void movePhoto(index, -1)}
                            style={photoActionStyle(photoBusy || index === 0)}
                          >
                            <ArrowLeft size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label="Déplacer la photo vers la droite"
                            disabled={photoBusy || index === photos.length - 1}
                            onClick={() => void movePhoto(index, 1)}
                            style={photoActionStyle(photoBusy || index === photos.length - 1)}
                          >
                            <ArrowRight size={15} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {!photo.isCover && (
                            <button
                              type="button"
                              aria-label="Définir comme photo de couverture"
                              disabled={photoBusy}
                              onClick={() => void makeCover(photo.id)}
                              style={photoActionStyle(photoBusy)}
                            >
                              <Star size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label="Supprimer la photo"
                            disabled={photoBusy}
                            onClick={() => void removePhoto(photo.id)}
                            style={{ ...photoActionStyle(photoBusy), color: 'var(--danger)' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === 'Validation' && (
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-heading)' }}>
                  <ShieldCheck size={18} color="var(--success)" />
                  <span style={{ font: 'var(--weight-semibold) var(--type-body-md) var(--font-ui)' }}>Vérification avant publication</span>
                </div>

                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', borderBottom: '1px solid var(--border-hairline)', paddingBottom: 'var(--space-2)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Ville</span>
                    <span style={{ font: 'var(--weight-medium)', color: 'var(--text-heading)' }}>{city}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', borderBottom: '1px solid var(--border-hairline)', paddingBottom: 'var(--space-2)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Quartier</span>
                    <span style={{ font: 'var(--weight-medium)', color: 'var(--text-heading)' }}>{district}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', borderBottom: '1px solid var(--border-hairline)', paddingBottom: 'var(--space-2)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Prix</span>
                    <span style={{ font: 'var(--weight-medium)', color: 'var(--text-heading)' }}>{monthlyRent} MAD</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Photos</span>
                    <span style={{ font: 'var(--weight-medium)', color: 'var(--text-heading)' }}>1 ajoutée</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--sable-50)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-card-inner)',
                  padding: 'var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <MapPin size={18} color="var(--brand)" />
                <span style={{ color: 'var(--text-body)' }}>{title} · {district}, {city}</span>
              </div>
            </div>
          )}
        </section>

        {error ? <p role="alert" style={{ margin: 0, color: 'var(--error)', font: 'var(--type-body-sm)' }}>{error}</p> : null}
        {saved ? <p role="status" style={{ margin: 0, color: 'var(--success)', font: 'var(--type-body-sm)' }}>Annonce envoyée pour validation.</p> : null}
        {/*
          Stated up front, not discovered after saving: an edit to a live
          listing takes it out of public search until a moderator approves it
          again.
        */}
        {isEditing && wasLive && !saved ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>
            Cette annonce est en ligne. Après modification, elle repassera en validation et ne sera
            pas visible dans les résultats de recherche tant qu’elle n’aura pas été approuvée.
          </p>
        ) : null}
        <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={() => canGoBack && setStepIndex((value) => value - 1)}
            disabled={!canGoBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              minHeight: 44,
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface-card)',
              color: 'var(--text-primary)',
              padding: '0.8rem 1rem',
              font: 'var(--weight-medium) var(--type-body-md) var(--font-ui)',
              cursor: canGoBack ? 'pointer' : 'not-allowed',
              opacity: canGoBack ? 1 : 0.55,
            }}
          >
            <ChevronLeft size={16} />
            Retour
          </button>

          <button
            type="button"
            onClick={() => {
              if (stepIndex === STEPS.length - 1) {
                void publish();
              } else if (canGoNext) {
                void saveAndContinue();
              }
            }}
            disabled={submitting || saved}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              minHeight: 44,
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              background: 'linear-gradient(135deg, var(--brand), var(--brand-hover))',
              color: '#fff',
              padding: '0.8rem 1.2rem',
              font: 'var(--weight-semibold) var(--type-body-md) var(--font-ui)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-brand)',
            }}
          >
            {submitting
              ? 'Enregistrement…'
              : saved
                ? 'Annonce envoyée'
                : stepIndex === STEPS.length - 1
                  ? (isEditing ? 'Enregistrer les modifications' : 'Publier l’annonce')
                  : 'Suivant'}
            {stepIndex === STEPS.length - 1 ? null : <ChevronRight size={16} />}
          </button>
        </footer>
      </div>
    </main>
  );
}
