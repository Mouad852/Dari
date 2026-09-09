'use client';

import Link from 'next/link';
import { CheckCircle2, MapPin, Save, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { apiFetch, ApiError, apiOrigin } from '@/lib/api';
import { getIdToken, signOut } from '@/lib/firebase';
import { VERIFICATION_LABELS } from '@/lib/labels';
import type { Me } from '@/types/api';

export default function AccountProfilePage() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    let isCurrent = true;

    void (async () => {
      const idToken = await getIdToken();
      if (!idToken) {
        if (isCurrent) setError('Connectez-vous pour modifier votre profil.');
        return;
      }

      try {
        const me = await apiFetch<Me>('/users/me', { token: idToken });
        if (!isCurrent) return;
        setToken(idToken);
        setProfile(me);
        setFirstName(me.firstName ?? '');
        setDisplayName(me.displayName);
        setCity(me.city ?? '');
        setBio(me.bio ?? '');
      } catch (cause) {
        if (isCurrent) setError(cause instanceof ApiError ? cause.message : 'Impossible de charger votre profil.');
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, []);

  const uploadAvatar = async (file: File | undefined) => {
    if (!file || !token) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const updated = await apiFetch<Me>('/users/me/avatar', { method: 'POST', token, body: form });
      setProfile(updated);
    } catch (cause) {
      setAvatarError(cause instanceof ApiError ? cause.message : 'Envoi de la photo impossible.');
    } finally {
      setAvatarBusy(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const deleteAccount = async () => {
    if (!token || deleting) return;
    // Two steps on purpose. This is irreversible, cascades to every listing the
    // person owns, and there is no undo anywhere in the product.
    if (!window.confirm('Supprimer définitivement votre compte ? Vos annonces seront retirées.')) return;
    if (window.prompt('Pour confirmer, tapez SUPPRIMER') !== 'SUPPRIMER') return;

    setDeleting(true);
    try {
      await apiFetch('/users/me', { method: 'DELETE', token });
      await signOut();
      window.location.href = '/';
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Suppression impossible.');
      setDeleting(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!token || saving) return;

    setSaving(true);
    setSaved(false);
    setError(null);
    void (async () => {
      try {
        const updated = await apiFetch<Me>('/users/me', {
          method: 'PATCH',
          token,
          // Email and phone are Firebase's, not this form's — the API ignores
          // them in the body even if sent, but they are simply never included.
          body: {
            firstName: firstName.trim() || null,
            displayName: displayName.trim(),
            city: city.trim() || null,
            bio: bio.trim() || null,
          },
        });
        setProfile(updated);
        setSaved(true);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Impossible d’enregistrer votre profil.');
      } finally {
        setSaving(false);
      }
    })();
  };

  if (error && !profile) {
    return (
      <main style={{ minHeight: '100vh', padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-muted)' }}>
        <h1 style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Votre profil</h1>
        <p role="alert">{error}</p>
        {!token ? <Link href="/sign-in" style={{ color: 'var(--brand)' }}>Se connecter</Link> : null}
      </main>
    );
  }

  if (!profile) {
    return <main style={{ minHeight: '100vh', padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-muted)' }}>Chargement de votre profil…</main>;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--bg-page) 0%, var(--sable-50) 100%)',
        color: 'var(--text-heading)',
        padding: 'var(--space-6) var(--gutter-mobile) var(--space-8)',
      }}
    >
      <form onSubmit={handleSubmit} style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-5)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Compte
            </div>
            <h1 style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Profil public</h1>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              border: '1px solid var(--brand-border)',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--brand)',
              color: 'white',
              padding: '0.7rem 1rem',
              font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)',
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Save size={16} />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </header>

        {error ? <p role="alert" style={{ margin: 0, color: 'var(--danger)', font: 'var(--type-body-sm)' }}>{error}</p> : null}
        {saved ? (
          <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--brand)', font: 'var(--type-body-sm)' }}>
            <CheckCircle2 size={14} />
            Profil enregistré.
          </p>
        ) : null}

        <section
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-xs)',
            padding: 'var(--space-5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: '0.4rem', justifyItems: 'center' }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, var(--clay-100), var(--sand-100))',
                  color: 'var(--clay-700)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  font: 'var(--weight-extra) 26px/1 var(--font-display)',
                }}
              >
                {profile.avatarUrl ? (
                  <img
                    src={`${apiOrigin}${profile.avatarUrl}`}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  profile.displayName.charAt(0).toUpperCase()
                )}
              </div>

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => void uploadAvatar(event.target.files?.[0])}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                disabled={avatarBusy}
                onClick={() => avatarInputRef.current?.click()}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--brand)',
                  font: 'var(--type-body-sm)',
                  cursor: avatarBusy ? 'wait' : 'pointer',
                  padding: 0,
                }}
              >
                {avatarBusy ? 'Envoi…' : profile.avatarUrl ? 'Changer la photo' : 'Ajouter une photo'}
              </button>
              {avatarError ? (
                <p role="alert" style={{ margin: 0, maxWidth: 180, textAlign: 'center', color: 'var(--danger)', font: 'var(--type-caption)' }}>
                  {avatarError}
                </p>
              ) : null}
            </div>

            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ font: 'var(--type-h3)', color: 'var(--text-heading)' }}>{profile.displayName}</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    borderRadius: 'var(--radius-pill)',
                    background: profile.verification === 'NONE' ? 'var(--sable-100)' : 'var(--brand-subtle)',
                    color: profile.verification === 'NONE' ? 'var(--text-muted)' : 'var(--clay-700)',
                    padding: '0.3rem 0.55rem',
                    font: 'var(--type-label)',
                  }}
                >
                  <ShieldCheck size={12} />
                  {VERIFICATION_LABELS[profile.verification]}
                </span>
              </div>
              <div style={{ marginTop: 6, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
                {profile.email}{profile.phone ? ` · ${profile.phone}` : ''}
              </div>
            </div>
          </div>
        </section>

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
          <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>
            <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>Prénom</span>
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              maxLength={60}
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>
            <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>Nom affiché</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              maxLength={60}
              required
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>
            <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>Ville</span>
            <div style={{ position: 'relative' }}>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                maxLength={60}
                style={{ ...inputStyle, width: '100%', padding: '0.82rem 2.7rem 0.82rem 0.9rem', boxSizing: 'border-box' }}
              />
              <span style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <MapPin size={16} />
              </span>
            </div>
          </label>

          <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>
            <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>Biographie</span>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={600}
              rows={5}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </label>
        </section>
      </form>

      {/*
        Outside the form, and visually separated: this is destructive, cascades
        to every listing the person owns, and must not sit next to "Enregistrer"
        where a mis-click reads as a save.
      */}
      <section
        style={{
          maxWidth: 'var(--container-max)',
          margin: 'var(--space-6) auto 0',
          border: '1px solid var(--danger-border)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-5)',
          display: 'grid',
          gap: 'var(--space-3)',
        }}
      >
        <h2 style={{ margin: 0, font: 'var(--type-h3)', color: 'var(--text-heading)' }}>Supprimer le compte</h2>
        {/* Longhand, not the `font` shorthand -- see ReportDialog.tsx for why. */}
        <p style={{ margin: 0, fontWeight: 'var(--weight-regular)', fontSize: 'var(--text-body-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          La suppression est définitive. Vos annonces seront retirées. Vos messages restent visibles
          pour les personnes avec qui vous avez échangé, car une conversation appartient aussi à votre
          interlocuteur.
        </p>
        <button
          type="button"
          onClick={() => void deleteAccount()}
          disabled={deleting}
          style={{
            justifySelf: 'start',
            border: '1px solid var(--danger-border)',
            background: 'transparent',
            color: 'var(--danger)',
            borderRadius: 'var(--radius-pill)',
            padding: '0.8rem 1.1rem',
            font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)',
            cursor: deleting ? 'wait' : 'pointer',
          }}
        >
          {deleting ? 'Suppression…' : 'Supprimer définitivement mon compte'}
        </button>
      </section>
    </main>
  );
}

const inputStyle = {
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-card)',
  color: 'var(--text-heading)',
  padding: '0.82rem 0.9rem',
  font: 'var(--type-body)',
} as const;
