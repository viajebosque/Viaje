import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completeMissionWithFallback, MissionCompletionSetupError,
} from '../src/lib/missionCompletion.ts';

const missing = { data: null, error: { code: 'PGRST202', message: 'Function not found' } };

test('older complete answers receive a token through the existing RPC', async () => {
  const called = [];
  const awarded = await completeMissionWithFallback(async name => {
    called.push(name);
    return name === 'complete_mission_initial_choice'
      ? missing : { data: true, error: null };
  }, true);
  assert.equal(awarded, true);
  assert.deepEqual(called, ['complete_mission_initial_choice', 'complete_mission']);
});

test('new one-of-four answers do not claim a token when the guided RPC is missing', async () => {
  await assert.rejects(
    completeMissionWithFallback(async name => name === 'complete_mission_initial_choice'
      ? missing : { data: false, error: null }, true),
    MissionCompletionSetupError
  );
});

test('a deployed guided RPC is authoritative, and unrelated errors never use the fallback', async () => {
  const called = [];
  assert.equal(await completeMissionWithFallback(async name => {
    called.push(name);
    return { data: false, error: null };
  }, true), false);
  assert.deepEqual(called, ['complete_mission_initial_choice']);

  const networkError = { code: 'NETWORK', message: 'Unavailable' };
  await assert.rejects(
    completeMissionWithFallback(async () => ({ data: null, error: networkError }), true),
    error => error === networkError
  );
  assert.equal(await completeMissionWithFallback(async name => {
    assert.equal(name, 'complete_mission');
    return { data: true, error: null };
  }, false), true);
});
