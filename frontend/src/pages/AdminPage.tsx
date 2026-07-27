import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../i18n/useLanguage';
import {
  listUsers,
  setUserPaid,
  USER_SORTS,
  DEFAULT_SORT,
  type AdminUser,
  type UserSort,
} from '../lib/admin';

// Espera a que el usuario deje de escribir antes de pedirle la lista al backend.
const SEARCH_DEBOUNCE_MS = 300;

export default function AdminPage() {
  const { t } = useTranslation();
  const { lang } = useLanguage();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<UserSort>(DEFAULT_SORT);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Errores del backend: texto crudo, no traducible.
  const [errText, setErrText] = useState<string | null>(null);

  // Re-lee la lista al cambiar búsqueda u orden. El filtrado y el orden los
  // hace la base, no el navegador.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      listUsers(search, sort)
        .then((rows) => {
          if (!cancelled) {
            setUsers(rows);
            setErrText(null);
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setUsers([]);
            setErrText(e instanceof Error ? e.message : String(e));
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, sort]);

  async function togglePaid(user: AdminUser) {
    setSavingId(user.id);
    setErrText(null);
    try {
      const updated = await setUserPaid(user.id, !user.is_paid);
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u))
      );
    } catch (e) {
      setErrText(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingId(null);
    }
  }

  function formatDate(iso: string) {
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(
      new Date(iso)
    );
  }

  return (
    <main className="admin">
      <button className="mission-back" onClick={() => navigate('/forest')}>
        {t('common.backToMapArrow')}
      </button>

      <h1 className="admin-title">{t('admin.title')}</h1>
      <p className="admin-sub">{t('admin.subtitle')}</p>

      <div className="admin-controls">
        <input
          className="admin-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.searchPlaceholder')}
          aria-label={t('admin.searchPlaceholder')}
        />
        <label className="admin-sort">
          <span>{t('admin.sortLabel')}</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as UserSort)}
          >
            {USER_SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`admin.sort.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {errText && <p className="auth-error">{errText}</p>}

      {loading ? (
        <p className="admin-empty">{t('common.loading')}</p>
      ) : users.length === 0 ? (
        <p className="admin-empty">
          {search.trim() ? t('admin.noResults') : t('admin.empty')}
        </p>
      ) : (
        <>
          <p className="admin-count">
            {t('admin.userCount', { count: users.length })}
          </p>
          <ul className="admin-list">
            {users.map((u) => (
              <li key={u.id} className="admin-row">
                <div className="admin-row-who">
                  <span className="admin-row-name">
                    {u.full_name || t('admin.noName')}
                    {u.role === 'admin' && (
                      <span className="admin-badge-role">
                        {t('admin.roleAdmin')}
                      </span>
                    )}
                  </span>
                  <span className="admin-row-email">{u.email}</span>
                  <span className="admin-row-date">
                    {t('admin.created')}: {formatDate(u.created_at)}
                  </span>
                </div>

                <div className="admin-row-paid">
                  <span
                    className={`admin-badge-paid ${u.is_paid ? 'yes' : 'no'}`}
                  >
                    {u.is_paid ? t('admin.paid') : t('admin.notPaid')}
                  </span>
                  <button
                    className={u.is_paid ? 'admin-unpay' : 'admin-pay'}
                    onClick={() => togglePaid(u)}
                    disabled={savingId === u.id}
                  >
                    {savingId === u.id
                      ? t('common.saving')
                      : u.is_paid
                        ? t('admin.markNotPaid')
                        : t('admin.markPaid')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
