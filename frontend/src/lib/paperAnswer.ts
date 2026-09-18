type PaperAnswer = {
  kind: 'paper-answer';
  version: 1;
  preferPaper: true;
  text: string;
};

function readPaperAnswer(value: string): PaperAnswer | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const answer = parsed as Partial<PaperAnswer>;
    return answer.kind === 'paper-answer' && answer.version === 1 &&
      answer.preferPaper === true && typeof answer.text === 'string'
      ? answer as PaperAnswer : null;
  } catch {
    return null;
  }
}

export function isPaperAnswer(value: string): boolean {
  return readPaperAnswer(value) !== null;
}

export function paperAnswerText(value: string): string {
  return readPaperAnswer(value)?.text ?? value;
}

export function setPaperAnswer(value: string, onPaper: boolean): string {
  const text = paperAnswerText(value);
  return onPaper
    ? JSON.stringify({ kind: 'paper-answer', version: 1, preferPaper: true, text } satisfies PaperAnswer)
    : text;
}

export function editPaperAnswer(value: string, text: string): string {
  return isPaperAnswer(value) ? setPaperAnswer(text, true) : text;
}

export function paperAnswerIsValid(value: string): boolean {
  return isPaperAnswer(value) || Boolean(paperAnswerText(value).trim());
}
