import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { patchAndroidProject } from '../../scripts/patch-android.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-android-patch-'));
  const javaPath = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'aero', 'jarvis');
  const manifestPath = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  fs.mkdirSync(javaPath, { recursive: true });
  fs.writeFileSync(path.join(root, 'android', 'variables.gradle'), 'ext { minSdkVersion = 23 }');
  fs.writeFileSync(path.join(root, 'android', 'app', 'build.gradle'), `plugins { id 'com.android.application' }\ndependencies {\n}`);
  fs.writeFileSync(manifestPath, '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:label="Aero"></application></manifest>');
  fs.writeFileSync(path.join(javaPath, 'MainActivity.kt'), 'package com.aero.jarvis\nclass MainActivity');
  return { root, javaPath, manifestPath };
}

test('Android patch registers the plugin and replaces either activity template', () => {
  const f = fixture();
  try {
    patchAndroidProject(f.root, process.cwd());
    const main = fs.readFileSync(path.join(f.javaPath, 'MainActivity.java'), 'utf8');
    assert.match(main, /registerPlugin\(AeroDevicePlugin\.class\)/);
    assert.ok(fs.existsSync(path.join(f.javaPath, 'AeroDevicePlugin.java')));
    assert.ok(fs.existsSync(path.join(f.javaPath, 'AeroWakeWordService.java')));
    assert.ok(fs.existsSync(path.join(f.javaPath, 'AeroNotificationListenerService.java')));
    const gradle = fs.readFileSync(path.join(f.root, 'android', 'app', 'build.gradle'), 'utf8');
    assert.match(gradle, /ai\.picovoice:porcupine-android:4\.0\.2/);
    assert.ok(!fs.existsSync(path.join(f.javaPath, 'MainActivity.kt')));
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('Android patch adds package and intent visibility without duplicate query blocks', () => {
  const f = fixture();
  try {
    patchAndroidProject(f.root, process.cwd());
    patchAndroidProject(f.root, process.cwd());
    const manifest = fs.readFileSync(f.manifestPath, 'utf8');
    assert.equal((manifest.match(/<queries>/g) || []).length, 1);
    assert.equal((manifest.match(/android:name="com\.whatsapp"/g) || []).length, 1);
    assert.match(manifest, /android\.intent\.action\.SET_TIMER/);
    assert.match(manifest, /android:scheme="https"/);
    assert.equal((manifest.match(/android:name="android.permission.MODIFY_AUDIO_SETTINGS"/g) || []).length, 1);
    assert.equal((manifest.match(/android:name="android.permission.RECORD_AUDIO"/g) || []).length, 1);
    assert.equal((manifest.match(/android:name="android.permission.WRITE_SETTINGS"/g) || []).length, 1);
    assert.equal((manifest.match(/android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE"/g) || []).length, 1);
    assert.equal((manifest.match(/android:name="android.permission.POST_NOTIFICATIONS"/g) || []).length, 1);
    assert.match(manifest, /android:name="\.AeroWakeWordService" android:exported="false" android:foregroundServiceType="microphone"/);
    assert.match(manifest, /android:name="\.AeroNotificationListenerService"[\s\S]*android.permission.BIND_NOTIFICATION_LISTENER_SERVICE[\s\S]*android.service.notification.NotificationListenerService/);
    assert.match(manifest, /android\.speech\.RecognitionService/);
    assert.match(manifest, /android\.settings\.ACTION_NOTIFICATION_LISTENER_SETTINGS/);
    const variables = fs.readFileSync(path.join(f.root, 'android', 'variables.gradle'), 'utf8');
    assert.match(variables, /minSdkVersion = 30/);
    assert.ok(manifest.indexOf('<queries>') < manifest.indexOf('<application'));
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});


test('native speech source is tap-to-talk and does not place calls or send messages', () => {
  const java = fs.readFileSync(path.join(process.cwd(), 'native-android', 'AeroDevicePlugin.java'), 'utf8');
  assert.match(java, /@Permission\(alias = "microphone", strings = \{ Manifest\.permission\.RECORD_AUDIO \}\)/);
  assert.match(java, /RecognizerIntent\.EXTRA_PREFER_OFFLINE, true/);
  assert.match(java, /SpeechRecognizer\.createOnDeviceSpeechRecognizer/);
  assert.match(java, /public void setBrightness/);
  assert.match(java, /Settings\.System\.canWrite/);
  assert.match(java, /public void speakText/);
  assert.match(java, /new TextToSpeech/);
  assert.match(java, /Intent\.ACTION_DIAL/);
  assert.match(java, /Intent\.ACTION_SENDTO/);
  assert.doesNotMatch(java, /Intent\.ACTION_CALL/);
  assert.doesNotMatch(java, /SmsManager\.getDefault\(\)\.sendTextMessage/);
});


test('Android patch keeps optional wake dependency and permissions idempotent', () => {
  const f = fixture();
  try {
    patchAndroidProject(f.root, process.cwd());
    patchAndroidProject(f.root, process.cwd());
    const gradle = fs.readFileSync(path.join(f.root, 'android', 'app', 'build.gradle'), 'utf8');
    assert.equal((gradle.match(/ai\.picovoice:porcupine-android:4\.0\.2/g) || []).length, 1);
    const manifest = fs.readFileSync(f.manifestPath, 'utf8');
    assert.equal((manifest.match(/<service android:name="\.AeroWakeWordService"/g) || []).length, 1);
    assert.equal((manifest.match(/android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE"/g) || []).length, 1);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});


test('wake-word service uses explicit foreground notification and pauses after detection', () => {
  const java = fs.readFileSync(path.join(process.cwd(), 'native-android', 'AeroWakeWordService.java'), 'utf8');
  assert.match(java, /startForeground\(NOTIFICATION_ID,[\s\S]*FOREGROUND_SERVICE_TYPE_MICROPHONE/);
  assert.match(java, /setKeywordPaths\(new String\[\]\{MODEL_ASSET\}\)/);
  assert.match(java, /ACTION_STOP/);
  assert.match(java, /Wake listening is paused after detection/);
  assert.match(java, /releaseDetector\(\);[\s\S]*detecting = false/);
  const plugin = fs.readFileSync(path.join(process.cwd(), 'native-android', 'AeroDevicePlugin.java'), 'utf8');
  assert.match(plugin, /Manifest\.permission\.POST_NOTIFICATIONS/);
  assert.match(plugin, /wakeWordNotificationPermissionsCallback/);
  assert.match(plugin, /key is not saved by Aero/i);
  const notification = fs.readFileSync(path.join(process.cwd(), 'native-android', 'AeroNotificationListenerService.java'), 'utf8');
  assert.match(notification, /extends NotificationListenerService/);
  assert.match(notification, /getActiveNotifications\(\)/);
  assert.doesNotMatch(notification, /getNotification\(\)|Notification\.extras|EXTRA_TEXT|EXTRA_TITLE/);
});

test('Android patch copies a supplied wake model but removes a stale one when absent', () => {
  const f = fixture();
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'aero-android-source-'));
  try {
    fs.mkdirSync(path.join(source, 'native-android', 'assets'), { recursive: true });
    fs.copyFileSync(path.join(process.cwd(), 'native-android', 'AeroDevicePlugin.java'), path.join(source, 'native-android', 'AeroDevicePlugin.java'));
    fs.copyFileSync(path.join(process.cwd(), 'native-android', 'AeroWakeWordService.java'), path.join(source, 'native-android', 'AeroWakeWordService.java'));
    fs.copyFileSync(path.join(process.cwd(), 'native-android', 'AeroNotificationListenerService.java'), path.join(source, 'native-android', 'AeroNotificationListenerService.java'));
    const model = path.join(source, 'native-android', 'assets', 'aero-activate-android.ppn');
    fs.writeFileSync(model, 'test-model');
    const first = patchAndroidProject(f.root, source);
    const target = path.join(f.root, 'android', 'app', 'src', 'main', 'assets', 'aero-activate-android.ppn');
    assert.equal(first.wakeModelCopied, true);
    assert.equal(fs.readFileSync(target, 'utf8'), 'test-model');
    fs.unlinkSync(model);
    const second = patchAndroidProject(f.root, source);
    assert.equal(second.wakeModelCopied, false);
    assert.equal(fs.existsSync(target), false);
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
});


test('tap-to-talk stops the wake-word service before claiming the microphone', () => {
  const java = fs.readFileSync(path.join(process.cwd(), 'native-android', 'AeroDevicePlugin.java'), 'utf8');
  const start = java.indexOf('private void startRecognitionAfterPermission');
  const end = java.indexOf('@PluginMethod\n    public void stopSpeechRecognition', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const method = java.slice(start, end);
  const stopWakeService = method.indexOf('stopService(new Intent(getContext(), AeroWakeWordService.class))');
  const beginSpeech = method.indexOf('speechRecognizer.startListening(intent)');
  assert.notEqual(stopWakeService, -1);
  assert.notEqual(beginSpeech, -1);
  assert.ok(stopWakeService < beginSpeech, 'wake-word detector must be stopped before SpeechRecognizer starts');
});


test('Android 14 auto language mode requests detection and switching only for supported languages', () => {
  const java = fs.readFileSync(path.join(process.cwd(), 'native-android', 'AeroDevicePlugin.java'), 'utf8');
  assert.match(java, /RecognizerIntent\.EXTRA_ENABLE_LANGUAGE_DETECTION/);
  assert.match(java, /RecognizerIntent\.EXTRA_ENABLE_LANGUAGE_SWITCH/);
  assert.match(java, /EXTRA_LANGUAGE_DETECTION_ALLOWED_LANGUAGES/);
  assert.match(java, /EXTRA_LANGUAGE_SWITCH_ALLOWED_LANGUAGES/);
  for (const language of ['en-US', 'ur-PK', 'hi-IN', 'es-ES', 'fr-FR', 'de-DE']) {
    assert.ok(java.includes('"' + language + '"'), `native recognizer should allow ${language}`);
  }
});


test('language detector ignores locales outside the supported response allowlist', () => {
  const java = fs.readFileSync(path.join(process.cwd(), 'native-android', 'AeroDevicePlugin.java'), 'utf8');
  const start = java.indexOf('@Override public void onLanguageDetection(Bundle results)');
  const end = java.indexOf('@Override public void onPartialResults', start);
  const method = java.slice(start, end);
  assert.match(method, /"ur-PK"\.equalsIgnoreCase\(detected\)/);
  assert.match(method, /"de-DE"\.equalsIgnoreCase\(detected\)/);
  assert.match(method, /\) return;\s*detectedSpeechLanguageTag = detected/s);
});


test('native language status does not claim detection unless a language callback happened', () => {
  const java = fs.readFileSync(path.join(process.cwd(), 'native-android', 'AeroDevicePlugin.java'), 'utf8');
  assert.match(java, /speechLanguageAutoDetected = false/);
  assert.match(java, /speechLanguageAutoDetected = true/);
  assert.match(java, /payload\.put\("languageAutoDetected", useAutomaticLanguage && speechLanguageAutoDetected\)/);
});
