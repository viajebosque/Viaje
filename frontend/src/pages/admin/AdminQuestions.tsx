import { useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../i18n/useLanguage';
import {
  listQuestions,
  updateQuestion,
  QUESTION_CATEGORIES,
  type AdminMission,
  type AdminQuestion,
} from '../../lib/admin';

type Draft = { es: string; en: string };
type SaveState = 'saving' | 'saved';

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

function serverDraft(q: AdminQuestion): Draft {
  return { es: q.enunciado_es, en: q.enunciado_en ?? '' };
}

// Alto del textarea según el texto, para que se lea entero sin scroll interno.
function rowsFor(text: string): number {
  const lines = text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 72)), 0);
  return Math.min(16, Math.max(2, lines));
}

type Props = {
  // AdminPage la consulta antes de volver a las cards.
  canLeaveRef: MutableRefObject<() => boolean>;
};

// Módulo "Gestión de preguntas": las preguntas de cada misión, en orden y
// separadas por categoría, editables en español e inglés.
export default function AdminQuestions({ canLeaveRef }: Props) {
  const { t } = useTranslation();
  const { lang } = useLanguage();

  const [missions, setMissions] = useState<AdminMission[]>([]);
  const [loading, setLoading] = useState(true);
  // Errores del backend: texto crudo, no traducible.
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [numero, setNumero] = useState(1);

  // Solo las preguntas tocadas tienen borrador; el resto se lee del servidor.
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

  const questionsById = useMemo(() => {
    const map = new Map<string, AdminQuestion>();
    for (const m of missions) for (const q of m.questions) map.set(q.id, q);
    return map;
  }, [missions]);

  function isDirty(id: string): boolean {
    const draft = drafts[id];
    const q = questionsById.get(id);
    if (!draft || !q) return false;
    const server = serverDraft(q);
    return draft.es !== server.es || draft.en !== server.en;
  }

  const dirtyIds = Object.keys(drafts).filter(isDirty);
  const dirtyCount = dirtyIds.length;

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

  function edit(q: AdminQuestion, field: keyof Draft, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [q.id]: { ...(prev[q.id] ?? serverDraft(q)), [field]: value },
    }));
    setSaveState((prev) => {
      if (prev[q.id] !== 'saved') return prev;
      const next = { ...prev };
      delete next[q.id];
      return next;
    });
  }

  function discard(id: string) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function save(q: AdminQuestion) {
    const draft = drafts[q.id];
    if (!draft || !draft.es.trim()) return;
    setSaveState((prev) => ({ ...prev, [q.id]: 'saving' }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[q.id];
      return next;
    });
    try {
      const updated = normalizeQuestion(await updateQuestion(q.id, draft.es, draft.en));
      setMissions((prev) =>
        prev.map((m) => ({
          ...m,
          questions: m.questions.map((x) => (x.id === updated.id ? updated : x)),
        }))
      );
      discard(q.id);
      setSaveState((prev) => ({ ...prev, [q.id]: 'saved' }));
    } catch (e) {
      setErrors((prev) => ({ ...prev, [q.id]: e instanceof Error ? e.message : String(e) }));
      setSaveState((prev) => {
        const next = { ...prev };
        delete next[q.id];
        return next;
      });
    }
  }

  if (loading) return <p className="admin-empty">{t('common.loading')}</p>;
  if (loadErr) return <p className="auth-error">{loadErr}</p>;
  if (missions.length === 0) {
    return <p className="admin-empty">{t('admin.questions.empty')}</p>;
  }

  const mission = missions.find((m) => m.numero === numero) ?? missions[0];
  const missionTitle = (lang === 'en' && mission.titulo_en) || mission.titulo_es;

  function missionHasDirty(m: AdminMission) {
    return m.questions.some((q) => dirtyIds.includes(q.id));
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
                  const draft = drafts[q.id] ?? serverDraft(q);
                  const dirty = isDirty(q.id);
                  const state = saveState[q.id];
                  const esEmpty = !draft.es.trim();
                  return (
                    <li
                      key={q.id}
                      className={`admin-question${dirty ? ' is-dirty' : ''}`}
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
                            onChange={(e) => edit(q, 'es', e.target.value)}
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
                            onChange={(e) => edit(q, 'en', e.target.value)}
                          />
                          {!draft.en.trim() && (
                            <small className="admin-question-hint">
                              {t('admin.questions.englishMissing')}
                            </small>
                          )}
                        </label>
                      </div>

                      {errors[q.id] && <p className="auth-error">{errors[q.id]}</p>}

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
                            onClick={() => discard(q.id)}
                            disabled={state === 'saving'}
                          >
                            {t('admin.questions.discard')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="admin-pay"
                          onClick={() => save(q)}
                          disabled={!dirty || esEmpty || state === 'saving'}
                        >
                          {state === 'saving' ? t('common.saving') : t('common.save')}
                        </button>
                      </div>
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
