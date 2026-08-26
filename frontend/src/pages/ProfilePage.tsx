import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { changeEmail, changePassword } from '../auth/auth';
import { useLanguage } from '../i18n/useLanguage';
import JourneyPageShell from './JourneyPageShell';
import { getMissionTokenImage } from '../lib/missionTokens';
import {
  getCompletedMissionIds,
  getMissions,
  type MissionSummary,
} from '../lib/missions';
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

function ProfileEmblemIcon() {
  return (
    <svg viewBox="0 0 40 40">
      <circle cx="20" cy="13" r="6.5" />
      <path d="M8.5 33c1.8-7.2 6.2-10.8 11.5-10.8S29.7 25.8 31.5 33" />
      <path d="M20 35V25" />
      <path d="M20 29c-4.8 0-7.2-2.2-7.2-6.2 4.7 0 7.2 2.2 7.2 6.2Zm0 2.4c4.7 0 7.4-2.1 7.4-6.1-4.8 0-7.4 2.1-7.4 6.1Z" />
    </svg>
  );
}

function ProfileSectionIcon({ kind }: { kind: Block }) {
  if (kind === 'email') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  }
  if (kind === 'password') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c.8-4.2 3.3-6.3 7.5-6.3s6.7 2.1 7.5 6.3" />
    </svg>
  );
}

function AmuletsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5a3 3 0 1 1 6 0c0 1.7-1.3 2.7-3 2.7S9 6.7 9 5Z" />
      <circle cx="12" cy="14" r="6" />
      <path d="m9.5 14 1.7 1.7 3.6-3.8" />
    </svg>
  );
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const { lang } = useLanguage();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [amulets, setAmulets] = useState<MissionSummary[]>([]);
  const [amuletsLoading, setAmuletsLoading] = useState(true);
  const [amuletsError, setAmuletsError] = useState(false);

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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setAmuletsLoading(true);
    setAmuletsError(false);

    Promise.all([getMissions(lang), getCompletedMissionIds()])
      .then(([missions, completedIds]) => {
        if (cancelled) return;
        setAmulets(
          missions
            .filter(
              (mission) =>
                completedIds.has(mission.id) &&
                Boolean(getMissionTokenImage(mission.numero))
            )
            .sort((a, b) => a.numero - b.numero)
        );
      })
      .catch(() => {
        if (!cancelled) setAmuletsError(true);
      })
      .finally(() => {
        if (!cancelled) setAmuletsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lang, user]);

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
    <JourneyPageShell
      pageClassName="profile-page"
      shellClassName="profile"
      eyebrow={t('profile.eyebrow')}
      title={t('profile.title')}
      subtitle={t('profile.subtitle')}
      emblem={<ProfileEmblemIcon />}
      badge={(
        <span className={`profile-status ${profile?.is_paid ? 'paid' : 'free'}`}>
          {profile?.is_paid ? t('profile.statusPaid') : t('profile.statusFree')}
        </span>
      )}
    >
      <div className="profile-grid">
        <form className="profile-card" onSubmit={saveName}>
          <div className="profile-card-heading">
            <span className="profile-card-icon"><ProfileSectionIcon kind="name" /></span>
            <h2>{t('profile.nameSection')}</h2>
          </div>
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

        <form className="profile-card" onSubmit={saveEmail}>
          <div className="profile-card-heading">
            <span className="profile-card-icon"><ProfileSectionIcon kind="email" /></span>
            <h2>{t('profile.emailSection')}</h2>
          </div>
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

        <form className="profile-card profile-card--password" onSubmit={savePassword}>
          <div className="profile-card-heading">
            <span className="profile-card-icon"><ProfileSectionIcon kind="password" /></span>
            <h2>{t('profile.passwordSection')}</h2>
          </div>
          {hasPassword ? (
            <>
              <div className="profile-password-fields">
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
              </div>
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
            <p className="profile-hint profile-google-note">{t('profile.googleOnly')}</p>
          )}
        </form>

        <section className="profile-card profile-card--amulets" aria-labelledby="profile-amulets-title">
          <div className="profile-card-heading profile-amulets-heading">
            <span className="profile-card-icon"><AmuletsIcon /></span>
            <div>
              <h2 id="profile-amulets-title">{t('profile.amuletsSection')}</h2>
              <p className="profile-hint">{t('profile.amuletsIntro')}</p>
            </div>
            {!amuletsLoading && !amuletsError && (
              <span className="profile-amulets-count">
                {t('profile.amuletsCount', { count: amulets.length })}
              </span>
            )}
          </div>

          {amuletsLoading ? (
            <p className="profile-amulets-state">{t('common.loading')}</p>
          ) : amuletsError ? (
            <p className="profile-amulets-state profile-amulets-state--error">
              {t('profile.amuletsLoadError')}
            </p>
          ) : amulets.length === 0 ? (
            <p className="profile-amulets-state">{t('profile.amuletsEmpty')}</p>
          ) : (
            <ul className="profile-amulets-grid">
              {amulets.map((mission) => {
                const image = getMissionTokenImage(mission.numero);
                return (
                  <li className="profile-amulet" key={mission.id}>
                    <div className="profile-amulet-visual">
                      <img
                        src={image}
                        alt={t('profile.amuletImageAlt', { numero: mission.numero })}
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                      />
                    </div>
                    <p className="profile-amulet-mission">
                      {t('profile.amuletMission', { numero: mission.numero })}
                    </p>
                    <p className="profile-amulet-title">{mission.titulo}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <button className="profile-signout" type="button" onClick={() => void signOut()}>
        {t('auth.signOut')}
      </button>
    </JourneyPageShell>
  );
}
