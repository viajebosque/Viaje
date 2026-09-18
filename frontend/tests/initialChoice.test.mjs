import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGuidedSteps, initialQuestions, initialChoiceIsValid, initialOptionText,
  selectedInitialQuestionId, chooseInitialQuestion, guidedEntries,
} from '../src/lib/initialChoice.ts';

function questions(mission = 1) {
  return Array.from({ length: 8 }, (_, index) => ({
    id: `m${mission}-q${index + 1}`, mission_id: `m${mission}`, orden: index + 1,
    categoria: index < 4 ? 'iniciacion' : index === 4 ? 'actividad' : 'reflexion',
    enunciado: `Contenido propio ${mission}/${index + 1}`,
  }));
}

function empty(source) {
  return Object.fromEntries(source.map((q) => [q.id, '']));
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

test('video precedes the activity question', () => {
  const source = questions();
  const steps = buildGuidedSteps(source, true);
  assert.equal(steps.length, 6);
  assert.equal(steps[0].kind, 'initial');
  assert.equal(steps[1].kind, 'video');
  assert.equal(steps[2].question.categoria, 'actividad');
});

test('a question set that is not four iniciacion has no choice block', () => {
  const source = questions().map((q, i) => (i === 3 ? { ...q, categoria: 'reflexion' } : q));
  assert.deepEqual(initialQuestions(source), []);
  const steps = buildGuidedSteps(source, false);
  assert.equal(steps.length, 8);
  assert.ok(steps.every((step) => step.kind === 'question'));
});

test('the selected option is the initial question holding text', () => {
  const source = questions();
  assert.equal(selectedInitialQuestionId(source, empty(source)), null);
  const answers = { ...empty(source), [source[2].id]: 'mi respuesta' };
  assert.equal(selectedInitialQuestionId(source, answers), source[2].id);
});

test('whitespace alone does not count as a selected option', () => {
  const source = questions();
  const answers = { ...empty(source), [source[1].id]: '   \n  ' };
  assert.equal(selectedInitialQuestionId(source, answers), null);
  assert.equal(initialChoiceIsValid(source, answers), false);
});

test('switching option clears what was written on the previous one', () => {
  const source = questions();
  let answers = { ...empty(source), [source[1].id]: 'respuesta sobre la B' };
  answers = chooseInitialQuestion(source, answers, source[2].id);

  assert.equal(answers[source[1].id], '', 'la B queda vacia');
  assert.equal(answers[source[2].id], '', 'la C arranca en blanco');
  assert.equal(selectedInitialQuestionId(source, answers), null);
});

test('only one initial question ever holds text', () => {
  const source = questions();
  let answers = empty(source);
  for (const index of [0, 3, 1]) {
    answers = chooseInitialQuestion(source, answers, source[index].id);
    answers = { ...answers, [source[index].id]: `respuesta ${index}` };
    const withText = source.slice(0, 4).filter((q) => answers[q.id].trim());
    assert.deepEqual(withText.map((q) => q.id), [source[index].id]);
  }
});

test('switching option never touches answers outside the initial block', () => {
  const source = questions();
  const answers = {
    ...empty(source),
    [source[0].id]: 'inicial',
    [source[4].id]: 'actividad',
    [source[5].id]: 'reflexion',
  };
  const next = chooseInitialQuestion(source, answers, source[3].id);
  assert.equal(next[source[4].id], 'actividad');
  assert.equal(next[source[5].id], 'reflexion');
});

test('the choice step is valid once any initial question has text', () => {
  const source = questions();
  assert.equal(initialChoiceIsValid(source, empty(source)), false);
  assert.equal(
    initialChoiceIsValid(source, { ...empty(source), [source[3].id]: 'algo' }),
    true
  );
});

test('a mission without a choice block does not block on it', () => {
  const source = questions().map((q) => ({ ...q, categoria: 'reflexion' }));
  assert.equal(initialChoiceIsValid(source, empty(source)), true);
});

test('every question is written, including the three left blank', () => {
  const source = questions();
  const answers = { ...empty(source), [source[2].id]: 'elegida' };
  const entries = guidedEntries(source, answers);

  assert.equal(entries.length, 8);
  assert.deepEqual(entries[2], { question_id: source[2].id, respuesta: 'elegida' });
  // Escribir '' es lo que borra la opcion anterior en la base.
  for (const index of [0, 1, 3]) {
    assert.deepEqual(entries[index], { question_id: source[index].id, respuesta: '' });
  }
});

test('a question never answered is written as empty text, not undefined', () => {
  const source = questions();
  const entries = guidedEntries(source, {});
  assert.ok(entries.every((entry) => entry.respuesta === ''));
});

test('option text drops the letter prefix and the phrase heading', () => {
  assert.equal(initialOptionText('A. ¿Dónde te sientes estancada?'), '¿Dónde te sientes estancada?');
  assert.equal(initialOptionText('B) Segunda opción'), 'Segunda opción');
  assert.equal(
    initialOptionText('Frase Inicial de Pensamiento Profundo:\nC. Tercera opción'),
    'Tercera opción'
  );
  assert.equal(
    initialOptionText('Initial Deep Thought Phrase\nD. Fourth option'),
    'Fourth option'
  );
  assert.equal(initialOptionText('  Sin prefijo  '), 'Sin prefijo');
});
