import { useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../i18n/useLanguage';
import {
  listQuestions,
  updateQuestion,
  updateMissionTexts,
  QUESTION_CATEGORIES,
  type AdminMission,
  type AdminQuestion,
  type MissionTextField,
} from '../../lib/admin';
import { TOTAL_MISSIONS } from '../../lib/missions';

// Todo lo editable acá es un par es/en: el título y la consecuencia amable de
// cada misión, su frase final y el enunciado de cada pregunta. Se distinguen
// por la clave: `m:<id>` (título), `a:<id>` / `b:<id>` (frases de portada 1
// y 2), `c:<id>` (consecuencia), `f:<id>` (frase final) o `q:<id>`.
type Draft = { es: string; en: string };
type SaveState = 'saving' | 'saved';

const missionKey = (id: string) => `m:${id}`;
const consequenceKey = (id: string) => `c:${id}`;
const finalKey = (id: string) => `f:${id}`;
const portada1Key = (id: string) => `a:${id}`;
const portada2Key = (id: string) => `b:${id}`;

// Prefijo de la clave -> texto de `missions` que edita.
const MISSION_KEY_FIELDS: Record<string, MissionTextField> = {
  'm:': 'titulo',
  'a:': 'frase1_portada',
  'b:': 'frase2_portada',
  'c:': 'consecuencia_amable',
  'f:': 'frase_final',
};
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

// Los textos multilínea de `missions` que el panel edita en <textarea>.
function normalizeMission<
  T extends Pick<
    AdminMission,
    | 'frase1_portada_es'
    | 'frase1_portada_en'
    | 'frase2_portada_es'
    | 'frase2_portada_en'
    | 'consecuencia_amable_es'
    | 'consecuencia_amable_en'
    | 'frase_final_es'
    | 'frase_final_en'
  >,
>(m: T): T {
  return {
    ...m,
    frase1_portada_es: normalize(m.frase1_portada_es),
    frase1_portada_en: m.frase1_portada_en == null ? null : normalize(m.frase1_portada_en),
    frase2_portada_es: normalize(m.frase2_portada_es),
    frase2_portada_en: m.frase2_portada_en == null ? null : normalize(m.frase2_portada_en),
    consecuencia_amable_es: normalize(m.consecuencia_amable_es),
    consecuencia_amable_en:
      m.consecuencia_amable_en == null ? null : normalize(m.consecuencia_amable_en),
    frase_final_es: normalize(m.frase_final_es),
    frase_final_en: m.frase_final_en == null ? null : normalize(m.frase_final_en),
  };
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

// Módulo "Gestión de misiones": el título, la consecuencia amable y las preguntas de cada misión, en
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
          data.map((m) => ({ ...normalizeMission(m), questions: m.questions.map(normalizeQuestion) }))
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
      map.set(consequenceKey(m.id), {
        es: m.consecuencia_amable_es,
        en: m.consecuencia_amable_en ?? '',
      });
      map.set(finalKey(m.id), { es: m.frase_final_es, en: m.frase_final_en ?? '' });
      map.set(portada1Key(m.id), { es: m.frase1_portada_es, en: m.frase1_portada_en ?? '' });
      map.set(portada2Key(m.id), { es: m.frase2_portada_es, en: m.frase2_portada_en ?? '' });
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
    const stateKey = key.startsWith('b:') ? portada1Key(key.slice(2)) : key;
    setSaveState((prev) => (prev[stateKey] === 'saved' ? without(prev, stateKey) : prev));
  }

  function discard(key: string) {
    setDrafts((prev) => without(prev, key));
    setErrors((prev) => without(prev, key));
  }

  // Guarda las claves pedidas. Las de `missions` de una misma misión van en un
  // solo request (así las dos frases de portada se guardan juntas); una
  // pregunta va sola.
  async function persist(keys: string[]) {
    const first = keys[0];
    const id = first.slice(2);
    if (MISSION_KEY_FIELDS[first.slice(0, 2)]) {
      const texts: Partial<Record<MissionTextField, Draft>> = {};
      for (const key of keys) texts[MISSION_KEY_FIELDS[key.slice(0, 2)]] = drafts[key];
      const updated = normalizeMission(await updateMissionTexts(id, texts));
      setMissions((prev) =>
        prev.map((m) => {
          if (m.id !== updated.id) return m;
          const next = { ...m };
          for (const field of Object.keys(texts) as MissionTextField[]) {
            Object.assign(next, {
              [`${field}_es`]: updated[`${field}_es`],
              [`${field}_en`]: updated[`${field}_en`],
            });
          }
          return next;
        })
      );
    } else {
      const updated = normalizeQuestion(await updateQuestion(id, drafts[first].es, drafts[first].en));
      setMissions((prev) =>
        prev.map((m) => ({
          ...m,
          questions: m.questions.map((x) => (x.id === updated.id ? updated : x)),
        }))
      );
    }
  }

  // `keys` comparten un botón Guardar: se guardan las que tienen cambios.
  // El estado (guardando / guardado / error) se anota en la primera.
  async function save(keys: string[]) {
    const pending = keys.filter((key) => drafts[key]);
    // La frase final es el único texto con el español opcional.
    if (pending.length === 0) return;
    if (pending.some((key) => !key.startsWith('f:') && !drafts[key].es.trim())) return;
    const stateKey = keys[0];
    setSaveState((prev) => ({ ...prev, [stateKey]: 'saving' }));
    setErrors((prev) => without(prev, stateKey));
    try {
      await persist(pending);
      for (const key of keys) discard(key);
      setSaveState((prev) => ({ ...prev, [stateKey]: 'saved' }));
    } catch (e) {
      setErrors((prev) => ({ ...prev, [stateKey]: e instanceof Error ? e.message : String(e) }));
      setSaveState((prev) => without(prev, stateKey));
    }
  }

  // Guardado, descartar y error: igual para título, consecuencia y preguntas.
  function renderActions(keyOrKeys: string | string[], esEmpty: boolean) {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    const key = keys[0];
    const dirty = keys.some(isDirty);
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
              onClick={() => keys.forEach(discard)}
              disabled={state === 'saving'}
            >
              {t('admin.questions.discard')}
            </button>
          )}
          <button
            type="button"
            className="admin-pay"
            onClick={() => save(keys)}
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
  const consKey = consequenceKey(mission.id);
  const consequence = valueOf(consKey);
  const p1Key = portada1Key(mission.id);
  const p2Key = portada2Key(mission.id);
  const portadas = [
    { key: p1Key, label: 'admin.questions.portada1', value: valueOf(p1Key) },
    { key: p2Key, label: 'admin.questions.portada2', value: valueOf(p2Key) },
  ];
  const portadaEsEmpty = portadas.some((p) => !p.value.es.trim());
  const fraseKey = finalKey(mission.id);
  const frase = valueOf(fraseKey);
  // La última misión no tiene siguiente: su frase final no se muestra nunca
  // (MissionCompletion la ignora), así que el bloque queda bloqueado.
  const fraseLocked = mission.numero === TOTAL_MISSIONS;

  function missionHasDirty(m: AdminMission) {
    return (
      dirtyKeys.includes(missionKey(m.id)) ||
      dirtyKeys.includes(portada1Key(m.id)) ||
      dirtyKeys.includes(portada2Key(m.id)) ||
      dirtyKeys.includes(consequenceKey(m.id)) ||
      dirtyKeys.includes(finalKey(m.id)) ||
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

        <section className="admin-question-block">
          <h4 className="admin-question-block-title">{t('admin.questions.portada')}</h4>
          <div
            className={`admin-question${isDirty(p1Key) || isDirty(p2Key) ? ' is-dirty' : ''}`}
          >
            <span className="admin-question-order">{t('admin.questions.portadaHint')}</span>
            {portadas.map(({ key, label, value }) => (
              <div key={key} className="admin-portada-group">
                <h5 className="admin-portada-label">{t(label)}</h5>
                <div className="admin-question-fields">
                  {(['es', 'en'] as const).map((field) => (
                    <label key={field} className="admin-question-field">
                      <span>
                        {t(field === 'es' ? 'admin.questions.spanish' : 'admin.questions.english')}
                      </span>
                      <textarea
                        value={value[field]}
                        rows={rowsFor(value[field])}
                        onChange={(e) => edit(key, field, e.target.value)}
                        aria-invalid={field === 'es' && !value.es.trim()}
                      />
                      {field === 'es' && !value.es.trim() ? (
                        <small className="admin-question-hint is-error">
                          {t('admin.questions.spanishRequired')}
                        </small>
                      ) : field === 'en' && !value.en.trim() ? (
                        <small className="admin-question-hint">
                          {t(
                            key === p2Key
                              ? 'admin.questions.portada2EnglishMissing'
                              : 'admin.questions.englishMissing'
                          )}
                        </small>
                      ) : null}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {renderActions([p1Key, p2Key], portadaEsEmpty)}
          </div>
        </section>

        <section className="admin-question-block">
          <h4 className="admin-question-block-title">{t('admin.questions.consequence')}</h4>
          <div className={`admin-question${isDirty(consKey) ? ' is-dirty' : ''}`}>
            <span className="admin-question-order">{t('admin.questions.consequenceHint')}</span>
            <div className="admin-question-fields">
              {(['es', 'en'] as const).map((field) => (
                <label key={field} className="admin-question-field">
                  <span>
                    {t(field === 'es' ? 'admin.questions.spanish' : 'admin.questions.english')}
                  </span>
                  <textarea
                    value={consequence[field]}
                    rows={rowsFor(consequence[field])}
                    onChange={(e) => edit(consKey, field, e.target.value)}
                    aria-invalid={field === 'es' && !consequence.es.trim()}
                  />
                  {field === 'es' && !consequence.es.trim() ? (
                    <small className="admin-question-hint is-error">
                      {t('admin.questions.spanishRequired')}
                    </small>
                  ) : field === 'en' && !consequence.en.trim() ? (
                    <small className="admin-question-hint">
                      {t('admin.questions.englishMissing')}
                    </small>
                  ) : null}
                </label>
              ))}
            </div>
            {renderActions(consKey, !consequence.es.trim())}
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

        <section className="admin-question-block">
          <h4 className="admin-question-block-title">{t('admin.questions.finalPhrase')}</h4>
          <div
            className={`admin-question${isDirty(fraseKey) ? ' is-dirty' : ''}${fraseLocked ? ' is-locked' : ''}`}
          >
            <span className="admin-question-order">{t('admin.questions.finalPhraseHint')}</span>
            {fraseLocked && (
              <p className="admin-question-hint">{t('admin.questions.finalPhraseLastMission')}</p>
            )}
            <div className="admin-question-fields">
              {(['es', 'en'] as const).map((field) => (
                <label key={field} className="admin-question-field">
                  <span>
                    {t(field === 'es' ? 'admin.questions.spanish' : 'admin.questions.english')}
                  </span>
                  <textarea
                    value={frase[field]}
                    rows={rowsFor(frase[field])}
                    onChange={(e) => edit(fraseKey, field, e.target.value)}
                    disabled={fraseLocked}
                  />
                  {fraseLocked ? null : field === 'es' && !frase.es.trim() ? (
                    <small className="admin-question-hint">
                      {t('admin.questions.finalPhraseEmpty')}
                    </small>
                  ) : field === 'en' && !frase.en.trim() ? (
                    <small className="admin-question-hint">
                      {t('admin.questions.englishMissing')}
                    </small>
                  ) : null}
                </label>
              ))}
            </div>
            {!fraseLocked && renderActions(fraseKey, false)}
          </div>
        </section>
      </div>
    </div>
  );
}
