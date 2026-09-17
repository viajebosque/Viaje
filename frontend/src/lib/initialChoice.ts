import type { Question } from './missions';

export const GUIDED_FLOW_VERSION = 4;

export type InitialChoice = {
  kind: 'initial-choice';
  version: 1;
  selectedQuestionId: string | null;
  text: string;
  legacyAnswer: string;
};

export type GuidedStep =
  | { kind: 'initial'; questions: Question[] }
  | { kind: 'question'; question: Question }
  | { kind: 'video' };

export function initialQuestions(questions: Question[]): Question[] {
  const firstFour = questions.slice(0, 4);
  return firstFour.length === 4 && firstFour.every((q) => q.categoria === 'iniciacion')
    ? firstFour
    : [];
}

export function buildGuidedSteps(questions: Question[], hasVideo: boolean): GuidedStep[] {
  const initial = initialQuestions(questions);
  const steps: GuidedStep[] = initial.length ? [{ kind: 'initial', questions: initial }] : [];
  let videoAdded = false;
  for (const question of questions.slice(initial.length)) {
    if (hasVideo && !videoAdded && question.categoria === 'actividad') {
      steps.push({ kind: 'video' });
      videoAdded = true;
    }
    steps.push({ kind: 'question', question });
  }
  return steps;
}

export function readInitialChoice(value: string, options: Question[]): InitialChoice | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const choice = parsed as Partial<InitialChoice>;
    if (choice.kind !== 'initial-choice' || choice.version !== 1 ||
        typeof choice.text !== 'string' || typeof choice.legacyAnswer !== 'string' ||
        (choice.selectedQuestionId !== null &&
          !options.some((q) => q.id === choice.selectedQuestionId))) return null;
    return choice as InitialChoice;
  } catch {
    return null;
  }
}

export function changeInitialChoice(
  value: string,
  options: Question[],
  change: Partial<Pick<InitialChoice, 'selectedQuestionId' | 'text'>>
): string {
  const previous = readInitialChoice(value, options);
  return JSON.stringify({
    kind: 'initial-choice',
    version: 1,
    selectedQuestionId: previous?.selectedQuestionId ?? null,
    text: previous?.text ?? '',
    legacyAnswer: previous?.legacyAnswer ?? value,
    ...change,
  } satisfies InitialChoice);
}

export function initialChoiceIsValid(value: string, options: Question[]): boolean {
  const choice = readInitialChoice(value, options);
  return Boolean(choice?.selectedQuestionId && choice.text.trim());
}

export function serializeGuidedEntries(questions: Question[], answers: Record<string, string>) {
  const initial = initialQuestions(questions);
  const hasChoice = initial.length > 0 && readInitialChoice(answers[initial[0].id] ?? '', initial);
  // Las otras tres filas antiguas no se escriben: conservan sus respuestas originales.
  const untouched = new Set(hasChoice ? initial.slice(1).map((q) => q.id) : []);
  return questions.filter((q) => !untouched.has(q.id)).map((q) => ({
    question_id: q.id,
    respuesta: answers[q.id] ?? '',
  }));
}

// Los índices antiguos incluían las cuatro preguntas y, según la versión, el vídeo.
export function migrateGuidedStep(
  step: number, version: number | undefined, questions: Question[],
  hasVideo: boolean, missionNumber: number
): number {
  const activityIndex = questions.findIndex((q) => q.categoria === 'actividad');
  let migrated = Math.max(0, step);
  if (hasVideo && activityIndex >= 0 && migrated >= activityIndex &&
      (version === undefined || (version === 2 && missionNumber !== 1))) migrated += 1;
  if ((version ?? 0) < GUIDED_FLOW_VERSION && initialQuestions(questions).length) {
    migrated = migrated < 4 ? 0 : migrated - 3;
  }
  return Math.min(migrated, Math.max(0, buildGuidedSteps(questions, hasVideo).length - 1));
}

export function initialOptionText(text: string): string {
  return text
    .replace(/^\s*(?:Frase Inicial de Pensamiento Profundo|Initial Deep Thought Phrase)\s*[:—–-]?\s*\n/i, '')
    .replace(/^\s*[A-D][.)]\s+/, '')
    .trim();
}
