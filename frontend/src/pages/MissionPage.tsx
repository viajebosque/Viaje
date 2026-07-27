import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import LangToggle from '../i18n/LangToggle';
import { useLanguage } from '../i18n/useLanguage';
import {
  getMissionByNumero,
  getQuestions,
  getAnswers,
  saveAnswers,
  completeMission,
  type Mission,
  type Question,
  type Categoria,
} from '../lib/missions';

// Orden en que se muestran los bloques. El nombre visible sale de i18n
// (mission.blocks.<categoria>).
const BLOQUES: Categoria[] = ['iniciacion', 'actividad', 'reflexion'];

export default function MissionPage() {
  const { numero } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { lang } = useLanguage();

  const [mission, setMission] = useState<Mission | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingBlock, setSavingBlock] = useState<Categoria | null>(null);
  const [claiming, setClaiming] = useState(false);
  // Mensajes de estado: se guarda la CLAVE i18n, no el texto, para que el
  // mensaje también cambie si el usuario mueve el switch de idioma.
  const [msgKey, setMsgKey] = useState<string | null>(null);
  // Errores de Supabase: texto crudo, no traducible.
  const [errText, setErrText] = useState<string | null>(null);
  const [tokenWon, setTokenWon] = useState(false);

  function clearMsg() {
    setMsgKey(null);
    setErrText(null);
  }

  // Re-lee misión y preguntas al cambiar de misión o de idioma: el contenido
  // vive en la BD, en columnas por idioma.
  useEffect(() => {
    const n = Number(numero);
    setLoading(true);
    (async () => {
      const m = await getMissionByNumero(n, lang);
      setMission(m);
      if (!m) {
        setLoading(false);
        return;
      }
      const qs = await getQuestions(m.id, lang);
      setQuestions(qs);
      const saved = await getAnswers(qs.map((q) => q.id));
      setAnswers(saved);
      setLoading(false);
    })().catch((e) => {
      setErrText(e instanceof Error ? e.message : String(e));
      setLoading(false);
    });
  }, [numero, lang]);

  function setResp(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function guardarBloque(categoria: Categoria) {
    if (!user) return;
    clearMsg();
    setSavingBlock(categoria);
    try {
      const entries = questions
        .filter((q) => q.categoria === categoria)
        .map((q) => ({ question_id: q.id, respuesta: answers[q.id] ?? '' }));
      await saveAnswers(user.id, entries);
      setMsgKey('common.saved');
    } catch (e) {
      setErrText(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingBlock(null);
    }
  }

  async function obtenerToken() {
    if (!mission || !user) return;
    clearMsg();
    setClaiming(true);
    try {
      // Guardar todo antes de reclamar, por si quedó algo sin guardar.
      await saveAnswers(
        user.id,
        questions.map((q) => ({ question_id: q.id, respuesta: answers[q.id] ?? '' }))
      );
      const ok = await completeMission(mission.id);
      if (ok) {
        setTokenWon(true);
        setMsgKey('mission.tokenWon');
      } else {
        setMsgKey('mission.missingAnswers');
      }
    } catch (e) {
      setErrText(e instanceof Error ? e.message : String(e));
    } finally {
      setClaiming(false);
    }
  }

  if (loading) return <div className="auth-loading">{t('mission.loading')}</div>;

  if (!mission)
    return (
      <main className="mission">
        <p>{t('mission.notAvailable')}</p>
        <button className="mission-back" onClick={() => navigate('/forest')}>
          {t('common.backToMapArrow')}
        </button>
      </main>
    );

  return (
    <main className="mission">
      <div className="mission-top">
        <button className="mission-back" onClick={() => navigate('/forest')}>
          {t('common.backToMapArrow')}
        </button>
        <LangToggle />
      </div>

      <h1 className="mission-title">
        {t('mission.heading', {
          numero: mission.numero,
          titulo: mission.titulo,
        })}
      </h1>
      <p className="mission-desc">{mission.descripcion}</p>

      {BLOQUES.map((categoria) => {
        const qs = questions.filter((q) => q.categoria === categoria);
        if (qs.length === 0) return null;
        return (
          <section key={categoria} className="mission-block">
            <h2>{t(`mission.blocks.${categoria}`)}</h2>
            {qs.map((q) => (
              <div key={q.id} className="mission-q">
                <label className="mission-q-text">{q.enunciado}</label>
                <textarea
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setResp(q.id, e.target.value)}
                  rows={categoria === 'actividad' ? 6 : 3}
                  placeholder={t('mission.answerPlaceholder')}
                />
              </div>
            ))}
            <button
              className="mission-save"
              onClick={() => guardarBloque(categoria)}
              disabled={savingBlock === categoria}
            >
              {savingBlock === categoria ? t('common.saving') : t('common.save')}
            </button>
          </section>
        );
      })}

      <section className="mission-final">
        <p className="mission-final-text">{mission.texto_final}</p>
        {msgKey && <p className="mission-msg">{t(msgKey)}</p>}
        {errText && <p className="auth-error">{errText}</p>}

        {tokenWon ? (
          <div className="mission-token-won">{t('mission.tokenWonBadge')}</div>
        ) : (
          <button
            className="mission-token-btn"
            onClick={obtenerToken}
            disabled={claiming}
          >
            {claiming ? t('mission.validating') : t('mission.getToken')}
          </button>
        )}

        <button className="mission-back" onClick={() => navigate('/forest')}>
          {t('common.backToMap')}
        </button>
      </section>
    </main>
  );
}
