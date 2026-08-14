import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../i18n/useLanguage';
import JourneyPageShell from './JourneyPageShell';
import {
  listUsers,
  setUserPaid,
  USER_SORTS,
  DEFAULT_SORT,
  PAGE_SIZE,
  type AdminUser,
  type UserSort,
} from '../lib/admin';

// Espera a que el usuario deje de escribir antes de pedirle la lista al backend.
const SEARCH_DEBOUNCE_MS = 300;

function AdminEmblemIcon() {
  return (
    <svg viewBox="0 0 40 40">
      <path d="M20 4.5 33 10v8.7c0 8.2-5.1 13.8-13 16.8-7.9-3-13-8.6-13-16.8V10l13-5.5Z" />
      <path d="M20 29V14" />
      <path d="M20 20c-4.8 0-7.3-2.3-7.3-6.3 4.8 0 7.3 2.3 7.3 6.3Zm0 3c4.9 0 7.7-2.2 7.7-6.3-4.9 0-7.7 2.2-7.7 6.3Z" />
    </svg>
  );
}

export default function AdminPage() {
  const { t } = useTranslation();
  const { lang } = useLanguage();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<UserSort>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Errores del backend: texto crudo, no traducible.
  const [errText, setErrText] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Al cambiar búsqueda u orden se vuelve a la primera página: quedarse en la
  // 4 con un filtro que devuelve 8 resultados mostraría una lista vacía.
  useEffect(() => {
    setPage(1);
  }, [search, sort]);

  // Re-lee la página al cambiar búsqueda, orden o página. El filtrado, el orden
  // y el corte los hace la base: el navegador nunca recibe la tabla entera.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      listUsers(search, sort, page)
        .then((res) => {
          if (!cancelled) {
            setUsers(res.users);
            setTotal(res.total);
            setErrText(null);
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setUsers([]);
            setTotal(0);
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
  }, [search, sort, page]);

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
    <JourneyPageShell
      pageClassName="admin-page"
      shellClassName="admin"
      eyebrow={t('admin.eyebrow')}
      title={t('admin.title')}
      subtitle={t('admin.subtitle')}
      emblem={<AdminEmblemIcon />}
    >
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
            {t('admin.userCount', { count: total })}
            {totalPages > 1 && ` · ${t('admin.pageOf', { page, totalPages })}`}
          </p>
          <ul className="admin-list">
            {users.map((u) => (
              <li key={u.id} className="admin-row">
                <div className="admin-row-identity">
                  <span className="admin-avatar" aria-hidden="true">
                    {(u.full_name || u.email || '?').trim().charAt(0).toUpperCase()}
                  </span>
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

          {totalPages > 1 && (
            <nav className="admin-pager" aria-label={t('admin.pagination')}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                {t('admin.prev')}
              </button>
              <span>{t('admin.pageOf', { page, totalPages })}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                {t('admin.next')}
              </button>
            </nav>
          )}
        </>
      )}
    </JourneyPageShell>
  );
}
