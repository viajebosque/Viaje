import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import forestMap from '../assets/forest/forest-map.png';
import MissionTokenReward from '../components/MissionTokenReward';
import { completeMission, saveAnswers, type Mission, type Question } from '../lib/missions';
import { getMissionPanelImage } from '../lib/missionPanels';
import { getMissionTokenImage } from '../lib/missionTokens';

type GuidedAnswers = Record<string, string>;

type Backup = {
  answers: GuidedAnswers;
  pending: boolean;
  step: number;
  flowVersion?: number;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const GUIDED_FLOW_VERSION = 2;

const MISSION_ACTIVITY_VIDEOS: Partial<Record<number, string>> = {
  1: 'b0-4whrjbLg',
};

type Props = {
  mission: Mission;
  questions: Question[];
  initialAnswers: Record<string, string>;
  userId: string | null;
  isPreview: boolean;
  mapPath: string;
};

function parseStructured(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function normalizeLegacyAnswer(value: string): string {
  const structured = parseStructured(value);
  if (!structured) return value;
  if (typeof structured.text === 'string' && structured.text.trim()) {
    return structured.text;
  }
  if (structured.preferPaper === true) return 'Prefiero escribirla en papel';
  if (typeof structured.reflection === 'string' && structured.reflection.trim()) {
    return structured.reflection;
  }
  if (typeof structured.option === 'string') return structured.option;
  return '';
}

function answersFromBackend(
  questions: Question[],
  answers: Record<string, string>
): GuidedAnswers {
  return Object.fromEntries(
    questions.map((question) => [
      question.id,
      normalizeLegacyAnswer(answers[question.id] ?? ''),
    ])
  );
}

function readBackup(storageKey: string): Backup | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<Backup>;
    if (!candidate.answers || typeof candidate.pending !== 'boolean') return null;
    return {
      answers: candidate.answers,
      pending: candidate.pending,
      step: Math.max(Number(candidate.step) || 0, 0),
      flowVersion: Number(candidate.flowVersion) || undefined,
    };
  } catch {
    return null;
  }
}

function writeBackup(storageKey: string, backup: Backup) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(backup));
  } catch {
    // El formulario sigue funcionando aunque el navegador bloquee storage.
  }
}

function serializedEntries(questions: Question[], answers: GuidedAnswers) {
  return questions.map((question) => ({
    question_id: question.id,
    respuesta: answers[question.id]?.trim() ?? '',
  }));
}

