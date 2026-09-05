import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import type { Lang } from '../i18n';
import { useLanguage } from '../i18n/useLanguage';
import { whatsappUrl } from '../lib/payment';
import {
  FREE_MISSIONS,
  getAnswers,
  getMissionAccess,
  getMissionWithQuestions,
  type Mission,
  type MissionAccess,
  type Question,
} from '../lib/missions';
import { isSupabaseConfigured } from '../lib/supabase';
import MissionGuided from './MissionGuided';

const PREVIEW_QUESTION_TEXTS: Record<Lang, readonly string[]> = {
  es: [
    '¿En qué área de tu vida te sientes más estancado/a ahora mismo?',
    '¿Cuándo fue la última vez que te sentiste verdaderamente libre? ¿Qué estabas haciendo?',
    '¿Qué estás fingiendo no saber?',
    'Si tu vida fuera un bosque, ¿cómo sería el clima hoy?',
    'Escribe una carta a tu yo estancado/a. Comienza con: “Te veo aquí de pie, y quiero que sepas…”',
    '¿Qué has estado evitando mirar y cuánto tiempo lleva ahí?',
    '¿Qué te cuesta quedarte en el borde, en energía, vitalidad o alegría?',
    '¿Cómo se sentiría en tu cuerpo un pequeño paso hacia adelante?',
  ],
  en: [
    'In which area of your life do you feel most stuck right now?',
    'When was the last time you felt truly free? What were you doing?',
    'What are you pretending not to know?',
    'If your life were a forest, what would the weather be like today?',
    'Write a letter to the part of you that feels stuck. Begin with: “I see you standing here, and I want you to know…”',
    'What have you been avoiding looking at, and how long has it been there?',
    'What does staying at the edge cost you in energy, vitality, or joy?',
    'How would one small step forward feel in your body?',
  ],
};

function createPreviewMission(missionNumber: number, lang: Lang) {
  const missionId = `preview-mission-${missionNumber}`;
  const isFirstMission = missionNumber === 1;
  const mission: Mission = {
    id: missionId,
    numero: missionNumber,
    titulo: isFirstMission
      ? lang === 'es' ? 'La entrada al bosque' : 'The entrance to the forest'
      : lang === 'es' ? `Vista de la Misión ${missionNumber}` : `Mission ${missionNumber} preview`,
    descripcion: isFirstMission
      ? lang === 'es'
        ? 'Un espacio para soltar, escuchar y elegir cómo quieres comenzar.'
        : 'A space to let go, listen, and choose how you want to begin.'
      : lang === 'es'
        ? 'Contenido de muestra para revisar el diseño guiado de esta misión.'
        : 'Sample content for reviewing this mission’s guided design.',
    texto_final: lang === 'es'
      ? 'Cada respuesta es una pequeña huella de tu recorrido.'
      : 'Each answer is a small footprint along your journey.',
  };
  const questions: Question[] = PREVIEW_QUESTION_TEXTS[lang].map((enunciado, index) => ({
    id: `preview-question-${missionNumber}-${index + 1}`,
    mission_id: missionId,
    categoria: index < 4 ? 'iniciacion' : index === 4 ? 'actividad' : 'reflexion',
    enunciado,
    orden: index + 1,
  }));

  return { mission, questions };
}

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
  const [access, setAccess] = useState<MissionAccess | null>(null);
  // Evita mostrar campos vacíos durante el instante entre cargar las preguntas
  // y recuperar las respuestas guardadas para ese conjunto.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [errText, setErrText] = useState<string | null>(null);

  // El contenido viene de columnas bilingües en la base y se vuelve a pedir
  // cuando cambia la misión o el idioma activo.
  useEffect(() => {
    const missionNumber = Number(numero);
    setLoading(true);
    setErrText(null);

    if (
      isDesignPreview &&
      Number.isInteger(missionNumber) &&
      missionNumber >= 1 &&
      missionNumber <= 9
    ) {
      const preview = createPreviewMission(missionNumber, lang);
      setMission(preview.mission);
      setQuestions(preview.questions);
      setAnswers({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    getMissionWithQuestions(missionNumber, lang)
      .then((result) => {
        if (cancelled) return;
        setMission(result?.mission ?? null);
        setQuestions(result?.questions ?? []);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setMission(null);
        setQuestions([]);
        setErrText(error instanceof Error ? error.message : String(error));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [numero, lang, isDesignPreview]);

  // La autorización es independiente del idioma. Mantiene el bloqueo
  // secuencial y el acceso de pago antes de renderizar cualquier actividad.
  useEffect(() => {
    const missionNumber = Number(numero);
    if (isDesignPreview || !Number.isInteger(missionNumber) || missionNumber < 1) {
      setAccess('open');
      return;
    }

    let cancelled = false;
    setAccess(null);
    getMissionAccess(missionNumber)
      .then((nextAccess) => {
        if (!cancelled) setAccess(nextAccess);
      })
      .catch(() => {
        if (!cancelled) setAccess('locked');
      });

    return () => {
      cancelled = true;
    };
  }, [numero, isDesignPreview]);

  // Las respuestas pertenecen a los IDs de pregunta y no al idioma. Por eso
  // cambiar ES/EN no vuelve a leer ni pisa lo que la persona está escribiendo.
  const questionsKey = questions.map((question) => question.id).join(',');
  const missionId = mission?.id ?? '';
  useEffect(() => {
    if (isDesignPreview || !questionsKey || !missionId) {
      setLoadedKey(questionsKey);
      return;
    }

    let cancelled = false;
    getAnswers(questionsKey.split(','))
      .then((savedAnswers) => {
        if (cancelled) return;
        setAnswers(savedAnswers);
        setLoadedKey(questionsKey);
      })
      .catch(() => {
        // La actividad sigue disponible aunque no se puedan recuperar respuestas.
        if (!cancelled) setLoadedKey(questionsKey);
      });

    return () => {
      cancelled = true;
    };
  }, [questionsKey, missionId, isDesignPreview]);

  if (loading || access === null || loadedKey !== questionsKey) {
    return <div className="auth-loading">{t('mission.loading')}</div>;
  }

  if (access === 'paywall') {
    return (
      <main className="mission mission-locked">
        <h1 className="mission-title">{t('mission.paywallTitle')}</h1>
        <p className="mission-desc">
          {t('mission.paywallBody', { numero: FREE_MISSIONS })}
        </p>
        <a
          className="mission-token-btn mission-paywall-cta"
          href={whatsappUrl(t('forest.paywallMessage'))}
          target="_blank"
          rel="noreferrer noopener"
        >
          {t('forest.paywallCta')}
        </a>
        <button className="mission-back" onClick={() => navigate(mapPath)}>
          {t('common.backToMapArrow')}
        </button>
      </main>
    );
  }

  if (access === 'locked') {
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
  }

  if (!mission || questions.length === 0) {
    return (
      <main className="mission">
        <p>{t('mission.notAvailable')}</p>
        {errText && <p className="auth-error">{errText}</p>}
        <button className="mission-back" onClick={() => navigate(mapPath)}>
          {t('common.backToMapArrow')}
        </button>
      </main>
    );
  }

  return (
    <MissionGuided
      key={mission.id}
      mission={mission}
      questions={questions}
      initialAnswers={answers}
      userId={user?.id ?? null}
      isPreview={isDesignPreview}
      mapPath={mapPath}
      lang={lang}
    />
  );
}
