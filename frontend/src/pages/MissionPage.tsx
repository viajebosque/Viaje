import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/useLanguage';
import { isSupabaseConfigured } from '../lib/supabase';
import MissionTokenReward from '../components/MissionTokenReward';
import MissionOneGuided from './MissionOneGuided';
import { getMissionTokenImage } from '../lib/missionTokens';
import {
  getMissionWithQuestions,
  getAnswers,
  saveAnswers,
  completeMission,
  hasMissionToken,
  isMissionUnlocked,
  type Mission,
  type Question,
  type Categoria,
} from '../lib/missions';

// Orden en que se muestran los bloques. El nombre visible sale de i18n
// (mission.blocks.<categoria>).
const BLOQUES: Categoria[] = ['iniciacion', 'actividad', 'reflexion'];

const PREVIEW_MISSION: Mission = {
  id: 'preview-mission-1',
  numero: 1,
  titulo: 'La entrada al bosque',
  descripcion: 'Un espacio para soltar, escuchar y elegir cómo quieres comenzar.',
  texto_final: 'Cada respuesta es una pequeña huella de tu recorrido.',
};

const PREVIEW_QUESTION_TEXTS = [
  '¿En qué área de tu vida te sientes más estancado/a ahora mismo?',
  '¿Cuándo fue la última vez que te sentiste verdaderamente libre? ¿Qué estabas haciendo?',
  '¿Qué estás fingiendo no saber?',
  'Si tu vida fuera un bosque, ¿cómo sería el clima hoy?',
  'Escribe una carta a tu yo estancado/a. Comienza con: “Te veo aquí de pie, y quiero que sepas…”',
  '¿Qué has estado evitando mirar y cuánto tiempo lleva ahí?',
  '¿Qué te cuesta quedarte en el borde, en energía, vitalidad o alegría?',
  '¿Cómo se sentiría en tu cuerpo un pequeño paso hacia adelante?',
] as const;

const PREVIEW_QUESTIONS: Question[] = PREVIEW_QUESTION_TEXTS.map(
  (enunciado, index) => ({
    id: `preview-question-${index + 1}`,
    mission_id: PREVIEW_MISSION.id,
    categoria: index < 4 ? 'iniciacion' : index === 4 ? 'actividad' : 'reflexion',
    enunciado,
    orden: index + 1,
  })
);

