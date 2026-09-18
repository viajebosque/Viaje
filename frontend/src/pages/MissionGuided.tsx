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
import type { Lang } from '../i18n';
import { completeMission, saveAnswers, type Mission, type Question } from '../lib/missions';
import { getMissionPanelImage } from '../lib/missionPanels';
import { getMissionTokenImage } from '../lib/missionTokens';
import { getMissionActivityVideoId } from '../lib/missionVideos';
import { editPaperAnswer, isPaperAnswer, paperAnswerText, setPaperAnswer } from '../lib/paperAnswer';
import {
  buildGuidedSteps, initialQuestions, initialChoiceIsValid, initialOptionText,
  selectedInitialQuestionId, chooseInitialQuestion, guidedEntries,
} from '../lib/initialChoice';

type GuidedAnswers = Record<string, string>;

type Backup = {
  answers: GuidedAnswers;
  pending: boolean;
  step: number;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type Props = {
  mission: Mission;
  questions: Question[];
  initialAnswers: Record<string, string>;
  userId: string | null;
  isPreview: boolean;
  mapPath: string;
  lang: Lang;
};

function answersFromBackend(
  questions: Question[],
  answers: Record<string, string>
): GuidedAnswers {
  return Object.fromEntries(
    questions.map((question) => [
      question.id,
      answers[question.id] ?? '',
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
    };
  } catch {
    return null;
  }
}

// El lateral se vuelve un desplegable en móvil: el punto de corte tiene que
// ser el mismo que el de index.css.
const SIDEBAR_COLLAPSE_QUERY = '(max-width: 700px)';

function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

function writeBackup(storageKey: string, backup: Backup) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(backup));
  } catch {
    // El formulario sigue funcionando aunque el navegador bloquee storage.
  }
}

