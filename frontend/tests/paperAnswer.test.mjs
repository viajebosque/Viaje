import test from 'node:test';
import assert from 'node:assert/strict';
import {
  editPaperAnswer, isPaperAnswer, paperAnswerIsValid, paperAnswerText, setPaperAnswer,
} from '../src/lib/paperAnswer.ts';

test('paper checkbox completes an empty activity and survives a save/reload round trip', () => {
  assert.equal(paperAnswerIsValid(''), false);
  const saved = setPaperAnswer('', true);
  assert.equal(isPaperAnswer(saved), true);
  assert.equal(paperAnswerText(saved), '');
  assert.equal(paperAnswerIsValid(saved), true);
  assert.equal(isPaperAnswer(JSON.parse(JSON.stringify(saved))), true);
  assert.equal(setPaperAnswer(saved, false), '');
  assert.equal(paperAnswerIsValid(setPaperAnswer(saved, false)), false);
});

test('checking, editing and unchecking preserve an existing written answer', () => {
  const written = 'Mi carta\ncon dos líneas 🌲';
  let saved = setPaperAnswer(written, true);
  assert.equal(paperAnswerText(saved), written);
  saved = editPaperAnswer(saved, `${written}\ny una más`);
  assert.equal(isPaperAnswer(saved), true);
  assert.equal(setPaperAnswer(saved, false), `${written}\ny una más`);
  assert.equal(paperAnswerIsValid(setPaperAnswer(saved, false)), true);
  assert.equal(editPaperAnswer(written, 'Otro texto'), 'Otro texto');
});