export default function MissionPage() {
  const { numero } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { lang } = useLanguage();
  const isDesignPreview =
    import.meta.env.DEV &&
    !isSupabaseConfigured &&
    new URLSearchParams(window.location.search).get('preview') === '1';
  const mapPath = `/forest${isDesignPreview ? '?preview=1' : ''}`;

  const [mission, setMission] = useState<Mission | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  // null = todavía no se sabe. Cierra el acceso por URL directa: entrar a
  // /mission/4 sin el token de la 3 muestra la pantalla de bloqueada.
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  // Para qué conjunto de preguntas ya se cargaron respuestas y token. Comparar
  // contra qsKey evita mostrar los campos vacíos un instante antes de llenarlos.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
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
    if (isDesignPreview && n === 1) {
      setMission(PREVIEW_MISSION);
      setQuestions(PREVIEW_QUESTIONS);
      setAnswers({});
      setTokenWon(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    getMissionWithQuestions(n, lang)
      .then((res) => {
        if (cancelled) return;
        setMission(res?.mission ?? null);
        setQuestions(res?.questions ?? []);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setErrText(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [numero, lang, isDesignPreview]);

  // Bloqueo secuencial. Va en su propio efecto y SIN lang en las dependencias:
  // es un dato del usuario, no contenido traducible, así que mover el switch no
  // tiene que volver a preguntarlo.
  useEffect(() => {
    const n = Number(numero);
    // Un :numero que no es una misión no está "bloqueado", no existe: se deja
    // pasar para que caiga en la pantalla de "misión no disponible".
    if (isDesignPreview || !Number.isInteger(n) || n < 1) {
      setUnlocked(true);
      return;
    }
    let cancelled = false;
    setUnlocked(null);
    isMissionUnlocked(n)
      .then((ok) => {
        if (!cancelled) setUnlocked(ok);
      })
      .catch(() => {
        // Si no se pudo preguntar, no se inventa permiso: queda bloqueada. La
        // base igual esconde las preguntas, así que abrirla no serviría.
        if (!cancelled) setUnlocked(false);
      });
    return () => {
      cancelled = true;
    };
  }, [numero, isDesignPreview]);

  // Respuestas y token NO dependen del idioma: se leen cuando cambia el CONJUNTO
  // de preguntas, no cuando se mueve el switch. Antes colgaban del efecto de
  // arriba, con lang en las dependencias, así que cambiar de idioma releía las
  // respuestas de la base y pisaba lo que la persona había escrito sin guardar.
  const qsKey = questions.map((q) => q.id).join(',');
  const missionId = mission?.id ?? '';
  useEffect(() => {
    if (isDesignPreview || !qsKey || !missionId) {
      setLoadedKey(qsKey);
      return;
    }
    let cancelled = false;
    Promise.all([getAnswers(qsKey.split(',')), hasMissionToken(missionId)])
      .then(([saved, completedAlready]) => {
        if (cancelled) return;
        setAnswers(saved);
        setTokenWon(completedAlready);
        setLoadedKey(qsKey);
      })
      .catch(() => {
        // Que no se puedan leer las respuestas no debe dejar la pantalla
        // trabada: se muestran las preguntas vacías.
        if (!cancelled) setLoadedKey(qsKey);
      });
    return () => {
      cancelled = true;
    };
  }, [qsKey, missionId, isDesignPreview]);

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

  if (loading || unlocked === null || loadedKey !== qsKey)
    return <div className="auth-loading">{t('mission.loading')}</div>;

  // Bloqueada: se corta acá, antes de mirar el contenido. Es lo que ve quien
  // escribe la URL a mano.
  if (!unlocked)
    return (
      <main className="mission mission-locked">
        <h1 className="mission-title">{t('mission.lockedTitle')}</h1>
        <p className="mission-desc">
          {t('mission.lockedBody', { numero: Number(numero) - 1 })}
        </p>
        <button className="mission-back" onClick={() => navigate(mapPath)}>
          {t('common.backToMapArrow')}
        </button>
      </main>
    );

  if (!mission)
    return (
      <main className="mission">
        <p>{t('mission.notAvailable')}</p>
        <button className="mission-back" onClick={() => navigate(mapPath)}>
          {t('common.backToMapArrow')}
        </button>
      </main>
    );

  if (mission.numero === 1) {
    return (
      <MissionOneGuided
        mission={mission}
        questions={questions}
        initialAnswers={answers}
        userId={user?.id ?? null}
        isPreview={isDesignPreview}
        mapPath={mapPath}
      />
    );
  }

  const tokenImage = getMissionTokenImage(mission.numero);

  return (
    <main className="mission">
      <div className="mission-top">
        <button className="mission-back" onClick={() => navigate(mapPath)}>
          {t('common.backToMapArrow')}
        </button>
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
          <div className="mission-token-won">
            {tokenImage && (
              <MissionTokenReward
                src={tokenImage}
                alt={t('mission.tokenImageAlt', { numero: mission.numero })}
              />
            )}
            <span>{t('mission.tokenWonBadge')}</span>
          </div>
        ) : (
          <button
            className="mission-token-btn"
            onClick={obtenerToken}
            disabled={claiming}
          >
            {claiming ? t('mission.validating') : t('mission.getToken')}
          </button>
        )}

        <button className="mission-back" onClick={() => navigate(mapPath)}>
          {t('common.backToMap')}
        </button>
      </section>
    </main>
  );
}
