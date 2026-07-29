import { useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
} from '../auth/auth';
import forestBackground from '../assets/auth/forest-login.webp';
import forestMobileBackground from '../assets/auth/forest-login-mobile.webp';
import forestGuide from '../assets/auth/forest-guide.webp';
import branchTop from '../assets/auth/branch-top.webp';
import branchBottom from '../assets/auth/branch-bottom.webp';

type Mode = 'login' | 'signup';

const EyeIcon = ({ crossed = false }: { crossed?: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2.25 12s3.5-6 9.75-6 9.75 6 9.75 6-3.5 6-9.75 6S2.25 12 2.25 12Z" />
    <circle cx="12" cy="12" r="2.75" />
    {crossed && <path d="m4 4 16 16" />}
  </svg>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.38l-3.24-2.53c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.61A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.4 13.92A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.32-1.92V7.47H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.53l3.35-2.61Z" />
    <path fill="#EA4335" d="M12 5.95c1.47 0 2.78.5 3.82 1.49l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.95 5.47l3.35 2.61C7.19 7.71 9.4 5.95 12 5.95Z" />
  </svg>
);

export default function AuthPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const isSignup = mode === 'signup';
  const brandTitle = t('auth.title');

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setInfo(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (isSignup) {
        await signUpWithEmail(fullName, email, password);
        setInfo(t('auth.signupDone'));
        setMode('login');
      } else {
        await signInWithEmail(email, password);
        navigate('/forest', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main
      className="auth-wrap"
      style={{
        '--auth-background': `url(${forestBackground})`,
        '--auth-mobile-background': `url(${forestMobileBackground})`,
      } as CSSProperties}
    >
      <section className="auth-story" aria-labelledby="auth-brand-title">
        <div className="auth-brand">
          <h1 id="auth-brand-title">
            <span className="auth-brand-mark" aria-hidden="true">
              {brandTitle.charAt(0)}
            </span>
            {brandTitle.slice(1)}
          </h1>
          <p>{t('auth.brandLineOne')}</p>
          <p>{t('auth.brandLineTwo')}</p>
        </div>
        <img className="auth-guide" src={forestGuide} alt={t('auth.guideAlt')} />
      </section>

      <section className="auth-panel" aria-label={t('auth.accessArea')}>
        <form className="auth-card" onSubmit={handleSubmit}>
          <img className="auth-branch auth-branch-top" src={branchTop} alt="" aria-hidden="true" />
          <img className="auth-branch auth-branch-bottom" src={branchBottom} alt="" aria-hidden="true" />

          <div className="auth-card-content">
            <header className="auth-heading">
              <h2>{isSignup ? t('auth.signupWelcome') : t('auth.welcome')}</h2>
              <p>{isSignup ? t('auth.signupSubtitle') : t('auth.subtitle')}</p>
            </header>

            <div className="auth-tabs" role="group" aria-label={t('auth.accessMode')}>
              <button
                type="button"
                aria-pressed={!isSignup}
                className={!isSignup ? 'active' : ''}
                onClick={() => changeMode('login')}
              >
                {t('auth.login')}
              </button>
              <button
                type="button"
                aria-pressed={isSignup}
                className={isSignup ? 'active' : ''}
                onClick={() => changeMode('signup')}
              >
                {t('auth.signup')}
              </button>
            </div>

            <div className="auth-fields">
              {isSignup && (
                <label className="auth-field">
                  <span>{t('auth.name')}</span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('auth.namePlaceholder')}
                    required
                    autoComplete="name"
                  />
                </label>
              )}

              <label className="auth-field">
                <span>{t('auth.email')}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  required
                  autoComplete="email"
                />
              </label>

              <label className="auth-field">
                <span>{t('auth.password')}</span>
                <span className="auth-password-input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    aria-pressed={showPassword}
                  >
                    <EyeIcon crossed={showPassword} />
                  </button>
                </span>
              </label>
            </div>

            {!isSignup && (
              <button type="button" className="auth-forgot" onClick={() => setInfo(t('auth.passwordHelp'))}>
                {t('auth.forgotPassword')}
              </button>
            )}

            {error && <p className="auth-message auth-error" role="alert">{error}</p>}
            {info && <p className="auth-message auth-info" role="status">{info}</p>}

            <button className="auth-primary" type="submit" disabled={busy}>
              {busy
                ? t('auth.processing')
                : isSignup
                  ? t('auth.signupAction')
                  : t('auth.loginAction')}
            </button>

            <div className="auth-divider"><span>{t('common.or')}</span></div>

            <button className="auth-google" type="button" onClick={handleGoogle} disabled={busy}>
              <GoogleIcon />
              <span>{t('auth.google')}</span>
            </button>

            <p className="auth-legal">{t('auth.legal')}</p>
          </div>
        </form>
      </section>
    </main>
  );
}
