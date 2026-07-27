import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
} from '../auth/auth';

type Mode = 'login' | 'signup';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const isSignup = mode === 'signup';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (isSignup) {
        await signUpWithEmail(fullName, email, password);
        // Si la confirmación de email está activa en Supabase, no hay sesión aún.
        setInfo(
          'Cuenta creada. Revisa tu correo si se pide confirmación, luego inicia sesión.'
        );
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
      await signInWithGoogle(); // redirige fuera de la app
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">Un Viaje por el Bosque</h1>

        <div className="auth-tabs">
          <button
            type="button"
            className={!isSignup ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={isSignup ? 'active' : ''}
            onClick={() => setMode('signup')}
          >
            Crear cuenta
          </button>
        </div>

        {isSignup && (
          <label className="auth-field">
            <span>Nombre</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre"
              required
              autoComplete="name"
            />
          </label>
        )}

        <label className="auth-field">
          <span>Correo</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
            required
            autoComplete="email"
          />
        </label>

        <label className="auth-field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />
        </label>

        {error && <p className="auth-error">{error}</p>}
        {info && <p className="auth-info">{info}</p>}

        <button className="auth-primary" type="submit" disabled={busy}>
          {busy
            ? 'Procesando…'
            : isSignup
              ? 'Crear cuenta'
              : 'Iniciar sesión'}
        </button>

        <div className="auth-divider"><span>o</span></div>

        <button
          className="auth-google"
          type="button"
          onClick={handleGoogle}
          disabled={busy}
        >
          Continuar con Google
        </button>
      </form>
    </div>
  );
}
