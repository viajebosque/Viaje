import { useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../i18n/useLanguage';
import {
  listQuestions,
  updateQuestion,
  updateMissionTitle,
  QUESTION_CATEGORIES,
  type AdminMission,
  type AdminQuestion,
} from '../../lib/admin';

// Todo lo editable acá es un par es/en: el título de cada misión y el
// enunciado de cada pregunta. Se distinguen por la clave: `m:<id>` o `q:<id>`.
type Draft = { es: string; en: string };
type SaveState = 'saving' | 'saved';

const missionKey = (id: string) => `m:${id}`;
const questionKey = (id: string) => `q:${id}`;

// El modal de entrada del mapa (Forest.tsx) cambia a letra más chica cuando el
// título pasa de este largo.
const LONG_TITLE = 17;

// Los textos se cargaron con saltos CRLF. El <textarea> los devuelve como LF,
// así que sin normalizar cada pregunta multilínea aparecería "modificada" sin
// que nadie la tocara.
function normalize(text: string | null): string {
  return (text ?? '').replace(/\r\n?/g, '\n');
}

function normalizeQuestion(q: AdminQuestion): AdminQuestion {
  return {
    ...q,
    enunciado_es: normalize(q.enunciado_es),
    enunciado_en: q.enunciado_en == null ? null : normalize(q.enunciado_en),
  };
}

// Alto del textarea según el texto, para que se lea entero sin scroll interno.
function rowsFor(text: string): number {
  const lines = text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 72)), 0);
  return Math.min(16, Math.max(2, lines));
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

type Props = {
  // AdminPage la consulta antes de volver a las cards.
  canLeaveRef: MutableRefObject<() => boolean>;
};