export default function MissionGuided({
  mission,
  questions,
  initialAnswers,
  userId,
  isPreview,
  mapPath,
  lang,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // El prefijo v2 separa los borradores del formato anterior: aquellos
  // guardaban las 4 preguntas iniciales y ya no se pueden interpretar.
  const storageKey = `mission-guided:v2:${mission.id}:${userId ?? 'preview'}`;
  const activityVideoId = getMissionActivityVideoId(mission.numero, lang);
  const activityQuestionIndex = activityVideoId
    ? questions.findIndex((question) => question.categoria === 'actividad')
    : -1;
  const hasActivityVideo = Boolean(activityVideoId && activityQuestionIndex >= 0);
  const initialOptions = useMemo(() => initialQuestions(questions), [questions]);
  const steps = useMemo(() => buildGuidedSteps(questions, hasActivityVideo), [questions, hasActivityVideo]);
  const totalSteps = steps.length;
  const questionForStep = useCallback(
    (stepToMap: number) => {
      const mapped = steps[stepToMap];
      return mapped?.kind === 'question' ? mapped.question : undefined;
    },
    [steps]
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
    const backupStep = Math.max(0, backup?.step ?? 0);
    return {
      answers: backup && (backup.pending || isPreview) ? backupAnswers : backendAnswers,
      step: Math.min(backupStep, Math.max(totalSteps - 1, 0)),
      hasPendingBackup: Boolean(backup?.pending),
    };
  }, [
    activityQuestionIndex,
    hasActivityVideo,
    initialAnswers,
    isPreview,
    mission.numero,
    questions,
    storageKey,
    totalSteps,
  ]);

  const [answers, setAnswers] = useState(initialState.answers);
  // Qué opción está marcada. Al cargar sale de las respuestas; mientras la
  // persona no escriba nada no hay nada que guardar, así que vive solo acá.
  const [selectedInitial, setSelectedInitial] = useState<string | null>(
    () => selectedInitialQuestionId(questions, initialState.answers)
  );
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
  const collapsibleSidebar = useMatchMedia(SIDEBAR_COLLAPSE_QUERY);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const answersRef = useRef(answers);
  const stepRef = useRef(step);
  const dirtyVersionRef = useRef(initialState.hasPendingBackup ? 1 : 0);
  const savedVersionRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);

  const isStepValid = useCallback(
    (stepToCheck: number, value = answersRef.current) => {
      if (steps[stepToCheck]?.kind === 'initial') {
        return initialChoiceIsValid(questions, value);
      }
      const question = questionForStep(stepToCheck);
      if (question?.categoria === 'actividad') {
        const answer = value[question.id] ?? '';
        return isPaperAnswer(answer) || Boolean(answer.trim());
      }
      return !question || Boolean((value[question.id] ?? '').trim());
    },
    [questionForStep, steps, questions]
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
            });
          } else {
            if (questions.length === 0) {
              throw new Error('mission-content-incomplete');
            }
            await saveAnswers(userId, guidedEntries(questions, snapshot));
          }
          savedVersionRef.current = targetVersion;

          if (dirtyVersionRef.current === targetVersion) {
            writeBackup(storageKey, {
              answers: isPreview ? snapshot : {},
              pending: false,
              step: stepRef.current,
            });
            setSaveStatus('saved');
          }
        } catch {
          writeBackup(storageKey, {
            answers: snapshot,
            pending: true,
            step: stepRef.current,
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
    const next = { ...answersRef.current, [questionId]: value };
    answersRef.current = next;
    setAnswers(next);
    dirtyVersionRef.current += 1;
    writeBackup(storageKey, {
      answers: next,
      pending: true,
      step: stepRef.current,
    });
    setSaveStatus('saving');
    setSaveError('');
    setValidation('');
    scheduleSave();
  }

  // Cambiar de pregunta descarta la respuesta anterior: en el formulario y en
  // la base. Entre las iniciales siempre queda una sola respuesta.
  function selectInitialQuestion(questionId: string) {
    if (selectedInitial === questionId) return;
    setSelectedInitial(questionId);
    const next = chooseInitialQuestion(questions, answersRef.current, questionId);
    answersRef.current = next;
    setAnswers(next);
    dirtyVersionRef.current += 1;
    writeBackup(storageKey, { answers: next, pending: true, step: stepRef.current });
    setSaveStatus('saving');
    setSaveError('');
    setValidation('');
    scheduleSave();
  }

  function updateInitialText(text: string) {
    if (!selectedInitial) return;
    updateAnswer(selectedInitial, text);
  }

  function updateActivityAnswer(questionId: string, text: string) {
    updateAnswer(questionId, editPaperAnswer(answersRef.current[questionId] ?? '', text));
  }

  function updateActivityPaper(questionId: string, checked: boolean) {
    const previous = answersRef.current[questionId] ?? '';
    const text = paperAnswerText(previous);
    updateAnswer(questionId, setPaperAnswer(text, checked));
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
    });
  }

  function continueToNextStep() {
    if (!isStepValid(step)) {
      setValidation(t(steps[step]?.kind === 'initial'
        ? 'mission.guided.initialValidation' : 'mission.guided.validation.required'));
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
    if (initialOptions.length && !isStepValid(0)) {
      goToStep(0);
      setValidation(t('mission.guided.initialValidation'));
      return;
    }
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
    } catch (error) {
      // flushSave ya terminó bien; el fallo pertenece solo a la entrega del token.
      setSaveStatus('saved');
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
  const currentQuestionNumber = steps.slice(0, step + 1).filter((item) => item.kind !== 'video').length;
  const previewContentUnavailable = isPreview && mission.numero !== 1;
  const isActivityVideoStep = steps[step]?.kind === 'video';
  const isInitialStep = steps[step]?.kind === 'initial';
  const initialAnswerText = selectedInitial ? answers[selectedInitial] ?? '' : '';
  const hasPhraseHeading = /Frase Inicial de Pensamiento Profundo|Initial Deep Thought Phrase/i.test(
    [mission.descripcion, ...initialOptions.map((q) => q.enunciado)].join('\n')
  );
  const initialTitle = t(hasPhraseHeading ? 'mission.guided.initialPhraseTitle' : 'mission.guided.initialTitle');
  const currentAnswer = currentQuestion
    ? currentQuestion.categoria === 'actividad'
      ? paperAnswerText(answers[currentQuestion.id] ?? '')
      : answers[currentQuestion.id] ?? ''
    : '';
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
  // Textos definitivos del cliente para el lateral, independientes del cierre.
  const sidebarImportance = t(`mission.guided.sidebarImportance.${mission.numero}`);

  // Mismo contenido en las dos variantes del lateral (desktop y desplegable).
  const illustrationCopy = (
    <>
      <span>
        {isFirstMission
          ? t('mission.guided.threshold')
          : t('mission.guided.thresholdGeneric')}
      </span>
      <h2>{mission.titulo}</h2>
      {sidebarImportance && (
        <p className="guided-sidebar-importance">{sidebarImportance}</p>
      )}
      <ul className="guided-features" aria-label={t('mission.guided.detailsLabel')}>
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
    </>
  );

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
          {collapsibleSidebar ? (
            /* En móvil ocupaba la primera pantalla entera y recortaba la
               ilustración. Va plegado: se abre solo si la persona quiere. */
            <details className="guided-illustration guided-illustration--collapsible">
              <summary className="guided-illustration-summary">
                <span>{t('mission.guided.aboutMission')}</span>
                <span className="guided-illustration-chevron" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>
                </span>
              </summary>
              <div className="guided-illustration-copy">{illustrationCopy}</div>
            </details>
          ) : (
            <aside
              className="guided-illustration"
              tabIndex={0}
              style={{ '--guided-panel': `url(${missionPanel})` } as React.CSSProperties}
              aria-label={
                isFirstMission
                  ? t('mission.guided.illustrationAlt')
                  : t('mission.guided.illustrationAltGeneric', { numero: mission.numero })
              }
            >
              <div className="guided-illustration-copy">{illustrationCopy}</div>
            </aside>
          )}

          <section className="guided-panel" aria-labelledby="guided-question-title">
            {!previewContentUnavailable && <div className="guided-progress-area">
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
            </div>}

            <article
              className="guided-question-card"
              data-question-category={isInitialStep ? 'iniciacion' : isActivityVideoStep ? 'actividad-video' : currentQuestion?.categoria}
              data-question-order={currentQuestion?.orden}
            >
              <div
                className={`guided-question-wrap${isActivityVideoStep ? ' guided-question-wrap--video-only' : ''}`}
              >
                {previewContentUnavailable ? (
                  <div className="guided-question-body">
                    <h1 ref={headingRef} id="guided-question-title" tabIndex={-1}>
                      {t('mission.guided.previewContentTitle')}
                    </h1>
                    <p className="guided-help">{t('mission.guided.previewContentUnavailable')}</p>
                  </div>
                ) : isInitialStep ? (
                  <div className="guided-question-body guided-initial-choice">
                    <div className="guided-initial-reading">
                    <h1 ref={headingRef} id="guided-question-title" tabIndex={-1}>
                      {initialTitle}
                    </h1>
                    <p id="guided-initial-instructions" className="guided-help">
                      {t('mission.guided.initialInstructions')}
                    </p>
                    <fieldset className="guided-initial-options" aria-describedby="guided-initial-instructions guided-validation">
                      <legend className="sr-only">{t('mission.guided.initialSelectionLabel')}</legend>
                      {initialOptions.map((option, index) => (
                        <label key={option.id} className={`guided-initial-option${
                          selectedInitial === option.id ? ' guided-initial-option--selected' : ''
                        }`}>
                          <input
                            type="radio"
                            name={`initial-choice-${mission.id}`}
                            value={option.id}
                            checked={selectedInitial === option.id}
                            onChange={() => selectInitialQuestion(option.id)}
                          />
                          <span className="guided-initial-letter">{String.fromCharCode(65 + index)}.</span>
                          <span>{initialOptionText(option.enunciado)}</span>
                        </label>
                      ))}
                    </fieldset>
                    </div>
                    <label className="guided-field guided-initial-response">
                      <span>{t('mission.guided.initialAnswerLabel')}</span>
                      <textarea
                        rows={8}
                        value={initialAnswerText}
                        onChange={(event) => updateInitialText(event.target.value)}
                        disabled={!selectedInitial}
                        placeholder={t('mission.guided.backendPlaceholder')}
                        aria-describedby="guided-validation"
                        aria-invalid={Boolean(validation)}
                      />
                    </label>
                    <div id="guided-validation" className="guided-validation" aria-live="assertive">
                      {validation}
                    </div>
                  </div>
                ) : isActivityVideoStep && activityVideoId ? (
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
                    {t('mission.guided.questionLabel', { current: currentQuestionNumber })}
                  </p>
                  <h1
                    ref={headingRef}
                    id="guided-question-title"
                    className={questionTitleClass}
                    tabIndex={-1}
                  >
                    {currentQuestion?.enunciado ?? ''}
                  </h1>
                  <p className="guided-help">{t(currentQuestion?.categoria === 'actividad'
                    ? 'mission.guided.activityHelp' : 'mission.guided.backendHelp')}</p>

                  {currentQuestion?.categoria === 'actividad' && (
                    <label className="guided-checkbox guided-paper-choice">
                      <input
                        type="checkbox"
                        checked={isPaperAnswer(answers[currentQuestion.id] ?? '')}
                        onChange={(event) => updateActivityPaper(currentQuestion.id, event.target.checked)}
                        aria-describedby="guided-validation"
                      />
                      <span aria-hidden="true">✓</span>
                      {t('mission.guided.completedOnPaper')}
                    </label>
                  )}

                  {currentQuestion && (
                    <label className="guided-field">
                      <span className="sr-only">{currentQuestion.enunciado}</span>
                      <textarea
                        value={currentAnswer}
                        onChange={(event) => currentQuestion.categoria === 'actividad'
                          ? updateActivityAnswer(currentQuestion.id, event.target.value)
                          : updateAnswer(currentQuestion.id, event.target.value)}
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

              {!previewContentUnavailable && <footer className="guided-footer">
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
              </footer>}
            </article>
          </section>
        </div>
      </div>
    </main>
  );
}
