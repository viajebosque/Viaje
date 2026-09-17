import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGuidedSteps, initialQuestions, readInitialChoice, changeInitialChoice,
  initialChoiceIsValid, migrateGuidedStep, serializeGuidedEntries, initialOptionText,
} from '../src/lib/initialChoice.ts';

function questions(mission = 1) {
  return Array.from({ length: 8 }, (_, index) => ({
    id: `m${mission}-q${index + 1}`, mission_id: `m${mission}`, orden: index + 1,
    categoria: index < 4 ? 'iniciacion' : index === 4 ? 'actividad' : 'reflexion',
    enunciado: `Contenido propio ${mission}/${index + 1}`,
  }));
}

test('each of the nine missions keeps its own four choices and subsequent content', () => {
  for (let n = 1; n <= 9; n++) {
    const source = questions(n);
    const steps = buildGuidedSteps(source, false);
    assert.equal(steps.length, 5);
    assert.equal(steps[0].kind, 'initial');
    assert.deepEqual(steps[0].questions, source.slice(0, 4));
    assert.deepEqual(steps.slice(1).map((step) => step.question), source.slice(4));
    assert.equal(steps[1].question.categoria, 'actividad');
  }
});

test('video follows the combined step, followed by the unchanged activity and reflections', () => {
  const source = questions();
  const steps = buildGuidedSteps(source, true);
  assert.equal(steps.length, 6);
  assert.equal(steps[1].kind, 'video');
  assert.deepEqual(steps.slice(2).map((step) => step.question), source.slice(4));
});

test('only a leading block of four initial questions is combined', () => {
  const source = questions();
  source[0].categoria = 'actividad';
  assert.deepEqual(initialQuestions(source), []);
  assert.equal(buildGuidedSteps(source, false).length, 8);
});

test('new and legacy users have no default selected option', () => {
  const options = initialQuestions(questions());
  assert.equal(readInitialChoice('', options), null);
  assert.equal(readInitialChoice('Respuesta anterior', options), null);
  const draft = changeInitialChoice('', options, { text: 'Borrador antes de elegir' });
  assert.equal(readInitialChoice(draft, options).selectedQuestionId, null);
  assert.equal(initialChoiceIsValid(draft, options), false);
});

test('changing a single selection retains the response and its legacy answer', () => {
  const options = initialQuestions(questions());
  let saved = changeInitialChoice('Mi respuesta antigua', options, {
    selectedQuestionId: options[0].id, text: 'Texto que estoy desarrollando',
  });
  saved = changeInitialChoice(saved, options, { selectedQuestionId: options[3].id });
  assert.deepEqual(readInitialChoice(saved, options), {
    kind: 'initial-choice', version: 1, selectedQuestionId: options[3].id,
    text: 'Texto que estoy desarrollando', legacyAnswer: 'Mi respuesta antigua',
  });
  assert.equal(initialChoiceIsValid(saved, options), true);
});

test('requires a valid selection and response, as in the current written-response flow', () => {
  const options = initialQuestions(questions());
  for (const text of ['', '  \n ']) {
    const draft = changeInitialChoice('', options, { selectedQuestionId: options[1].id, text });
    assert.equal(initialChoiceIsValid(draft, options), false);
  }
  const invalid = changeInitialChoice('', options, { selectedQuestionId: 'another-mission', text: 'Answer' });
  assert.equal(initialChoiceIsValid(invalid, options), false);
});

test('saving and reopening restores selection and exact text without touching three historical rows', () => {
  const source = questions();
  const options = initialQuestions(source);
  const legacyRaw = JSON.stringify({ option: 'old option', reflection: 'old reflection' });
  const backend = Object.fromEntries(source.map((q) => [q.id, `Original ${q.id}`]));
  backend[options[0].id] = legacyRaw;
  const answers = { ...backend, [options[0].id]: changeInitialChoice(legacyRaw, options, {
    selectedQuestionId: options[2].id, text: 'Mi respuesta\ncon dos líneas y emoji 🌲',
  }) };
  const entries = serializeGuidedEntries(source, answers);
  assert.equal(entries.length, 5);
  for (const q of options.slice(1)) assert.equal(entries.some((e) => e.question_id === q.id), false);
  for (const entry of entries) backend[entry.question_id] = entry.respuesta;
  const restored = readInitialChoice(backend[options[0].id], options);
  assert.equal(restored.selectedQuestionId, options[2].id);
  assert.equal(restored.text, 'Mi respuesta\ncon dos líneas y emoji 🌲');
  assert.equal(restored.legacyAnswer, legacyRaw);
  for (const q of options.slice(1)) assert.equal(backend[q.id], `Original ${q.id}`);
  assert.deepEqual(serializeGuidedEntries(source, backend), entries);
});

test('pending local backup round trip retains partial drafts and old responses', () => {
  const options = initialQuestions(questions());
  const draft = changeInitialChoice('Respuesta antigua', options, { text: 'Borrador sin seleccionar' });
  const backup = JSON.parse(JSON.stringify({ answers: { [options[0].id]: draft }, pending: true, step: 0, flowVersion: 4 }));
  const restored = readInitialChoice(backup.answers[options[0].id], options);
  assert.equal(restored.selectedQuestionId, null);
  assert.equal(restored.text, 'Borrador sin seleccionar');
  assert.equal(restored.legacyAnswer, 'Respuesta antigua');
});

test('previous independent answers are preserved byte for byte until intentionally edited', () => {
  const source = questions();
  const answers = Object.fromEntries(source.map((q) => [q.id, `  Original ${q.id}\n`]));
  assert.deepEqual(serializeGuidedEntries(source, answers), source.map((q) => ({
    question_id: q.id, respuesta: answers[q.id],
  })));
});

test('migrates version 3 progress across the initial block and video', () => {
  const source = questions();
  assert.deepEqual(Array.from({ length: 9 }, (_, step) => migrateGuidedStep(step, 3, source, true, 1)),
    [0, 0, 0, 0, 1, 2, 3, 4, 5]);
  assert.equal(migrateGuidedStep(4, 3, source, false, 1), 1);
});

test('preserves older video migration and current saved navigation', () => {
  const source = questions();
  assert.equal(migrateGuidedStep(4, undefined, source, true, 1), 2);
  assert.equal(migrateGuidedStep(4, 2, source, true, 2), 2);
  assert.equal(migrateGuidedStep(4, 2, source, true, 1), 1);
  for (let step = 0; step < 6; step++) assert.equal(migrateGuidedStep(step, 4, source, true, 1), step);
  assert.equal(migrateGuidedStep(100, 4, source, true, 1), 5);
});

test('strips only option labels and preserves full questions and phrase content', () => {
  assert.equal(initialOptionText('B. ¿Cuándo fue la última vez? ¿Qué estabas haciendo?'),
    '¿Cuándo fue la última vez? ¿Qué estabas haciendo?');
  assert.equal(initialOptionText('Frase Inicial de Pensamiento Profundo\nA. Una frase propia.'), 'Una frase propia.');
  assert.equal(initialOptionText('¿Qué estás fingiendo no saber?'), '¿Qué estás fingiendo no saber?');
});