// Módulo "Gestión de preguntas": el título de cada misión y sus preguntas, en
// orden y separadas por categoría, editables en español e inglés.
export default function AdminQuestions({ canLeaveRef }: Props) {
  const { t } = useTranslation();
  const { lang } = useLanguage();

  const [missions, setMissions] = useState<AdminMission[]>([]);
  const [loading, setLoading] = useState(true);
  // Errores del backend: texto crudo, no traducible.
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [numero, setNumero] = useState(1);

  // Solo lo tocado tiene borrador; el resto se lee del servidor.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    listQuestions()
      .then((data) => {
        if (cancelled) return;
        setMissions(
          data.map((m) => ({ ...m, questions: m.questions.map(normalizeQuestion) }))
        );
        setLoadErr(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Valor guardado de cada clave editable.
  const server = useMemo(() => {
    const map = new Map<string, Draft>();
    for (const m of missions) {
      map.set(missionKey(m.id), { es: m.titulo_es, en: m.titulo_en ?? '' });
      for (const q of m.questions) {
        map.set(questionKey(q.id), { es: q.enunciado_es, en: q.enunciado_en ?? '' });
      }
    }
    return map;
  }, [missions]);

  function valueOf(key: string): Draft {
    return drafts[key] ?? server.get(key) ?? { es: '', en: '' };
  }

  function isDirty(key: string): boolean {
    const draft = drafts[key];
    const saved = server.get(key);
    if (!draft || !saved) return false;
    return draft.es !== saved.es || draft.en !== saved.en;
  }

  const dirtyKeys = Object.keys(drafts).filter(isDirty);
  const dirtyCount = dirtyKeys.length;

  // Aviso al salir con cambios sin guardar: flecha del panel y cierre/recarga
  // de la pestaña.
  useEffect(() => {
    canLeaveRef.current = () =>
      dirtyCount === 0 || window.confirm(t('admin.questions.confirmLeave'));
    if (dirtyCount === 0) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyCount, canLeaveRef, t]);

  function edit(key: string, field: keyof Draft, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? server.get(key) ?? { es: '', en: '' }), [field]: value },
    }));
    setSaveState((prev) => (prev[key] === 'saved' ? without(prev, key) : prev));
  }

  function discard(key: string) {
    setDrafts((prev) => without(prev, key));
    setErrors((prev) => without(prev, key));
  }

  async function persist(key: string, draft: Draft) {
    const id = key.slice(2);
    if (key.startsWith('m:')) {
      const updated = await updateMissionTitle(id, draft.es, draft.en);
      setMissions((prev) =>
        prev.map((m) =>
          m.id === updated.id
            ? { ...m, titulo_es: updated.titulo_es, titulo_en: updated.titulo_en }
            : m
        )
      );
    } else {
      const updated = normalizeQuestion(await updateQuestion(id, draft.es, draft.en));
      setMissions((prev) =>
        prev.map((m) => ({
          ...m,
          questions: m.questions.map((x) => (x.id === updated.id ? updated : x)),
        }))
      );
    }
  }

  async function save(key: string) {
    const draft = drafts[key];
    if (!draft || !draft.es.trim()) return;
    setSaveState((prev) => ({ ...prev, [key]: 'saving' }));
    setErrors((prev) => without(prev, key));
    try {
      await persist(key, draft);
      discard(key);
      setSaveState((prev) => ({ ...prev, [key]: 'saved' }));
    } catch (e) {
      setErrors((prev) => ({ ...prev, [key]: e instanceof Error ? e.message : String(e) }));
      setSaveState((prev) => without(prev, key));
    }
  }

  // Guardado, descartar y error: igual para título y preguntas.
  function renderActions(key: string, esEmpty: boolean) {
    const dirty = isDirty(key);
    const state = saveState[key];
    return (
      <>
        {errors[key] && <p className="auth-error">{errors[key]}</p>}
        <div className="admin-question-actions">
          {state === 'saved' && !dirty && (
            <span className="admin-question-saved" role="status">
              {t('common.saved')}
            </span>
          )}
          {dirty && (
            <button
              type="button"
              className="admin-unpay"
              onClick={() => discard(key)}
              disabled={state === 'saving'}
            >
              {t('admin.questions.discard')}
            </button>
          )}
          <button
            type="button"
            className="admin-pay"
            onClick={() => save(key)}
            disabled={!dirty || esEmpty || state === 'saving'}
          >
            {state === 'saving' ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </>
    );
  }

  if (loading) return <p className="admin-empty">{t('common.loading')}</p>;
  if (loadErr) return <p className="auth-error">{loadErr}</p>;
  if (missions.length === 0) {
    return <p className="admin-empty">{t('admin.questions.empty')}</p>;
  }

  const mission = missions.find((m) => m.numero === numero) ?? missions[0];
  const missionTitle = (lang === 'en' && mission.titulo_en) || mission.titulo_es;
  const titleKey = missionKey(mission.id);
  const title = valueOf(titleKey);

  function missionHasDirty(m: AdminMission) {
    return (
      dirtyKeys.includes(missionKey(m.id)) ||
      m.questions.some((q) => dirtyKeys.includes(questionKey(q.id)))
    );
  }

  return (
    <div className="admin-questions">
      <div className="admin-questions-toolbar">
        <div
          className="admin-mission-tabs"
          role="tablist"
          aria-label={t('admin.questions.missionsLabel')}
        >
          {missions.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={m.numero === mission.numero}
              aria-controls="admin-mission-panel"
              className="admin-mission-tab"
              onClick={() => setNumero(m.numero)}
            >
              {t('admin.questions.missionTab', { numero: m.numero })}
              {missionHasDirty(m) && (
                <span
                  className="admin-mission-tab-dot"
                  title={t('admin.questions.unsavedMark')}
                  aria-label={t('admin.questions.unsavedMark')}
                />
              )}
            </button>
          ))}
        </div>
        {dirtyCount > 0 && (
          <p className="admin-questions-unsaved" role="status">
            {t('admin.questions.unsavedCount', { count: dirtyCount })}
          </p>
        )}
      </div>

      <div id="admin-mission-panel" role="tabpanel" className="admin-mission-panel">
        <h3 className="admin-mission-title">
          {t('mission.heading', { numero: mission.numero, titulo: missionTitle })}
        </h3>

        <section className="admin-question-block">
          <h4 className="admin-question-block-title">{t('admin.questions.missionTitle')}</h4>
          <div className={`admin-question${isDirty(titleKey) ? ' is-dirty' : ''}`}>
            <div className="admin-question-fields">
              {(['es', 'en'] as const).map((field) => (
                <label key={field} className="admin-question-field">
                  <span>
                    {t(field === 'es' ? 'admin.questions.spanish' : 'admin.questions.english')}
                  </span>
                  <input
                    type="text"
                    value={title[field]}
                    onChange={(e) => edit(titleKey, field, e.target.value)}
                    aria-invalid={field === 'es' && !title.es.trim()}
                  />
                  {field === 'es' && !title.es.trim() ? (
                    <small className="admin-question-hint is-error">
                      {t('admin.questions.spanishRequired')}
                    </small>
                  ) : field === 'en' && !title.en.trim() ? (
                    <small className="admin-question-hint">
                      {t('admin.questions.englishMissing')}
                    </small>
                  ) : title[field].trim().length > LONG_TITLE ? (
                    <small className="admin-question-hint">
                      {t('admin.questions.longTitle', { count: LONG_TITLE })}
                    </small>
                  ) : null}
                </label>
              ))}
            </div>
            {renderActions(titleKey, !title.es.trim())}
          </div>
        </section>

        {QUESTION_CATEGORIES.map((categoria) => {
          const questions = mission.questions.filter((q) => q.categoria === categoria);
          if (questions.length === 0) return null;
          return (
            <section key={categoria} className="admin-question-block">
              <h4 className="admin-question-block-title">
                {t(`mission.blocks.${categoria}`)}
                <span className="admin-question-block-count">{questions.length}</span>
              </h4>

              <ol className="admin-question-list">
                {questions.map((q) => {
                  const key = questionKey(q.id);
                  const draft = valueOf(key);
                  const esEmpty = !draft.es.trim();
                  return (
                    <li
                      key={q.id}
                      className={`admin-question${isDirty(key) ? ' is-dirty' : ''}`}
                    >
                      <span className="admin-question-order">
                        {t('admin.questions.order', { orden: q.orden })}
                      </span>

                      <div className="admin-question-fields">
                        <label className="admin-question-field">
                          <span>{t('admin.questions.spanish')}</span>
                          <textarea
                            value={draft.es}
                            rows={rowsFor(draft.es)}
                            onChange={(e) => edit(key, 'es', e.target.value)}
                            aria-invalid={esEmpty}
                          />
                          {esEmpty && (
                            <small className="admin-question-hint is-error">
                              {t('admin.questions.spanishRequired')}
                            </small>
                          )}
                        </label>
                        <label className="admin-question-field">
                          <span>{t('admin.questions.english')}</span>
                          <textarea
                            value={draft.en}
                            rows={rowsFor(draft.en)}
                            onChange={(e) => edit(key, 'en', e.target.value)}
                          />
                          {!draft.en.trim() && (
                            <small className="admin-question-hint">
                              {t('admin.questions.englishMissing')}
                            </small>
                          )}
                        </label>
                      </div>

                      {renderActions(key, esEmpty)}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
