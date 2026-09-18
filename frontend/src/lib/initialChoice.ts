import type { Question } from './missions';

export type GuidedStep =
  | { kind: 'initial'; questions: Question[] }
  | { kind: 'question'; question: Question }
  | { kind: 'video' };

// Las 4 primeras preguntas de la misión forman el bloque de elección inicial:
// se leen las 4 y se responde una sola. Si el conjunto no tiene esa forma, no
// hay bloque y las preguntas siguen una por una.
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

// La opción elegida NO se guarda aparte: es la pregunta inicial que tiene
// texto. Guardar el identificador y derivar lo demás evita que la selección y
// la respuesta queden contando cosas distintas.
export function selectedInitialQuestionId(
  questions: Question[],
  answers: Record<string, string>
): string | null {
  return initialQuestions(questions).find((q) => (answers[q.id] ?? '').trim())?.id ?? null;
}

// Cambiar de opción borra lo escrito en la anterior, acá y en la base (se
// guarda '' en esa fila). Siempre queda una sola respuesta entre las iniciales.
export function chooseInitialQuestion(
  questions: Question[],
  answers: Record<string, string>,
  questionId: string
): Record<string, string> {
  const next = { ...answers };
  for (const q of initialQuestions(questions)) next[q.id] = '';
  next[questionId] = '';
  return next;
}

export function initialChoiceIsValid(
  questions: Question[],
  answers: Record<string, string>
): boolean {
  const initial = initialQuestions(questions);
  return initial.length === 0 || initial.some((q) => Boolean((answers[q.id] ?? '').trim()));
}

// Se escriben las 8 filas, también las 3 iniciales vacías: es lo que borra la
// opción anterior cuando la persona cambia de pregunta.
export function guidedEntries(questions: Question[], answers: Record<string, string>) {
  return questions.map((q) => ({
    question_id: q.id,
    respuesta: answers[q.id] ?? '',
  }));
}

export function initialOptionText(text: string): string {
  return text
    .replace(/^\s*(?:Frase Inicial de Pensamiento Profundo|Initial Deep Thought Phrase)\s*[:—–-]?\s*\n/i, '')
    .replace(/^\s*[A-D][.)]\s+/, '')
    .trim();
}
