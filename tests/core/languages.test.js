import test from 'node:test';
import assert from 'node:assert/strict';
import { languageStatus, resolveResponseLocale } from '../../src/core/languages.js';

test('detected locale tags map to a voice locale actually supported by the current app', () => {
  assert.equal(resolveResponseLocale('es-MX'), 'es-ES');
  assert.equal(resolveResponseLocale('fr-CA'), 'fr-FR');
  assert.equal(resolveResponseLocale('ur-IN'), 'ur-PK');
  assert.equal(resolveResponseLocale('hi-IN'), 'hi-IN');
  assert.equal(resolveResponseLocale('en-GB'), 'en-GB');
  assert.equal(resolveResponseLocale('pt-BR'), 'en-US');
});

test('language UI labels automatic detection separately from fixed-locale fallback', () => {
  assert.equal(languageStatus('es-MX', true, true), 'Auto-detected: es-MX');
  assert.equal(languageStatus('en-US', false, true), 'Device/browser fallback: en-US');
  assert.equal(languageStatus('fr-FR', false, false), 'Selected locale: fr-FR');
  assert.equal(languageStatus('auto'), 'Not detected yet');
});
