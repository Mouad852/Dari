'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ds/Button';
import { TermsConsent } from '@/components/TermsConsent';
import { ApiError } from '@/lib/api';
import { getFirebaseUser } from '@/lib/firebase';
import { ensureProfile, loadPendingProfile, refreshVerifiedIdentity, savePendingProfile, sendVerificationEmail, type PendingProfile } from '@/lib/profile';

export function ProfileRecoveryForm({ termsVersion }: { termsVersion: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<PendingProfile>(() => loadPendingProfile() ?? { displayName: '', firstName: '', city: '', acceptedTermsVersion: termsVersion });
  const [email, setEmail] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void getFirebaseUser().then((user) => {
      if (!user) router.replace('/sign-in');
      else { setEmail(user.email); setPendingVerification(!user.emailVerified); }
    });
  }, [router]);

  async function sendVerification() {
    setBusy(true); setMessage(null);
    try { await sendVerificationEmail(); setMessage('E-mail de vérification envoyé.'); }
    catch { setMessage('Impossible d’envoyer l’e-mail pour le moment. Réessayez.'); }
    finally { setBusy(false); }
  }

  async function provision() {
    // The version on this page is the one being accepted, whatever was saved earlier.
    const accepted = { ...profile, acceptedTermsVersion: termsVersion };
    setBusy(true); setMessage(null); savePendingProfile(accepted);
    try {
      if (pendingVerification) { await refreshVerifiedIdentity(); setPendingVerification(false); }
      await ensureProfile(accepted); router.replace('/account');
    } catch (cause) {
      if (cause instanceof ApiError) { if (cause.code === 'IDENTITY_EMAIL_UNVERIFIED') setPendingVerification(true); setMessage(cause.message); }
      else if (cause instanceof Error && cause.message === 'PROFILE_FIELDS_REQUIRED') setMessage('Renseignez au moins votre nom d’affichage.');
      else setMessage('Le profil n’a pas pu être créé. Réessayez.');
    } finally { setBusy(false); }
  }

  const inputStyle = { border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', color: 'var(--text-heading)', padding: '0.82rem 0.9rem', font: 'var(--type-body)' };
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'var(--space-6) var(--gutter-mobile)' }}><section style={{ width: '100%', maxWidth: 560, display: 'grid', gap: 'var(--space-4)', background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-card)', padding: 'var(--space-5)' }}><div><h1 style={{ margin: 0, font: 'var(--type-h2)' }}>Finaliser votre profil</h1><p style={{ color: 'var(--text-muted)' }}>{email ? `Compte Firebase : ${email}` : 'Récupération de votre profil Dari.'}</p></div>{pendingVerification ? <div role="status" style={{ display: 'grid', gap: 'var(--space-3)', background: 'var(--brand-subtle)', padding: 'var(--space-4)', borderRadius: 'var(--radius-card-inner)' }}><strong>Votre e-mail doit être confirmé</strong><span>Ouvrez le message de vérification, puis revenez ici.</span><Button variant="secondary" onClick={() => void sendVerification()} disabled={busy} style={{ justifySelf: 'start' }}>Renvoyer l’e-mail</Button></div> : null}<label style={labelStyle}>Nom d’affichage<input maxLength={60} value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} style={inputStyle} /></label><label style={labelStyle}>Prénom<input maxLength={60} value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} style={inputStyle} /></label><label style={labelStyle}>Ville (facultatif)<input maxLength={60} value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} style={inputStyle} /></label>{message ? <p role="alert" style={{ color: 'var(--danger)' }}>{message}</p> : null}<TermsConsent lead="En créant votre profil" /><Button onClick={() => void provision()} loading={busy} fullWidth>{busy ? 'Vérification…' : 'Créer mon profil'}</Button></section></main>;
}

const labelStyle = { display: 'grid', gap: '.45rem', color: 'var(--text-muted)' } as const;
