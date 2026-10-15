import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText } from '../../src/core/normalizeText.js';
import { extractSlots } from '../../src/core/extractSlots.js';
import { routeCommand } from '../../src/core/routeCommand.js';
import { getResponse } from '../../src/core/responseEngine.js';
import { INTENTS as I } from '../../src/core/intentRegistry.js';
test('normalizeText normalizes casing, punctuation and whitespace', () => assert.equal(normalizeText('  OPEN, YouTube!! '), 'open youtube'));
test('normalizeText handles blank input', () => assert.equal(normalizeText('  '), ''));
test('extractSlots extracts supported app aliases', () => assert.equal(extractSlots('open You Tube').appName, 'youtube'));
test('extractSlots bounds timer duration to one day', () => {
  assert.equal(extractSlots('set timer 5 minutes').durationSeconds, 300);
  assert.equal(extractSlots('set timer 999 hours').durationSeconds, undefined);
});
test('extractSlots does not accept volume above 100', () => assert.equal(extractSlots('volume 140').volume, undefined));
test('routeCommand routes supported app launch only to registered intents', () => assert.equal(routeCommand('open YouTube').intent, I.OPEN_APP));
test('routeCommand requires confirmation for calls', () => assert.equal(routeCommand('call 5551234').requiresConfirmation, true));
test('routeCommand never routes unknown text as executable code', () => {
  const routed = routeCommand('run shell rm -rf /');
  assert.equal(routed.intent, I.UNKNOWN);
  assert.ok(routed.confidence < 0.5);
});
test('routeCommand does not infer a timer without a valid duration', () => assert.equal(routeCommand('set timer 999 hours').intent, I.UNKNOWN));
test('responseEngine returns an honest offline fallback', () => assert.match(getResponse(routeCommand('tell me a secret from the future')), /offline command/));

test('extractSlots recognizes timers phrased with for', () => {
  assert.equal(extractSlots('set a timer for 5 minutes').durationSeconds, 300);
  assert.equal(routeCommand('set a timer for 5 minutes').parameters.seconds, 300);
});
test('URL commands open the explicit URL instead of matching a brand alias', () => {
  assert.equal(routeCommand('open youtube.com').intent, I.OPEN_URL);
  assert.equal(routeCommand('open docs.google.com').parameters.url, 'docs.google.com');
});
test('app alias selection follows the first app mentioned, not registry order', () => {
  assert.equal(routeCommand('open camera then youtube').parameters.appName, 'camera');
});
test('app names are matched on token boundaries', () => {
  assert.equal(extractSlots('open notyoutube').appName, undefined);
});
test('invalid web search commands do not get executable intents', () => {
  assert.equal(routeCommand('search').intent, I.UNKNOWN);
  assert.equal(routeCommand(`search ${'x'.repeat(181)}`).intent, I.UNKNOWN);
});
test('volume parser accepts explicit percent and rejects values over 100', () => {
  assert.equal(routeCommand('set volume to 35 percent').parameters.level, 35);
  assert.equal(routeCommand('set volume to 135 percent').intent, I.UNKNOWN);
});

test('call intent requires confirmation and normalizes a phone-number target', () => {
  const call = routeCommand('call +1 (555) 123-4567');
  assert.equal(call.intent, I.PREPARE_CALL);
  assert.equal(call.requiresConfirmation, true);
  assert.equal(call.parameters.phoneNumber, '+15551234567');
});
test('contact-name call request is held for confirmation but not directly executable', () => {
  const call = routeCommand('call Mum');
  assert.equal(call.requiresConfirmation, true);
  assert.equal(call.parameters.phoneNumber, undefined);
});
test('text command extracts recipient and body for a user-confirmed SMS draft', () => {
  const text = routeCommand('text +15551234567 hello from Aero');
  assert.equal(text.intent, I.PREPARE_TEXT);
  assert.equal(text.requiresConfirmation, true);
  assert.equal(text.parameters.recipient, '+15551234567');
  assert.equal(text.parameters.message, 'hello from Aero');
  assert.equal(text.parameters.formatValid, true);
});
test('text command without an explicit number and body cannot be confirmed', () => {
  const text = routeCommand('text my friend');
  assert.equal(text.intent, I.PREPARE_TEXT);
  assert.equal(text.requiresConfirmation, true);
  assert.equal(text.parameters.formatValid, false);
});

