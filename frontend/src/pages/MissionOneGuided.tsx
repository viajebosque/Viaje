import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import missionPanel from '../assets/forest/mission-one-panel.png';
import forestMap from '../assets/forest/forest-map.png';
import { completeMission, saveAnswers, type Mission, type Question } from '../lib/missions';

type GuidedDraft = {
  releaseOption: string;
  releaseReflection: string;
  letter: string;
  preferPaper: boolean;
  feeling: string;
  transformation: string;
  intention: string;
};

type Backup = {
  draft: GuidedDraft;
  pending: boolean;
  step: number;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type Props = {
  mission: Mission;
  questions: Question[];
  initialAnswers: Record<string, string>;
  initialCompleted: boolean;
  userId: string | null;
  isPreview: boolean;
  mapPath: string;
};

const EMPTY_DRAFT: GuidedDraft = {
  releaseOption: '',
  releaseReflection: '',
  letter: '',
  preferPaper: false,
  feeling: '',
  transformation: '',
  intention: '',
};

const TOTAL_STEPS = 5;
const LETTER_MIN_LENGTH = 20;

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

function draftFromAnswers(
  questions: Question[],
  answers: Record<string, string>
): GuidedDraft {
  const values = questions.slice(0, TOTAL_STEPS).map((q) => answers[q.id] ?? '');
  const release = parseStructured(values[0] ?? '');
  const letter = parseStructured(values[1] ?? '');

  return {
    ...EMPTY_DRAFT,
    releaseOption:
      typeof release?.option === 'string'
        ? release.option
        : values[0]
          ? 'other'
          : '',
    releaseReflection:
      typeof release?.reflection === 'string'
        ? release.reflection
        : release
          ? ''
          : values[0] ?? '',
    letter:
      typeof letter?.text === 'string' ? letter.text : values[1] ?? '',
    preferPaper: letter?.preferPaper === true,
    feeling: values[2] ?? '',
    transformation: values[3] ?? '',
    intention: values[4] ?? '',
  };
}

function readBackup(storageKey: string): Backup | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<Backup>;
    if (!candidate.draft || typeof candidate.pending !== 'boolean') return null;
    return {
      draft: { ...EMPTY_DRAFT, ...candidate.draft },
      pending: candidate.pending,
      step: Math.min(Math.max(Number(candidate.step) || 0, 0), TOTAL_STEPS - 1),
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

function serializedEntries(questions: Question[], draft: GuidedDraft) {
  const values = [
    JSON.stringify({
      version: 1,
      option: draft.releaseOption,
      reflection: draft.releaseReflection,
    }),
    JSON.stringify({
      version: 1,
      text: draft.letter,
      preferPaper: draft.preferPaper,
    }),
    draft.feeling,
    draft.transformation,
    draft.intention,
  ];

  return questions.slice(0, TOTAL_STEPS).map((question, index) => ({
    question_id: question.id,
    respuesta: values[index],
  }));
}

export default function MissionOneGuided({
  mission,
  questions,
  initialAnswers,
  initialCompleted,
  userId,
  isPreview,
  mapPath,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const storageKey = `mission-one-guided:${userId ?? 'preview'}`;
  const initialState = useMemo(() => {
    const backendDraft = draftFromAnswers(questions, initialAnswers);
    const backup = readBackup(storageKey);
    return {
      draft: backup && (backup.pending || isPreview) ? backup.draft : backendDraft,
      step: backup?.step ?? 0,
      hasPendingBackup: Boolean(backup?.pending),
    };
  }, [initialAnswers, isPreview, questions, storageKey]);

  const [draft, setDraft] = useState(initialState.draft);
  const [step, setStep] = useState(initialState.step);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    initialState.hasPendingBackup ? 'saving' : 'idle'
  );
  const [saveError, setSaveError] = useState('');
  const [validation, setValidation] = useState('');
  const [completed, setCompleted] = useState(initialCompleted);
  const [completing, setCompleting] = useState(false);
  const [exiting, setExiting] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const draftRef = useRef(draft);
  const stepRef = useRef(step);
  const dirtyVersionRef = useRef(initialState.hasPendingBackup ? 1 : 0);
  const savedVersionRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);

  const isStepValid = useCallback(
    (stepToCheck: number, value = draftRef.current) => {
      if (stepToCheck === 0) return Boolean(value.releaseOption);
      if (stepToCheck === 1) {
        return value.preferPaper || value.letter.trim().length >= LETTER_MIN_LENGTH;
      }
      if (stepToCheck === 2) return Boolean(value.feeling.trim());
      if (stepToCheck === 3) return Boolean(value.transformation.trim());
      return Boolean(value.intention.trim());
    },
    []
  );

  const performSave = useCallback(async (): Promise<boolean> => {
    if (saveInFlightRef.current) return saveInFlightRef.current;

    const operation = (async () => {
      while (savedVersionRef.current < dirtyVersionRef.current) {
        const targetVersion = dirtyVersionRef.current;
        const snapshot = draftRef.current;
        setSaveStatus('saving');
        setSaveError('');

        try {
          if (isPreview || !userId) {
            writeBackup(storageKey, {
              draft: snapshot,
              pending: false,
              step: stepRef.current,
            });
          } else {
            if (questions.length < TOTAL_STEPS) {
              throw new Error('mission-content-incomplete');
            }
            await saveAnswers(userId, serializedEntries(questions, snapshot));
          }
          savedVersionRef.current = targetVersion;

          if (dirtyVersionRef.current === targetVersion) {
            writeBackup(storageKey, {
              draft: isPreview ? snapshot : EMPTY_DRAFT,
              pending: false,
              step: stepRef.current,
            });
            setSaveStatus('saved');
          }
        } catch {
          writeBackup(storageKey, {
            draft: snapshot,
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

  function updateDraft(patch: Partial<GuidedDraft>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      draftRef.current = next;
      dirtyVersionRef.current += 1;
      writeBackup(storageKey, { draft: next, pending: true, step: stepRef.current });
      return next;
    });
    setSaveStatus('saving');
    setSaveError('');
    setValidation('');
    scheduleSave();
  }

  function goToStep(nextStep: number) {
    const bounded = Math.min(Math.max(nextStep, 0), TOTAL_STEPS - 1);
    const hasPendingChanges = dirtyVersionRef.current > savedVersionRef.current;
    stepRef.current = bounded;
    setStep(bounded);
    setValidation('');
    writeBackup(storageKey, {
      draft: hasPendingChanges || isPreview ? draftRef.current : EMPTY_DRAFT,
      pending: hasPendingChanges,
      step: bounded,
    });
  }

  function continueToNextStep() {
    if (!isStepValid(step)) {
      setValidation(t(`mission.guided.validation.step${step + 1}`));
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
      setValidation(t('mission.guided.validation.step5'));
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

  if (completed) {
    return (
      <main
        className="guided-mission guided-mission--complete"
        style={{ '--guided-forest': `url(${forestMap})` } as React.CSSProperties}
      >
        <section className="guided-celebration" aria-labelledby="guided-complete-title">
          <span className="guided-celebration-kicker">{t('mission.guided.completeKicker')}</span>
          <div className="guided-leaf" aria-hidden="true"><span /></div>
          <h1 id="guided-complete-title">{t('mission.guided.completeTitle')}</h1>
          <p className="guided-reward">{t('mission.guided.reward')}</p>
          <p className="guided-reward-meaning">{t('mission.guided.rewardMeaning')}</p>
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
            {t('mission.guided.missionLabel')} <span aria-hidden="true">·</span>{' '}
            {t('mission.guided.title')}
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
            aria-label={t('mission.guided.illustrationAlt')}
          >
            <div className="guided-illustration-copy">
              <span>{t('mission.guided.threshold')}</span>
              <h2>{t('mission.guided.title')}</h2>
              <p>{t('mission.guided.sideNote')}</p>
              <ul className="guided-features" aria-label={t('mission.guided.detailsLabel')}>
                <li><span aria-hidden="true">◷</span>{t('mission.guided.duration')}</li>
                <li><span aria-hidden="true">✓</span>{t('mission.guided.autoSave')}</li>
                <li><span aria-hidden="true">⌁</span>{t('mission.guided.private')}</li>
              </ul>
            </div>
          </aside>

          <section className="guided-panel" aria-labelledby="guided-question-title">
            <div className="guided-progress-area">
              <div className="guided-progress-meta">
                <div className="guided-progress-copy" aria-live="polite">
                  {t('mission.guided.step', { current: step + 1, total: TOTAL_STEPS })}
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
                aria-valuemax={TOTAL_STEPS}
                aria-valuenow={step + 1}
              >
                <span style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
              </div>
            </div>

            <article className="guided-question-card">
              <div className="guided-question-wrap">
            <p className="guided-eyebrow">{t(`mission.guided.eyebrow.step${step + 1}`)}</p>
            <h1 ref={headingRef} id="guided-question-title" tabIndex={-1}>
              {t(`mission.guided.questions.step${step + 1}`)}
            </h1>
            <p className="guided-help">{t(`mission.guided.help.step${step + 1}`)}</p>

            {step === 0 && (
              <fieldset className="guided-options" aria-describedby="guided-validation">
                <legend className="sr-only">{t('mission.guided.questions.step1')}</legend>
                {(['daily', 'expectations', 'other', 'unsure'] as const).map((option) => (
                  <label className="guided-option" key={option}>
                    <input
                      type="radio"
                      name="release-option"
                      value={option}
                      checked={draft.releaseOption === option}
                      onChange={(event) => updateDraft({ releaseOption: event.target.value })}
                    />
                    <span className="guided-radio" aria-hidden="true" />
                    <span>{t(`mission.guided.releaseOptions.${option}`)}</span>
                  </label>
                ))}
                <label className="guided-field guided-field--optional">
                  <span>{t('mission.guided.optionalReflection')}</span>
                  <textarea
                    value={draft.releaseReflection}
                    onChange={(event) => updateDraft({ releaseReflection: event.target.value })}
                    rows={3}
                    placeholder={t('mission.guided.optionalPlaceholder')}
                  />
                </label>
              </fieldset>
            )}

            {step === 1 && (
              <div className="guided-fields">
                <label className="guided-field">
                  <span className="sr-only">{t('mission.guided.questions.step2')}</span>
                  <textarea
                    value={draft.letter}
                    onChange={(event) => updateDraft({ letter: event.target.value })}
                    rows={9}
                    disabled={draft.preferPaper}
                    placeholder={t('mission.guided.letterPrompt')}
                    aria-describedby="guided-validation"
                  />
                </label>
                <label className="guided-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.preferPaper}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      updateDraft({ preferPaper: event.target.checked })
                    }
                  />
                  <span aria-hidden="true">✓</span>
                  {t('mission.guided.preferPaper')}
                </label>
              </div>
            )}

            {step >= 2 && (
              <label className="guided-field">
                <span className="sr-only">{t(`mission.guided.questions.step${step + 1}`)}</span>
                <textarea
                  value={
                    step === 2
                      ? draft.feeling
                      : step === 3
                        ? draft.transformation
                        : draft.intention
                  }
                  onChange={(event) => {
                    if (step === 2) updateDraft({ feeling: event.target.value });
                    else if (step === 3) updateDraft({ transformation: event.target.value });
                    else updateDraft({ intention: event.target.value });
                  }}
                  rows={8}
                  placeholder={t(`mission.guided.placeholders.step${step + 1}`)}
                  aria-describedby="guided-validation"
                />
              </label>
            )}

            <div id="guided-validation" className="guided-validation" aria-live="assertive">
              {validation}
            </div>
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
                onClick={step === TOTAL_STEPS - 1 ? finishMission : continueToNextStep}
                disabled={completing}
              >
                {step === TOTAL_STEPS - 1
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
