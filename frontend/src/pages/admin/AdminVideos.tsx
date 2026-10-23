import { useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { listVideos, updateVideo, type AdminVideo } from '../../lib/admin';
import { youtubeId, youtubeThumbnail } from '../../lib/youtube';

// Cada video es un par de links es/en, como los textos del módulo de preguntas.
type Draft = { es: string; en: string };
type SaveState = 'saving' | 'saved';

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

// Módulo "Gestión de videos": los 11 videos de la plataforma (bienvenida, el
// paso 2 de cada misión y el cierre), con su link en español y en inglés.
// Acepta cualquier link de YouTube; el backend vuelve a validarlo al guardar.
export default function AdminVideos({ canLeaveRef }: Props) {
  const { t } = useTranslation();

  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [loading, setLoading] = useState(true);
  // Errores del backend: texto crudo, no traducible.
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Solo lo tocado tiene borrador; el resto se lee del servidor.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    listVideos()
      .then((data) => {
        if (cancelled) return;
        setVideos(data);
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

  const server = useMemo(() => {
    const map = new Map<string, Draft>();
    for (const v of videos) map.set(v.id, { es: v.url_es, en: v.url_en ?? '' });
    return map;
  }, [videos]);

  function valueOf(id: string): Draft {
    return drafts[id] ?? server.get(id) ?? { es: '', en: '' };
  }

  function isDirty(id: string): boolean {
    const draft = drafts[id];
    const saved = server.get(id);
    if (!draft || !saved) return false;
    return draft.es !== saved.es || draft.en !== saved.en;
  }

  const dirtyCount = Object.keys(drafts).filter(isDirty).length;

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

  function edit(id: string, field: keyof Draft, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? server.get(id) ?? { es: '', en: '' }), [field]: value },
    }));
    setSaveState((prev) => (prev[id] === 'saved' ? without(prev, id) : prev));
  }

  function discard(id: string) {
    setDrafts((prev) => without(prev, id));
    setErrors((prev) => without(prev, id));
  }

  async function save(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setSaveState((prev) => ({ ...prev, [id]: 'saving' }));
    setErrors((prev) => without(prev, id));
    try {
      const updated = await updateVideo(id, draft.es, draft.en);
      setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      discard(id);
      setSaveState((prev) => ({ ...prev, [id]: 'saved' }));
    } catch (e) {
      setErrors((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : String(e) }));
      setSaveState((prev) => without(prev, id));
    }
  }

  if (loading) return <p className="admin-empty">{t('common.loading')}</p>;
  if (loadErr) return <p className="auth-error">{loadErr}</p>;
  if (videos.length === 0) {
    return <p className="admin-empty">{t('admin.videos.empty')}</p>;
  }

  return (
    <div className="admin-questions admin-videos">
      {dirtyCount > 0 && (
        <p className="admin-questions-unsaved" role="status">
          {t('admin.videos.unsavedCount', { count: dirtyCount })}
        </p>
      )}

      <ol className="admin-question-list">
        {videos.map((video) => {
          const draft = valueOf(video.id);
          const dirty = isDirty(video.id);
          const state = saveState[video.id];
          const esId = youtubeId(draft.es);
          const enId = youtubeId(draft.en);
          // El español es obligatorio; el inglés puede quedar vacío, pero si
          // tiene algo tiene que ser un link válido.
          const invalid = !esId || (Boolean(draft.en.trim()) && !enId);
          const label =
            video.tipo === 'mision'
              ? t('admin.videos.mission', { numero: video.numero })
              : t(video.tipo === 'bienvenida' ? 'admin.videos.welcome' : 'admin.videos.closing');
          const hint =
            video.tipo === 'mision'
              ? t('admin.videos.missionHint')
              : t(video.tipo === 'bienvenida' ? 'admin.videos.welcomeHint' : 'admin.videos.closingHint');

          return (
            <li key={video.id} className={`admin-question${dirty ? ' is-dirty' : ''}`}>
              <h3 className="admin-video-title">{label}</h3>
              <p className="admin-video-hint">{hint}</p>

              <div className="admin-question-fields">
                {(['es', 'en'] as const).map((field) => {
                  const value = draft[field];
                  const id = field === 'es' ? esId : enId;
                  const empty = !value.trim();
                  return (
                    <label key={field} className="admin-question-field">
                      <span>
                        {t(field === 'es' ? 'admin.questions.spanish' : 'admin.questions.english')}
                      </span>
                      <input
                        type="url"
                        inputMode="url"
                        value={value}
                        placeholder={t('admin.videos.urlPlaceholder')}
                        onChange={(e) => edit(video.id, field, e.target.value)}
                        aria-invalid={(field === 'es' && empty) || (!empty && !id)}
                      />
                      {field === 'es' && empty ? (
                        <small className="admin-question-hint is-error">
                          {t('admin.questions.spanishRequired')}
                        </small>
                      ) : !empty && !id ? (
                        <small className="admin-question-hint is-error">
                          {t('admin.videos.invalidUrl')}
                        </small>
                      ) : field === 'en' && empty ? (
                        <small className="admin-question-hint">
                          {t('admin.videos.englishMissing')}
                        </small>
                      ) : null}
                      {id && (
                        <a
                          className="admin-video-preview"
                          href={`https://www.youtube.com/watch?v=${id}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={t('admin.videos.preview')}
                          title={t('admin.videos.preview')}
                        >
                          <img src={youtubeThumbnail(id)} alt="" loading="lazy" />
                        </a>
                      )}
                    </label>
                  );
                })}
              </div>

              {errors[video.id] && <p className="auth-error">{errors[video.id]}</p>}
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
                    onClick={() => discard(video.id)}
                    disabled={state === 'saving'}
                  >
                    {t('admin.questions.discard')}
                  </button>
                )}
                <button
                  type="button"
                  className="admin-pay"
                  onClick={() => save(video.id)}
                  disabled={!dirty || invalid || state === 'saving'}
                >
                  {state === 'saving' ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
