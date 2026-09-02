import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
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
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Errores del backend: texto crudo, no traducible.
  const [errText, setErrText] = useState<string | null>(null);

  const sortMenuRef = useRef<HTMLDivElement>(null);
  const sortTriggerRef = useRef<HTMLButtonElement>(null);
  const sortOptionRefs = useRef<Partial<Record<UserSort, HTMLButtonElement | null>>>({});

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // El debounce vive acá, sobre el texto, y no sobre la request. Antes envolvía
  // al fetch entero, así que los 300 ms se pagaban también en la primera carga
  // (donde no hay tecleo que amortiguar) y en cada clic del paginador. Ahora
  // solo se demora lo que se está tecleando; página y orden salen al instante.
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Al cambiar búsqueda u orden se vuelve a la primera página: quedarse en la
  // 4 con un filtro que devuelve 8 resultados mostraría una lista vacía.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sort]);

  useEffect(() => {
    if (!sortOpen) return;

    sortOptionRefs.current[sort]?.focus();

    function closeOnOutsideClick(event: PointerEvent) {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setSortOpen(false);
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [sortOpen, sort]);

  // Re-lee la página al cambiar búsqueda, orden o página. El filtrado, el orden
  // y el corte los hace la base: el navegador nunca recibe la tabla entera.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listUsers(debouncedSearch, sort, page)
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

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, sort, page]);

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

  function chooseSort(nextSort: UserSort) {
    setSort(nextSort);
    setSortOpen(false);
    sortTriggerRef.current?.focus();
  }

  function handleSortOptionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    option: UserSort
  ) {
    const optionIndex = USER_SORTS.indexOf(option);
    let nextIndex = optionIndex;

    if (event.key === 'ArrowDown') nextIndex = (optionIndex + 1) % USER_SORTS.length;
    else if (event.key === 'ArrowUp') {
      nextIndex = (optionIndex - 1 + USER_SORTS.length) % USER_SORTS.length;
    } else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = USER_SORTS.length - 1;
    else if (event.key === 'Escape') {
      event.preventDefault();
      setSortOpen(false);
      sortTriggerRef.current?.focus();
      return;
    } else if (event.key === 'Tab') {
      setSortOpen(false);
      return;
    } else {
      return;
    }

    event.preventDefault();
    sortOptionRefs.current[USER_SORTS[nextIndex]]?.focus();
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
        <div className="admin-sort" ref={sortMenuRef}>
          <span className="admin-sort-label" id="admin-sort-label">
            {t('admin.sortLabel')}
          </span>
          <button
            ref={sortTriggerRef}
            className="admin-sort-trigger"
            type="button"
            aria-labelledby="admin-sort-label admin-sort-value"
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
            aria-controls="admin-sort-options"
            onClick={() => setSortOpen((open) => !open)}
          >
            <span id="admin-sort-value">{t(`admin.sort.${sort}`)}</span>
            <svg className="admin-sort-chevron" viewBox="0 0 20 20" aria-hidden="true">
              <path d="m4 7 6 6 6-6" />
            </svg>
          </button>

          {sortOpen && (
            <div
              className="admin-sort-options"
              id="admin-sort-options"
              role="listbox"
              aria-labelledby="admin-sort-label"
            >
              {USER_SORTS.map((s) => (
                <button
                  key={s}
                  ref={(node) => {
                    sortOptionRefs.current[s] = node;
                  }}
                  className="admin-sort-option"
                  type="button"
                  role="option"
                  aria-selected={sort === s}
                  onClick={() => chooseSort(s)}
                  onKeyDown={(event) => handleSortOptionKeyDown(event, s)}
                >
                  <span>{t(`admin.sort.${s}`)}</span>
                  {sort === s && (
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="m4 10 4 4 8-9" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
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
