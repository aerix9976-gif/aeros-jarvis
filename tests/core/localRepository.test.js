import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalRepository, DEFAULT_SETTINGS } from '../../src/core/localRepository.js';

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    async get(key) { return values.has(key) ? values.get(key) : null; },
    async set(key, value) { values.set(key, value); },
    async remove(key) { values.delete(key); }
  };
}

test('repository returns private-by-default settings for first run', async () => {
  const repo = createLocalRepository(memoryStorage());
  assert.deepEqual(await repo.loadSettings(), { ...DEFAULT_SETTINGS });
  assert.deepEqual(await repo.loadHistory(), []);
});

test('repository saves only supported settings values', async () => {
  const repo = createLocalRepository(memoryStorage());
  assert.deepEqual(await repo.saveSettings({ saveHistory: true, voiceLanguage: 'ur-PK', voiceStyle: 'natural', admin: true }), {
    saveHistory: true, voiceLanguage: 'ur-PK', voiceStyle: 'natural', voiceResponses: false
  });
  assert.deepEqual(await repo.loadSettings(), { saveHistory: true, voiceLanguage: 'ur-PK', voiceStyle: 'natural', voiceResponses: false });
});

test('repository rejects unsupported or corrupted settings safely', async () => {
  const storage = memoryStorage({ 'aero.jarvis.settings.v1': '{bad json' });
  const repo = createLocalRepository(storage);
  assert.deepEqual(await repo.loadSettings(), { ...DEFAULT_SETTINGS });
  assert.deepEqual(await repo.saveSettings({ saveHistory: 'yes', voiceLanguage: 'xx-XX' }), { ...DEFAULT_SETTINGS });
});

test('repository sanitizes history records and limits it to 50 items', async () => {
  const repo = createLocalRepository(memoryStorage());
  const rows = Array.from({ length: 60 }, (_, i) => ({ command: `  cmd ${i}  `, intent: 'test', time: '09:00', extra: 'ignored' }));
  const saved = await repo.saveHistory(rows);
  assert.equal(saved.length, 50);
  assert.equal(saved[0].command, 'cmd 0');
  assert.deepEqual(Object.keys(saved[0]).sort(), ['command', 'intent', 'time']);
});

test('repository clears only the activity log', async () => {
  const storage = memoryStorage();
  const repo = createLocalRepository(storage);
  await repo.saveSettings({ saveHistory: true, voiceLanguage: 'en-GB', voiceStyle: 'tactical' });
  await repo.saveHistory([{ command: 'help', intent: 'help', time: '09:00' }]);
  await repo.clearHistory();
  assert.deepEqual(await repo.loadHistory(), []);
  assert.deepEqual(await repo.loadSettings(), { saveHistory: true, voiceLanguage: 'en-GB', voiceStyle: 'tactical', voiceResponses: false });
});

test('repository persists sanitized custom commands independently of activity history', async () => {
  const repo = createLocalRepository(memoryStorage());
  const saved = await repo.saveCustomCommands([
    { id: 'study', phrase: 'Launch study mode', action: 'open_app', value: 'youtube' },
    { id: 'bad', phrase: 'danger', action: 'shell', value: 'rm -rf /' }
  ]);
  assert.equal(saved.length, 1);
  assert.equal((await repo.loadCustomCommands())[0].id, 'study');
  await repo.clearHistory();
  assert.equal((await repo.loadCustomCommands()).length, 1);
});

test('repository defaults to automatic language input and a tactical voice profile', async () => {
  const repo = createLocalRepository(memoryStorage());
  assert.deepEqual(await repo.loadSettings(), { saveHistory: false, voiceLanguage: 'auto', voiceStyle: 'tactical', voiceResponses: false });
  assert.deepEqual(await repo.saveSettings({ voiceLanguage: 'hi-IN', voiceStyle: 'natural', voiceResponses: true }), { saveHistory: false, voiceLanguage: 'hi-IN', voiceStyle: 'natural', voiceResponses: true });
});
