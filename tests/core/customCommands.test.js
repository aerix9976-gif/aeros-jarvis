import test from 'node:test';
import assert from 'node:assert/strict';
import { CUSTOM_ACTIONS, normalizeCustomCommand, routeCustomCommand, sanitizeCustomCommands } from '../../src/core/customCommands.js';

test('custom command routes exact phrase to a registered app action', () => {
  const commands = [{ id: 'go-study', phrase: '  launch study mode ', action: CUSTOM_ACTIONS.OPEN_APP, value: 'youtube' }];
  const routed = routeCustomCommand('LAUNCH STUDY MODE!', commands);
  assert.equal(routed.intent, 'open_app');
  assert.equal(routed.parameters.appName, 'youtube');
  assert.equal(routed.customCommandId, 'go-study');
  assert.equal(routeCustomCommand('launch study', commands), null);
});

test('custom commands reject arbitrary or dangerous actions', () => {
  assert.equal(normalizeCustomCommand({ id: 'x', phrase: 'run shell', action: 'shell', value: 'rm -rf /' }), null);
  assert.equal(normalizeCustomCommand({ id: 'x', phrase: 'send message', action: 'prepare_text', value: 'anything' }), null);
  assert.equal(normalizeCustomCommand({ id: 'x', phrase: 'open unknown', action: CUSTOM_ACTIONS.OPEN_APP, value: 'unknown-app' }), null);
});

test('custom commands enforce parameter boundaries', () => {
  assert.equal(normalizeCustomCommand({ phrase: 'quiet mode', action: CUSTOM_ACTIONS.SET_VOLUME, value: '0' }).value, '0');
  assert.equal(normalizeCustomCommand({ phrase: 'too loud', action: CUSTOM_ACTIONS.SET_VOLUME, value: '101' }), null);
  assert.equal(normalizeCustomCommand({ phrase: 'launch website', action: CUSTOM_ACTIONS.OPEN_URL, value: 'javascript:alert(1)' }), null);
  assert.equal(normalizeCustomCommand({ phrase: 'start timer', action: CUSTOM_ACTIONS.TIMER, value: '86401' }), null);
});

test('custom command sanitization removes duplicate triggers and caps command count', () => {
  const commands = sanitizeCustomCommands([
    { id: 'a', phrase: 'Open Home', action: CUSTOM_ACTIONS.OPEN_SETTINGS },
    { id: 'b', phrase: 'open home!', action: CUSTOM_ACTIONS.VOLUME_UP },
    { id: 'c', phrase: 'Open Camera', action: CUSTOM_ACTIONS.OPEN_APP, value: 'camera' }
  ]);
  assert.equal(commands.length, 2);
  assert.equal(commands[0].trigger, 'open home');
  assert.equal(commands[1].value, 'camera');
});