test('routeCommand recognizes valid screen-brightness settings', () => {
  assert.deepEqual(routeCommand('set brightness to 45 percent').parameters, { level: 45 });
  assert.equal(routeCommand('set brightness to 45 percent').intent, I.BRIGHTNESS_SET);
  assert.equal(routeCommand('set brightness to 145 percent').intent, I.UNKNOWN);
});

test('localized help phrases route to the same safe help intent', () => {
  for (const phrase of ['مدد', 'madad karo', 'मदद करो', 'ayuda', 'aide', 'hilfe']) {
    assert.equal(routeCommand(phrase).intent, I.HELP, phrase);
  }
});

test('localized app phrases only open allow-listed apps', () => {
  for (const phrase of ['youtube kholo', 'یوٹیوب کھولو', 'यूट्यूब खोलो', 'abre youtube', 'ouvre youtube', 'öffne youtube']) {
    const result = routeCommand(phrase);
    assert.equal(result.intent, I.OPEN_APP, phrase);
    assert.equal(result.parameters.appName, 'youtube', phrase);
  }
  assert.equal(routeCommand('abre youtube.com').intent, I.UNKNOWN);
});

test('localized volume phrases route through the same bounded volume actions', () => {
  assert.equal(routeCommand('آواز بڑھاؤ').intent, I.VOLUME_UP);
  assert.equal(routeCommand('sube el volumen').intent, I.VOLUME_UP);
  assert.equal(routeCommand('lautstärke verringern').intent, I.VOLUME_DOWN);
  assert.equal(routeCommand('والیوم ۵۰').parameters.level, 50);
  assert.equal(routeCommand('setze die lautstärke auf 150 prozent').intent, I.UNKNOWN);
});

test('localized settings, timer, and stop-listening phrases route safely', () => {
  assert.equal(routeCommand('सेटिंग्स खोलो').intent, I.SETTINGS);
  assert.equal(routeCommand('pon un temporizador de 5 minutos').parameters.seconds, 300);
  assert.equal(routeCommand('arrête d’écouter').intent, I.STOP_LISTENING);
  assert.equal(routeCommand('5 minutes ka timer lagao').parameters.seconds, 300);
  assert.equal(routeCommand('ٹائمر ۵ منٹ لگاؤ').parameters.seconds, 300);
});

test('response engine localizes known responses from the detected speech language', () => {
  assert.match(getResponse(routeCommand('ayuda'), 'es-ES'), /Puedo abrir/);
  assert.match(getResponse(routeCommand('sube el volumen'), 'es-ES'), /Subiendo el volumen/);
  assert.match(getResponse(routeCommand('volume 30'), 'ur-PK'), /میڈیا والیوم 30 فیصد/);
  assert.match(getResponse(routeCommand('hilfe'), 'de-DE'), /Ich kann/);
});

test('German plurals and localized number normalization route timers safely', () => {
  assert.equal(routeCommand('starte einen Timer für 2 Stunden').parameters.seconds, 7200);
  assert.equal(routeCommand('Pon un temporizador de 3 minutos').parameters.seconds, 180);
  assert.equal(routeCommand('5 minutes ka timer lagao').parameters.seconds, 300);
  assert.equal(routeCommand('ٹائمر ۵ منٹ لگاؤ').parameters.seconds, 300);
  assert.equal(routeCommand('volume 101').intent, I.UNKNOWN);
});

test('diacritic-insensitive French apostrophe normalization preserves stop command intent', () => {
  assert.equal(routeCommand('arrête d’écouter').intent, I.STOP_LISTENING);
  assert.equal(routeCommand("arrête d'écouter").intent, I.STOP_LISTENING);
});
