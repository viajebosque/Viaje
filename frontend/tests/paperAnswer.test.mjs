import test from 'node:test';
import assert from 'node:assert/strict';
import {
  editPaperAnswer, isPaperAnswer, paperAnswerText, setPaperAnswer,
} from '../src/lib/paperAnswer.ts';

test('paper checkbox completes an empty activity and survives a save/reload round trip', () => {
  assert.equal(isPaperAnswer(''), false);
  const saved = setPaperAnswer('', true);
  assert.equal(isPaperAnswer(saved), true);
  assert.equal(paperAnswerText(saved), '');
  assert.ok(saved.trim().length > 0);
  assert.equal(isPaperAnswer(JSON.parse(JSON.stringify(saved))), true);
  assert.equal(setPaperAnswer(saved, false), '');
  assert.equal(isPaperAnswer(setPaperAnswer(saved, false)), false);
});

test('checking, editing and unchecking preserve an existing written answer', () => {
  const written = 'Mi carta\ncon dos líneas 🌲';
  let saved = setPaperAnswer(written, true);
  assert.equal(paperAnswerText(saved), written);
  saved = editPaperAnswer(saved, `${written}\ny una más`);
  assert.equal(isPaperAnswer(saved), true);
  assert.equal(setPaperAnswer(saved, false), `${written}\ny una más`);
  assert.ok(setPaperAnswer(saved, false).trim().length > 0);
  assert.equal(editPaperAnswer(written, 'Otro texto'), 'Otro texto');
});