export default function MissionGuided({
  mission,
  questions,
  initialAnswers,
  userId,
  isPreview,
  mapPath,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Conserva los borradores existentes de la primera misión y separa los de
  // las demás para que una respuesta nunca aparezca en otro recorrido.
  const storageKey = mission.numero === 1
    ? `mission-one-guided:${userId ?? 'preview'}`
    : `mission-guided:${mission.id}:${userId ?? 'preview'}`;
  const activityVideoId = MISSION_ACTIVITY_VIDEOS[mission.numero];
  const activityQuestionIndex = activityVideoId
    ? questions.findIndex((question) => question.categoria === 'actividad')
    : -1;
  const hasActivityVideo = Boolean(activityVideoId && activityQuestionIndex >= 0);
  const totalSteps = questions.length + (hasActivityVideo ? 1 : 0);
  const questionForStep = useCallback(
    (stepToMap: number) => {
      if (!hasActivityVideo || stepToMap < activityQuestionIndex) {
        return questions[stepToMap];
      }
      if (stepToMap === activityQuestionIndex) return undefined;
      return questions[stepToMap - 1];
    },
    [activityQuestionIndex, hasActivityVideo, questions]
  );
  const initialState = useMemo(() => {
    const backendAnswers = answersFromBackend(questions, initialAnswers);
    const backup = readBackup(storageKey);
    const backupAnswers = backup
      ? Object.fromEntries(
          questions.map((question) => [
            question.id,
            backup.answers[question.id] ?? backendAnswers[question.id] ?? '',
          ])
        )
      : backendAnswers;
    const backupStep =
      backup &&
      backup.flowVersion !== GUIDED_FLOW_VERSION &&
      hasActivityVideo &&
      backup.step >= activityQuestionIndex
        ? backup.step + 1
        : backup?.step ?? 0;
    return {
      answers: backup && (backup.pending || isPreview) ? backupAnswers : backendAnswers,
      step: Math.min(backupStep, Math.max(totalSteps - 1, 0)),
      hasPendingBackup: Boolean(backup?.pending),
    };
  }, [activityQuestionIndex, hasActivityVideo, initialAnswers, isPreview, questions, storageKey, totalSteps]);

  const [answers, setAnswers] = useState(initialState.answers);
  const [step, setStep] = useState(initialState.step);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    initialState.hasPendingBackup ? 'saving' : 'idle'
  );
  const [saveError, setSaveError] = useState('');
  const [validation, setValidation] = useState('');
  // Haber obtenido el token antes no omite la misión: cada entrada inicia una
  // nueva ejecución y muestra la recompensa solo al terminarla otra vez.
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [exiting, setExiting] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const answersRef = useRef(answers);
  const stepRef = useRef(step);
  const dirtyVersionRef = useRef(initialState.hasPendingBackup ? 1 : 0);
  const savedVersionRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);

  const isStepValid = useCallback(
    (stepToCheck: number, value = answersRef.current) => {
      const question = questionForStep(stepToCheck);
      return !question || Boolean(value[question.id]?.trim());
    },
    [questionForStep]
  );

  const performSave = useCallback(async (): Promise<boolean> => {
    if (saveInFlightRef.current) return saveInFlightRef.current;

    const operation = (async () => {
      while (savedVersionRef.current < dirtyVersionRef.current) {
        const targetVersion = dirtyVersionRef.current;
        const snapshot = answersRef.current;
        setSaveStatus('saving');
        setSaveError('');

        try {
          if (isPreview || !userId) {
            writeBackup(storageKey, {
              answers: snapshot,
              pending: false,
              step: stepRef.current,
              flowVersion: GUIDED_FLOW_VERSION,
            });
          } else {
            if (questions.length === 0) {
              throw new Error('mission-content-incomplete');
            }
            await saveAnswers(userId, serializedEntries(questions, snapshot));
          }
          savedVersionRef.current = targetVersion;

          if (dirtyVersionRef.current === targetVersion) {
            writeBackup(storageKey, {
              answers: isPreview ? snapshot : {},
              pending: false,
              step: stepRef.current,
              flowVersion: GUIDED_FLOW_VERSION,
            });
            setSaveStatus('saved');
          }
        } catch {
          writeBackup(storageKey, {
            answers: snapshot,
            pending: true,
            step: stepRef.current,
            flowVersion: GUIDED_FLOW_VERSION,
          });
          setSaveStatus('error');
          setSaveError(t('mission.guided.saveError'));
          return false;
        }
      }
      return true;
    })();

    saveInFlightRef.current = operation;
    const result = await operation;
    if (saveInFlightRef.current === operation) saveInFlightRef.current = null;
    return result;
  }, [isPreview, questions, storageKey, t, userId]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void performSave();
    }, 850);
  }, [performSave]);

  const flushSave = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    return performSave();
  }, [performSave]);

  useEffect(() => {
    if (initialState.hasPendingBackup) scheduleSave();
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [initialState.hasPendingBackup, scheduleSave]);

  useEffect(() => {
    if (!completed) headingRef.current?.focus();
  }, [completed, step]);

  function updateAnswer(questionId: string, value: string) {
    setAnswers((current) => {
      const next = { ...current, [questionId]: value };
      answersRef.current = next;
      dirtyVersionRef.current += 1;
      writeBackup(storageKey, {
        answers: next,
        pending: true,
        step: stepRef.current,
        flowVersion: GUIDED_FLOW_VERSION,
      });
      return next;
    });
    setSaveStatus('saving');
    setSaveError('');
    setValidation('');
    scheduleSave();
  }

  function goToStep(nextStep: number) {
    const bounded = Math.min(Math.max(nextStep, 0), Math.max(totalSteps - 1, 0));
    const hasPendingChanges = dirtyVersionRef.current > savedVersionRef.current;
    stepRef.current = bounded;
    setStep(bounded);
    setValidation('');
    writeBackup(storageKey, {
      answers: hasPendingChanges || isPreview ? answersRef.current : {},
      pending: hasPendingChanges,
      step: bounded,
      flowVersion: GUIDED_FLOW_VERSION,
    });
  }

  function continueToNextStep() {
    if (!isStepValid(step)) {
      setValidation(t('mission.guided.validation.required'));
      return;
    }
    goToStep(step + 1);
  }

  async function saveAndExit() {
    setExiting(true);
    const saved = await flushSave();
    setExiting(false);
    if (saved) navigate(mapPath);
  }

  async function finishMission() {
    if (!isStepValid(step)) {
      setValidation(t('mission.guided.validation.required'));
      return;
    }
    setCompleting(true);
    const saved = await flushSave();
    if (!saved) {
      setCompleting(false);
      return;
    }

    try {
      if (!isPreview) {
        const awarded = await completeMission(mission.id);
        if (!awarded) {
          setValidation(t('mission.guided.validation.incomplete'));
          setCompleting(false);
          return;
        }
      }
      window.localStorage.removeItem(storageKey);
      setCompleted(true);
    } catch {
      setSaveStatus('error');
      setSaveError(t('mission.guided.completeError'));
    } finally {
      setCompleting(false);
    }
  }

  const saveLabel =
    saveStatus === 'saving'
      ? t('mission.guided.saving')
      : saveStatus === 'saved'
        ? t('mission.guided.saved')
        : saveStatus === 'error'
          ? t('mission.guided.saveFailed')
          : t('mission.guided.ready');
  const currentQuestion = questionForStep(step);
  const isActivityVideoStep = hasActivityVideo && step === activityQuestionIndex;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] ?? '' : '';
  const questionText = currentQuestion?.enunciado.trim() ?? '';
  const questionLineCount = questionText ? questionText.split(/\r?\n/).length : 0;
  const questionTitleClass =
    questionText.length > 170 || questionLineCount > 3
      ? 'guided-question-title--very-long'
      : questionText.length > 90 || questionLineCount > 1
        ? 'guided-question-title--long'
        : undefined;
  const tokenImage = getMissionTokenImage(mission.numero);
  const missionPanel = getMissionPanelImage(mission.numero) ?? forestMap;
  const isFirstMission = mission.numero === 1;
  const sidebarDescription = isFirstMission
    ? t('mission.guided.sidebarDescriptionFirst')
    : t('mission.guided.sidebarDescriptionGeneric');

  if (completed) {
    return (
      <main
        className="guided-mission guided-mission--complete"
        style={{ '--guided-forest': `url(${forestMap})` } as React.CSSProperties}
      >
        <section className="guided-celebration" aria-labelledby="guided-complete-title">
          <span className="guided-celebration-kicker">{t('mission.guided.completeKicker')}</span>
          {tokenImage && (
            <MissionTokenReward
              src={tokenImage}
              alt={t('mission.tokenImageAlt', { numero: mission.numero })}
              large
            />
          )}
          <h1 id="guided-complete-title">
            {isFirstMission
              ? t('mission.guided.completeTitle')
              : t('mission.guided.completeTitleGeneric', { numero: mission.numero })}
          </h1>
          <p className="guided-reward">
            {isFirstMission
              ? t('mission.guided.reward')
              : t('mission.guided.rewardGeneric')}
          </p>
          <p className="guided-reward-meaning">
            {isFirstMission ? t('mission.guided.rewardMeaning') : mission.texto_final}
          </p>
          <button className="guided-primary" type="button" onClick={() => navigate(mapPath)}>
            {t('mission.guided.backToMap')}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      className="guided-mission"
      style={{ '--guided-forest': `url(${forestMap})` } as React.CSSProperties}
    >
      <div className="guided-shell">
        <header className="guided-topbar">
          <button className="guided-map-link" type="button" onClick={saveAndExit}>
            <span className="guided-back-icon" aria-hidden="true">←</span>
            {t('mission.guided.map')}
          </button>
          <p className="guided-brand">
            {t('forest.modalTitle', { numero: mission.numero })}{' '}
            <span aria-hidden="true">·</span> {mission.titulo}
          </p>
          <button
            className="guided-top-exit"
            type="button"
            onClick={saveAndExit}
            disabled={exiting}
          >
            {exiting ? t('mission.guided.saving') : t('mission.guided.saveExit')}
          </button>
        </header>

        <div className="guided-content">
          <aside
            className="guided-illustration"
            style={{ '--guided-panel': `url(${missionPanel})` } as React.CSSProperties}
            aria-label={
              isFirstMission
                ? t('mission.guided.illustrationAlt')
                : t('mission.guided.illustrationAltGeneric', { numero: mission.numero })
            }
          >
            <div className="guided-illustration-copy">
              <span>
                {isFirstMission
                  ? t('mission.guided.threshold')
                  : t('mission.guided.thresholdGeneric')}
              </span>
              <h2>{mission.titulo}</h2>
              <p>{sidebarDescription}</p>
              <ul className="guided-features" aria-label={t('mission.guided.detailsLabel')}>
                <li>
                  <span aria-hidden="true" className="guided-feature-icon">
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="8" />
                      <path d="M12 7v5h5" />
                    </svg>
                  </span>
                  {t('mission.guided.duration')}
                </li>
                <li>
                  <span aria-hidden="true" className="guided-feature-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="m6.5 12.5 3.5 3.5 7.5-8" />
                    </svg>
                  </span>
                  {t('mission.guided.autoSave')}
                </li>
                <li>
                  <span aria-hidden="true" className="guided-feature-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="m13.5 3-7 10h5l-1 8 7-11h-5z" />
                    </svg>
                  </span>
                  {t('mission.guided.private')}
                </li>
              </ul>
            </div>
          </aside>

          <section className="guided-panel" aria-labelledby="guided-question-title">
            <div className="guided-progress-area">
              <div className="guided-progress-meta">
                <div className="guided-progress-copy" aria-live="polite">
                  {t('mission.guided.step', { current: step + 1, total: totalSteps })}
                </div>
                <div className={`guided-save-status guided-save-status--${saveStatus}`} aria-live="polite">
                  <span aria-hidden="true" />
                  {saveLabel}
                  {saveStatus === 'error' && (
                    <button type="button" onClick={() => void flushSave()}>
                      {t('mission.guided.retry')}
                    </button>
                  )}
                </div>
              </div>
              <div
                className="guided-progress"
                role="progressbar"
                aria-label={t('mission.guided.progressLabel')}
                aria-valuemin={1}
                aria-valuemax={totalSteps}
                aria-valuenow={step + 1}
              >
                <span style={{ width: `${totalSteps ? ((step + 1) / totalSteps) * 100 : 0}%` }} />
              </div>
            </div>

            <article
              className="guided-question-card"
              data-question-category={isActivityVideoStep ? 'actividad-video' : currentQuestion?.categoria}
              data-question-order={currentQuestion?.orden}
            >
              <div
                className={`guided-question-wrap${isActivityVideoStep ? ' guided-question-wrap--video-only' : ''}`}
              >
                {isActivityVideoStep && activityVideoId ? (
                  <>
                    <h1 ref={headingRef} id="guided-question-title" className="sr-only" tabIndex={-1}>
                      {t('mission.guided.activityVideoTitle', { numero: mission.numero })}
                    </h1>
                  <div className="guided-activity-video">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${activityVideoId}`}
                      title={t('mission.guided.activityVideoTitle', { numero: mission.numero })}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                  </>
                ) : (
                  <div className="guided-question-body">
                  <p className="guided-eyebrow">
                    {t('mission.guided.questionLabel', { current: currentQuestion?.orden ?? step + 1 })}
                  </p>
                  <h1
                    ref={headingRef}
                    id="guided-question-title"
                    className={questionTitleClass}
                    tabIndex={-1}
                  >
                    {currentQuestion?.enunciado ?? ''}
                  </h1>
                  <p className="guided-help">{t('mission.guided.backendHelp')}</p>

                  {currentQuestion && (
                    <label className="guided-field">
                      <span className="sr-only">{currentQuestion.enunciado}</span>
                      <textarea
                        value={currentAnswer}
                        onChange={(event) => updateAnswer(currentQuestion.id, event.target.value)}
                        rows={8}
                        placeholder={t('mission.guided.backendPlaceholder')}
                        aria-describedby="guided-validation"
                      />
                    </label>
                  )}

                  <div id="guided-validation" className="guided-validation" aria-live="assertive">
                    {validation}
                  </div>
                  </div>
                )}
              </div>

              <footer className="guided-footer">
            {saveError && <p className="guided-save-error" aria-live="polite">{saveError}</p>}

            <div className="guided-actions">
              <button
                className="guided-secondary"
                type="button"
                onClick={() => goToStep(step - 1)}
                disabled={step === 0}
              >
                {t('mission.guided.previous')}
              </button>
              <button
                className="guided-primary"
                type="button"
                onClick={step === totalSteps - 1 ? finishMission : continueToNextStep}
                disabled={completing}
              >
                {step === totalSteps - 1
                  ? completing
                    ? t('mission.guided.completing')
                    : t('mission.guided.finish')
                  : t('mission.guided.continue')}
              </button>
            </div>
              </footer>
            </article>
          </section>
        </div>
      </div>
    </main>
  );
}
