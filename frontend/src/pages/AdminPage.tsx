import { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import JourneyPageShell from './JourneyPageShell';
import AdminUsers from './admin/AdminUsers';
import AdminQuestions from './admin/AdminQuestions';
import AdminVideos from './admin/AdminVideos';

// Módulos del panel. El abierto va en la URL (?module=users): recargar o usar
// "atrás" del navegador lo respeta, y se puede compartir el enlace directo.
const MODULES = ['users', 'questions', 'videos'] as const;
type AdminModule = (typeof MODULES)[number];

function isModule(value: string | null): value is AdminModule {
  return MODULES.includes(value as AdminModule);
}

function AdminEmblemIcon() {
  return (
    <svg viewBox="0 0 40 40">
      <path d="M20 4.5 33 10v8.7c0 8.2-5.1 13.8-13 16.8-7.9-3-13-8.6-13-16.8V10l13-5.5Z" />
      <path d="M20 29V14" />
      <path d="M20 20c-4.8 0-7.3-2.3-7.3-6.3 4.8 0 7.3 2.3 7.3 6.3Zm0 3c4.9 0 7.7-2.2 7.7-6.3-4.9 0-7.7 2.2-7.7 6.3Z" />
    </svg>
  );
}

function ModuleIcon({ module }: { module: AdminModule }) {
  if (module === 'users') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="12" cy="11" r="4.5" />
        <path d="M3.5 26c.8-5 4.1-8 8.5-8s7.7 3 8.5 8" />
        <circle cx="22.5" cy="12.5" r="3.5" />
        <path d="M21 18.2c4 .2 6.7 2.9 7.5 7.3" />
      </svg>
    );
  }
  if (module === 'videos') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="3.5" y="7" width="25" height="18" rx="4" />
        <path d="M13.5 12.2v7.6l6.4-3.8z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 4.5h13l5 5v18H7z" />
      <path d="M20 4.5v5h5" />
      <path d="M13.2 14.2a2.9 2.9 0 1 1 3.6 2.8c-.6.2-.8.6-.8 1.2v.8" />
      <path d="M16 22.6v.2" />
    </svg>
  );
}

export default function AdminPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const rawModule = params.get('module');
  const active = isModule(rawModule) ? rawModule : null;

  // Un módulo puede tener cambios sin guardar (preguntas, videos): antes de volver a
  // las cards le pregunta a ese módulo si se puede salir.
  const canLeaveRef = useRef<() => boolean>(() => true);

  function open(module: AdminModule) {
    canLeaveRef.current = () => true;
    setParams({ module });
  }

  function back() {
    if (!canLeaveRef.current()) return;
    setParams({});
  }

  return (
    <JourneyPageShell
      pageClassName="admin-page"
      shellClassName="admin"
      eyebrow={t('admin.eyebrow')}
      title={t('admin.title')}
      subtitle={active ? t(`admin.modules.${active}.description`) : t('admin.subtitle')}
      emblem={<AdminEmblemIcon />}
    >
      {active ? (
        <section className="admin-module" aria-labelledby="admin-module-title">
          <header className="admin-module-header">
            <button
              className="admin-module-back"
              type="button"
              onClick={back}
              aria-label={t('admin.backToModules')}
            >
              <span aria-hidden="true">←</span>
            </button>
            <span className="admin-module-icon">
              <ModuleIcon module={active} />
            </span>
            <h2 id="admin-module-title">{t(`admin.modules.${active}.title`)}</h2>
          </header>

          {active === 'users' ? (
            <AdminUsers />
          ) : active === 'videos' ? (
            <AdminVideos canLeaveRef={canLeaveRef} />
          ) : (
            <AdminQuestions canLeaveRef={canLeaveRef} />
          )}
        </section>
      ) : (
        <ul className="admin-modules">
          {MODULES.map((module) => (
            <li key={module}>
              <button
                className="admin-module-card"
                type="button"
                onClick={() => open(module)}
              >
                <span className="admin-module-icon">
                  <ModuleIcon module={module} />
                </span>
                <span className="admin-module-card-text">
                  <span className="admin-module-card-title">
                    {t(`admin.modules.${module}.title`)}
                  </span>
                  <span className="admin-module-card-description">
                    {t(`admin.modules.${module}.description`)}
                  </span>
                </span>
                <span className="admin-module-card-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </JourneyPageShell>
  );
}
