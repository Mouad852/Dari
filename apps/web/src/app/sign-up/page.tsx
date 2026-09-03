'use client';

import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';

import { apiFetch, ApiError } from '@/lib/api';
import { getFirebaseAuth, getIdToken } from '@/lib/firebase';

export default function SignUpPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      const token = await getIdToken();
      if (!token) throw new Error('Firebase did not return an ID token');
      await apiFetch('/users', {
        method: 'POST',
        token,
        body: { displayName: `${firstName.trim()} ${lastName.trim()}`.trim(), firstName: firstName.trim(), city: city.trim() || null },
      });
      router.push('/account');
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else if (cause instanceof Error && cause.message.includes('email-already-in-use')) {
        setError('Cette adresse e-mail est déjà utilisée.');
      } else {
        setError('Inscription impossible. Vérifiez vos informations et réessayez.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = { border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', color: 'var(--text-heading)', padding: '0.82rem 0.9rem', font: 'var(--type-body)' };

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg, var(--bg-page) 0%, var(--sable-50) 100%)', color: 'var(--text-heading)', display: 'grid', placeItems: 'center', padding: 'var(--space-6) var(--gutter-mobile)' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <form onSubmit={handleSubmit} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-md)', padding: 'var(--space-5)', display: 'grid', gap: 'var(--space-4)' }}>
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <span style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', gap: '0.4rem', borderRadius: 'var(--radius-pill)', background: 'var(--brand-subtle)', color: 'var(--clay-700)', padding: '0.45rem 0.7rem', font: 'var(--type-label)' }}><ShieldCheck size={14} /> Créer un compte</span>
            <h1 style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Bienvenue chez Dari</h1>
            <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>Créez votre profil et trouvez une colocation qui correspond à votre quotidien.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>Prénom<input required value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" style={inputStyle} /></label>
            <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>Nom<input required value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" style={inputStyle} /></label>
          </div>
          <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>Ville (facultatif)<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Rabat" style={inputStyle} /></label>
          <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="vous@dari.ma" style={inputStyle} /></label>
          <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>Mot de passe<input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="6 caractères minimum" style={inputStyle} /></label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', borderRadius: 'var(--radius-card-inner)', background: 'var(--brand-subtle)', border: '1px solid var(--brand-border)', color: 'var(--clay-700)', padding: '0.8rem 0.9rem', font: 'var(--type-body-sm)' }}><CheckCircle2 size={16} /> Votre identité est sécurisée par Firebase.</div>
          {error ? <p role="alert" style={{ margin: 0, color: 'var(--danger)', font: 'var(--type-body-sm)' }}>{error}</p> : null}
          <button disabled={submitting} type="submit" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: 'none', borderRadius: 'var(--radius-pill)', background: 'var(--brand)', color: 'white', padding: '0.9rem 1.1rem', font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)', cursor: submitting ? 'wait' : 'pointer' }}>{submitting ? 'Création…' : 'Créer mon compte'} <ArrowRight size={16} /></button>
          <div style={{ textAlign: 'center', font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>Vous avez déjà un compte ? <button type="button" onClick={() => router.push('/sign-in')} style={{ border: 0, background: 'transparent', color: 'var(--clay-700)', padding: 0, font: 'inherit', cursor: 'pointer' }}>Se connecter</button></div>
        </form>
      </div>
    </main>
  );
}
