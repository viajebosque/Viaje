import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { setNewPassword } from '../auth/auth';
import { authErrorKey } from '../auth/authErrors';
import forestBackground from '../assets/auth/forest-login-v5.png';
import branchTop from '../assets/auth/branch-top.webp';
import branchBottom from '../assets/auth/branch-bottom.webp';

const MIN_PASSWORD = 6;

// Cuánto se espera a que el cliente de Supabase termine de leer el enlace del
// correo. Con el flujo implícito los tokens vienen en el hash de la URL y el
// cliente los procesa solo, de forma asíncrona: si se declara el enlace
// inválido de inmediato, se lo declara antes de tiempo.
const SESSION_WAIT_MS = 2500;

type Status = 'checking' | 'ready' | 'invalid' | 'done';

const EyeIcon = ({ crossed = false }: { crossed?: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2.25 12s3.5-6 9.75-6 9.75 6 9.75 6-3.5 6-9.75 6S2.25 12 2.25 12Z" />
    <circle cx="12" cy="12" r="2.75" />
    {crossed && <path d="m4 4 16 16" />}
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9.25" />
    <path d="m7.75 12.4 2.9 2.9 5.6-6.1" />
  </svg>
);

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const settled = useRef(false);

  // Validar el enlace del correo.
  //
  // Supabase manda a esta URL de tres formas según cómo esté configurado el
  // proyecto, así que se contemplan las tres:
  //   - `#access_token=...&type=recovery`  → el cliente crea la sesión solo
  //   - `?code=...`                        → hay que canjearlo
  //   - `?token_hash=...&type=recovery`    → hay que verificarlo
  // Y si el enlace venció, vuelve con `error_description`.
  useEffect(() => {
    let alive = true;

    function settle(next: Status) {
      if (!alive || settled.current) return;
      settled.current = true;
      setStatus(next);
      // Los tokens salen de la barra de direcciones recién ahora: el cliente de
      // Supabase lee el hash por su cuenta y de forma asíncrona, así que
      // borrarlo antes de que termine deja el enlace inservible.
      const url = new URL(window.location.href);
      if (url.search || url.hash) {
        window.history.replaceState({}, '', url.pathname);
      }
    }

    // Un enlace de recuperación abre sesión: si llega, el enlace servía.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) settle('ready');
    });

    async function prepare() {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
      const failure =
        url.searchParams.get('error_description') ??
        url.searchParams.get('error') ??
        hash.get('error_description') ??
        hash.get('error');
      if (failure) {
        console.error('[auth] enlace de recuperación rechazado:', failure);
        settle('invalid');
        return;
      }

      const code = url.searchParams.get('code');
      const tokenHash = url.searchParams.get('token_hash');
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash: tokenHash,
          });
          if (error) throw error;
        }
      } catch (err) {
        console.error('[auth] no se pudo canjear el enlace:', err);
        settle('invalid');
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        settle('ready');
        return;
      }
      window.setTimeout(() => settle('invalid'), SESSION_WAIT_MS);
    }

    void prepare();

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorKey(null);
    if (password.length < MIN_PASSWORD) {
      setErrorKey('reset.tooShort');
      return;
    }
    if (password !== repeat) {
      setErrorKey('reset.mismatch');
      return;
    }
    setBusy(true);
    try {
      await setNewPassword(password);
      setStatus('done');
    } catch (err) {
      setErrorKey(authErrorKey(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="auth-wrap auth-wrap--single"
      style={{
        '--auth-background': `url(${forestBackground})`,
      } as CSSProperties}
    >
      <section className="auth-panel" aria-label={t('reset.title')}>
        <form className="auth-card" onSubmit={handleSubmit}>
          <img className="auth-branch auth-branch-top" src={branchTop} alt="" aria-hidden="true" />
          <img className="auth-branch auth-branch-bottom" src={branchBottom} alt="" aria-hidden="true" />

          <div className="auth-card-content">
            <header className="auth-heading">
              <h2>{status === 'done' ? t('reset.doneTitle') : t('reset.title')}</h2>
              <p>{status === 'done' ? t('reset.doneBody') : t('reset.subtitle')}</p>
            </header>

            {status === 'checking' && (
              <p className="auth-message auth-info" role="status">{t('reset.checking')}</p>
            )}

            {status === 'invalid' && (
              <>
                <div className="auth-notice auth-notice--warn" role="status">
                  <span className="auth-notice-icon" aria-hidden="true">
                    <EyeIcon crossed />
                  </span>
                  <div>
                    <strong>{t('reset.invalidTitle')}</strong>
                    <p>{t('reset.invalidBody')}</p>
                  </div>
                </div>
                <button
                  className="auth-primary"
                  type="button"
                  onClick={() => navigate('/', { replace: true })}
                >
                  {t('reset.backToLogin')}
                </button>
              </>
            )}

            {status === 'done' && (
              <>
                <div className="auth-notice" role="status">
                  <span className="auth-notice-icon" aria-hidden="true">
                    <CheckIcon />
                  </span>
                  <div>
                    <strong>{t('reset.doneTitle')}</strong>
                    <p>{t('reset.doneBody')}</p>
                  </div>
                </div>
                <button
                  className="auth-primary"
                  type="button"
                  onClick={() => navigate('/forest', { replace: true })}
                >
                  {t('reset.goToForest')}
                </button>
              </>
            )}

            {status === 'ready' && (
              <>
                <div className="auth-fields">
                  <label className="auth-field">
                    <span>{t('reset.newPassword')}</span>
                    <span className="auth-password-input">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={MIN_PASSWORD}
                        autoComplete="new-password"
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

                  <label className="auth-field">
                    <span>{t('reset.repeatPassword')}</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={repeat}
                      onChange={(e) => setRepeat(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={MIN_PASSWORD}
                      autoComplete="new-password"
                    />
                  </label>
                </div>

                <p className="auth-hint">{t('reset.hint', { min: MIN_PASSWORD })}</p>

                {errorKey && <p className="auth-message auth-error" role="alert">{t(errorKey, { min: MIN_PASSWORD })}</p>}

                <button className="auth-primary" type="submit" disabled={busy}>
                  {busy ? t('common.saving') : t('reset.action')}
                </button>
              </>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
