'use client';

import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { getFirebaseAuth, sendPasswordReset } from '@/lib/firebase';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const submitRef = useRef<HTMLButtonElement | null>(null);

  /**
   * The submit button carries `disabled={submitting}`, and a browser blurs
   * whatever control it just disabled -- so a keyboard user who tabs to
   * "Se connecter" and presses Enter loses focus to `<body>` the instant the
   * request starts. On a failed login the error renders (its `role="alert"`
   * still announces it), but nothing ever gave focus back, leaving a
   * keyboard-only user stranded with no sense of where the page put them.
   * Arming only on an actual submit keeps this from firing on unrelated
   * `submitting` changes.
   */
  const shouldRefocusSubmitRef = useRef(false);
  useEffect(() => {
    if (!submitting && shouldRefocusSubmitRef.current) {
      shouldRefocusSubmitRef.current = false;
      submitRef.current?.focus();
    }
  }, [submitting]);

  /**
   * There was no password-recovery path anywhere in the app -- not even a
   * dead link. Found 2026-09-09. Firebase's client SDK owns the whole flow
   * (it sends the email itself), so this needed no backend work.
   *
   * Deliberately reports success even for `auth/user-not-found`: revealing
   * whether an address has an account is an account-enumeration leak, and
   * Firebase's own console setting for suppressing that server-side can't be
   * relied on to be turned on. A genuine client error (bad email format) or
   * a network failure still surfaces so the user isn't left thinking an
   * email is coming when nothing was sent.
   */
  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('Entrez votre e-mail ci-dessus pour recevoir un lien de réinitialisation.');
      return;
    }
    setError(null);
    setResetStatus('sending');
    try {
      await sendPasswordReset(email.trim());
      setResetStatus('sent');
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : '';
      if (code.includes('user-not-found')) {
        setResetStatus('sent');
      } else if (code.includes('invalid-email')) {
        setResetStatus('idle');
        setError('Adresse e-mail invalide.');
      } else {
        setResetStatus('idle');
        setError('Impossible d’envoyer l’e-mail pour le moment. Réessayez.');
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    shouldRefocusSubmitRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      router.push('/account');
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : '';
      setError(code.includes('invalid-credential') || code.includes('user-not-found')
        ? 'E-mail ou mot de passe incorrect.'
        : 'Connexion impossible. Réessayez dans un instant.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg, var(--bg-page) 0%, var(--sable-50) 100%)', color: 'var(--text-heading)', display: 'grid', placeItems: 'center', padding: 'var(--space-6) var(--gutter-mobile)' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <form onSubmit={handleSubmit} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-md)', padding: 'var(--space-5)', display: 'grid', gap: 'var(--space-4)' }}>
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <span style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', gap: '0.4rem', borderRadius: 'var(--radius-pill)', background: 'var(--brand-subtle)', color: 'var(--clay-700)', padding: '0.45rem 0.7rem', font: 'var(--type-label)' }}><ShieldCheck size={14} /> Connectez-vous</span>
            <h1 style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Bon retour</h1>
            <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>Accédez à votre compte et continuez votre recherche de colocation.</p>
          </div>
          <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>
            <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>E-mail</span>
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@dari.ma" autoComplete="email" style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', color: 'var(--text-heading)', padding: '0.82rem 0.9rem', font: 'var(--type-body)' }} />
          </label>
          <label style={{ display: 'grid', gap: '0.45rem', color: 'var(--text-muted)' }}>
            <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase' }}>Mot de passe</span>
            <span style={{ position: 'relative' }}>
              <input required minLength={6} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Votre mot de passe" autoComplete="current-password" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', color: 'var(--text-heading)', padding: '0.82rem 2.9rem 0.82rem 0.9rem', font: 'var(--type-body)' }} />
              <button type="button" aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setShowPassword((value) => !value)} style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </span>
          </label>
          {/*
            Deliberately outside the <label> above -- nested there, its text
            got folded into the password input's accessible name (a screen
            reader announced the field as "Mot de passe Afficher le mot de
            passe Mot de passe oublié ?"), which the eye-toggle button was
            already doing quietly before this existed.
          */}
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={resetStatus === 'sending'}
            style={{ justifySelf: 'end', marginTop: '-0.6rem', border: 0, background: 'transparent', color: 'var(--brand)', padding: 0, font: 'var(--type-body-sm) var(--font-ui)', cursor: resetStatus === 'sending' ? 'wait' : 'pointer' }}
          >
            Mot de passe oublié ?
          </button>
          {resetStatus === 'sent' ? (
            <p role="status" style={{ margin: 0, color: 'var(--text-heading)', font: 'var(--type-body-sm)' }}>
              Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être envoyé.
            </p>
          ) : null}
          {error ? <p role="alert" style={{ margin: 0, color: 'var(--danger)', font: 'var(--type-body-sm)' }}>{error}</p> : null}
          <button ref={submitRef} disabled={submitting} type="submit" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: 'none', borderRadius: 'var(--radius-pill)', background: 'var(--brand)', color: 'white', padding: '0.9rem 1.1rem', font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)', cursor: submitting ? 'wait' : 'pointer' }}>
            {submitting ? 'Connexion…' : 'Se connecter'} <ArrowRight size={16} />
          </button>
          <div style={{ textAlign: 'center', font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>Pas encore de compte ? <button type="button" onClick={() => router.push('/sign-up')} style={{ border: 0, background: 'transparent', color: 'var(--brand)', padding: 0, font: 'inherit', cursor: 'pointer' }}>Créer un compte</button></div>
        </form>
      </div>
    </main>
  );
}
