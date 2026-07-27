import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { changeEmail, changePassword } from '../auth/auth';
import {
  getMyProfile,
  updateFullName,
  syncProfileEmail,
  type Profile,
} from '../lib/profile';

const MIN_PASSWORD = 6;

// Cada bloque avisa por separado: guardar el nombre no debe borrar el mensaje
// del correo. Se guarda la CLAVE i18n, no el texto, para que el mensaje cambie
// si la persona mueve el switch de idioma.
type Block = 'name' | 'email' | 'password';
type Feedback = { key: string; error?: boolean } | { raw: string; error: true };

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [busy, setBusy] = useState<Block | null>(null);
  const [msg, setMsg] = useState<Partial<Record<Block, Feedback>>>({});

  // ¿Tiene contraseña? Quien entró solo con Google no tiene una que cambiar.
  const providers = (user?.app_metadata?.providers ?? []) as string[];
  const hasPassword = providers.includes('email');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyProfile(user.id)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setFullName(p?.full_name ?? '');
        setEmail(user.email ?? '');
        // Si la persona confirmó un cambio de correo, Auth ya está actualizado
        // y la copia de profiles no: se iguala acá.
        if (user.email && p && p.email !== user.email) {
          void syncProfileEmail(user.id, user.email);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function say(block: Block, feedback: Feedback) {
    setMsg((prev) => ({ ...prev, [block]: feedback }));
  }

  function fail(block: Block, e: unknown) {
    const raw = e instanceof Error ? e.message : String(e);
    if (raw === 'CURRENT_PASSWORD_WRONG') {
      say(block, { key: 'profile.wrongPassword', error: true });
      return;
    }
    say(block, { raw, error: true });
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const name = fullName.trim();
    if (!name) {
      say('name', { key: 'profile.nameEmpty', error: true });
      return;
    }
    setBusy('name');
    try {
      await updateFullName(user.id, name);
      setProfile((p) => (p ? { ...p, full_name: name } : p));
      say('name', { key: 'common.saved' });
    } catch (err) {
      fail('name', err);
    } finally {
      setBusy(null);
    }
  }

  async function saveEmail(e: FormEvent) {
    e.preventDefault();
    const next = email.trim();
    if (!next || next === user?.email) {
      say('email', { key: 'profile.emailSame', error: true });
      return;
    }
    setBusy('email');
    try {
      await changeEmail(next);
      say('email', { key: 'profile.emailConfirmSent' });
    } catch (err) {
      fail('email', err);
    } finally {
      setBusy(null);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < MIN_PASSWORD) {
      say('password', { key: 'profile.passwordTooShort', error: true });
      return;
    }
    setBusy('password');
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      say('password', { key: 'profile.passwordChanged' });
    } catch (err) {
      fail('password', err);
    } finally {
      setBusy(null);
    }
  }

  function Msg({ block }: { block: Block }) {
    const m = msg[block];
    if (!m) return null;
    const text = 'raw' in m ? m.raw : t(m.key);
    return <p className={m.error ? 'auth-error' : 'auth-info'}>{text}</p>;
  }

  if (loading) return <div className="auth-loading">{t('common.loading')}</div>;

  return (
    <main className="profile">
      <button className="mission-back" onClick={() => navigate('/forest')}>
        {t('common.backToMapArrow')}
      </button>

      <h1 className="profile-title">{t('profile.title')}</h1>
      <p className="profile-sub">
        {profile?.is_paid ? t('profile.statusPaid') : t('profile.statusFree')}
      </p>

      {/* Nombre */}
      <form className="profile-card" onSubmit={saveName}>
        <h2>{t('profile.nameSection')}</h2>
        <label className="auth-field">
          <span>{t('auth.name')}</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t('auth.namePlaceholder')}
            autoComplete="name"
          />
        </label>
        <Msg block="name" />
        <button className="auth-primary" type="submit" disabled={busy === 'name'}>
          {busy === 'name' ? t('common.saving') : t('common.save')}
        </button>
      </form>

      {/* Correo */}
      <form className="profile-card" onSubmit={saveEmail}>
        <h2>{t('profile.emailSection')}</h2>
        <p className="profile-hint">{t('profile.emailHint')}</p>
        <label className="auth-field">
          <span>{t('auth.email')}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
            autoComplete="email"
          />
        </label>
        <Msg block="email" />
        <button
          className="auth-primary"
          type="submit"
          disabled={busy === 'email'}
        >
          {busy === 'email' ? t('common.saving') : t('common.save')}
        </button>
      </form>

      {/* Contraseña */}
      <form className="profile-card" onSubmit={savePassword}>
        <h2>{t('profile.passwordSection')}</h2>
        {hasPassword ? (
          <>
            <label className="auth-field">
              <span>{t('profile.currentPassword')}</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>
            <label className="auth-field">
              <span>{t('profile.newPassword')}</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={MIN_PASSWORD}
                autoComplete="new-password"
              />
            </label>
            <Msg block="password" />
            <button
              className="auth-primary"
              type="submit"
              disabled={busy === 'password'}
            >
              {busy === 'password' ? t('common.saving') : t('common.save')}
            </button>
          </>
        ) : (
          <p className="profile-hint">{t('profile.googleOnly')}</p>
        )}
      </form>

      <button className="profile-signout" onClick={() => void signOut()}>
        {t('auth.signOut')}
      </button>
    </main>
  );
}
