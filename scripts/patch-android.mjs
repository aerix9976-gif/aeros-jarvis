import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ID = 'com.aero.jarvis';
const PACKAGES = [
  'com.google.android.youtube', 'com.android.settings',
  'com.android.chrome', 'com.chrome.beta', 'com.chrome.dev',
  'com.google.android.GoogleCamera', 'com.android.camera2', 'com.android.camera', 'com.sec.android.app.camera',
  'com.whatsapp', 'com.google.android.apps.messaging', 'com.samsung.android.messaging', 'com.android.mms',
  'com.spotify.music', 'com.google.android.apps.nbu.files', 'com.google.android.documentsui',
  'com.android.documentsui', 'com.google.android.calculator', 'com.sec.android.app.popupcalculator'
];
const INTENTS = [
  '<intent><action android:name="android.intent.action.DIAL" /></intent>',
  '<intent><action android:name="android.intent.action.SET_TIMER" /></intent>',
  '<intent><action android:name="android.intent.action.SENDTO" /><data android:scheme="smsto" /></intent>',
  '<intent><action android:name="android.intent.action.VIEW" /><data android:scheme="https" /></intent>',
  '<intent><action android:name="android.intent.action.VIEW" /><data android:scheme="http" /></intent>',
  '<intent><action android:name="android.speech.RecognitionService" /></intent>',
  '<intent><action android:name="android.intent.action.TTS_SERVICE" /></intent>',
  '<intent><action android:name="android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS" /></intent>'
];

function ensurePackageQueries(manifest) {
  const match = manifest.match(/<queries\b[^>]*>([\s\S]*?)<\/queries>/i);
  let body = match ? match[1] : '';
  for (const name of PACKAGES) {
    const escaped = name.replaceAll('.', '\\.');
    if (!new RegExp(`<package\\s+android:name=["']${escaped}["']\\s*/?>`, 'i').test(body)) {
      body += `\n        <package android:name="${name}" />`;
    }
  }
  for (const intent of INTENTS) {
    if (!body.includes(intent)) body += `\n        ${intent}`;
  }
  const queries = `<queries>${body}\n    </queries>`;
  if (match) return manifest.replace(match[0], queries);
  if (!/<application\b/i.test(manifest)) throw new Error('AndroidManifest.xml has no <application> element.');
  return manifest.replace(/<application\b/i, `${queries}\n    <application`);
}

function ensurePermissions(manifest) {
  const permissions = [
    '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
    '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
    '<uses-permission android:name="android.permission.WRITE_SETTINGS" />',
    '<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
    '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />',
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />'
  ];
  if (!/<manifest\b[^>]*>/i.test(manifest)) throw new Error('AndroidManifest.xml has no <manifest> root element.');
  const missing = permissions.filter(permission => !manifest.includes(permission));
  if (missing.length === 0) return manifest;
  return manifest.replace(/<manifest\b[^>]*>/i, opening => `${opening}\n    ${missing.join('\n    ')}`);
}

function ensureWakeWordService(manifest) {
  if (/<service\b[^>]*android:name=["']\.AeroWakeWordService["']/i.test(manifest)) return manifest;
  const service = `\n        <service android:name=".AeroWakeWordService" android:exported="false" android:foregroundServiceType="microphone" />`;
  if (!/<application\b[^>]*>/i.test(manifest)) throw new Error('AndroidManifest.xml has no <application> element.');
  return manifest.replace(/(<application\b[^>]*>)/i, `$1${service}`);
}

function ensureNotificationListenerService(manifest) {
  if (/<service\b[^>]*android:name=["']\.AeroNotificationListenerService["']/i.test(manifest)) return manifest;
  const service = `\n        <service android:name=".AeroNotificationListenerService" android:label="Aero notification count" android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE" android:exported="true"><intent-filter><action android:name="android.service.notification.NotificationListenerService" /></intent-filter></service>`;
  if (!/<application\b[^>]*>/i.test(manifest)) throw new Error('AndroidManifest.xml has no <application> element.');
  return manifest.replace(/(<application\b[^>]*>)/i, `$1${service}`);
}

function ensurePorcupineDependency(androidRoot) {
  const groovyPath = path.join(androidRoot, 'app', 'build.gradle');
  const kotlinPath = path.join(androidRoot, 'app', 'build.gradle.kts');
  const gradlePath = fs.existsSync(groovyPath) ? groovyPath : kotlinPath;
  if (!fs.existsSync(gradlePath)) throw new Error('Android app Gradle build file is missing.');
  const before = fs.readFileSync(gradlePath, 'utf8');
  if (before.includes('ai.picovoice:porcupine-android')) return;
  const dependency = gradlePath.endsWith('.kts')
    ? '    implementation("ai.picovoice:porcupine-android:4.0.2")'
    : "    implementation 'ai.picovoice:porcupine-android:4.0.2'";
  if (!/dependencies\s*\{/i.test(before)) throw new Error('Could not locate the Android dependencies block.');
  const after = before.replace(/dependencies\s*\{/i, match => `${match}\n${dependency}`);
  fs.writeFileSync(gradlePath, after);
}

function enforceMinimumSdk(androidRoot) {
  const variablesPath = path.join(androidRoot, 'variables.gradle');
  if (!fs.existsSync(variablesPath)) throw new Error(`Android SDK config is missing: ${variablesPath}`);
  const before = fs.readFileSync(variablesPath, 'utf8');
  const after = before.replace(/(minSdkVersion\s*=\s*)\d+/, (_match, prefix) => `${prefix}30`);
  if (after === before && !/minSdkVersion\s*=\s*30/.test(before)) {
    throw new Error('Could not set minSdkVersion to 30 in android/variables.gradle.');
  }
  fs.writeFileSync(variablesPath, after);
}

export function patchAndroidProject(projectRoot = process.cwd(), sourceRoot = projectRoot) {
  const androidRoot = path.join(projectRoot, 'android');
  const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
  const packagePath = path.join(androidRoot, 'app', 'src', 'main', 'java', ...APP_ID.split('.'));
  const pluginSource = path.join(sourceRoot, 'native-android', 'AeroDevicePlugin.java');
  const wakeWordSource = path.join(sourceRoot, 'native-android', 'AeroWakeWordService.java');
  const notificationSource = path.join(sourceRoot, 'native-android', 'AeroNotificationListenerService.java');
  const wakeModelSource = path.join(sourceRoot, 'native-android', 'assets', 'aero-activate-android.ppn');
  if (!fs.existsSync(manifestPath)) throw new Error(`Android platform is missing: ${manifestPath}. Run npx cap add android first.`);
  if (!fs.existsSync(pluginSource)) throw new Error(`Native plugin source is missing: ${pluginSource}`);
  if (!fs.existsSync(wakeWordSource)) throw new Error(`Native wake-word service source is missing: ${wakeWordSource}`);
  if (!fs.existsSync(notificationSource)) throw new Error(`Native notification service source is missing: ${notificationSource}`);

  let manifest = fs.readFileSync(manifestPath, 'utf8');
  manifest = ensurePermissions(manifest);
  manifest = ensureWakeWordService(manifest);
  manifest = ensureNotificationListenerService(manifest);
  fs.writeFileSync(manifestPath, ensurePackageQueries(manifest));
  enforceMinimumSdk(androidRoot);
  ensurePorcupineDependency(androidRoot);
  fs.mkdirSync(packagePath, { recursive: true });
  for (const file of ['MainActivity.java', 'MainActivity.kt']) {
    const target = path.join(packagePath, file);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
  fs.copyFileSync(pluginSource, path.join(packagePath, 'AeroDevicePlugin.java'));
  fs.copyFileSync(wakeWordSource, path.join(packagePath, 'AeroWakeWordService.java'));
  fs.copyFileSync(notificationSource, path.join(packagePath, 'AeroNotificationListenerService.java'));
  const assetsPath = path.join(androidRoot, 'app', 'src', 'main', 'assets');
  fs.mkdirSync(assetsPath, { recursive: true });
  const installedModelPath = path.join(assetsPath, 'aero-activate-android.ppn');
  if (fs.existsSync(wakeModelSource)) fs.copyFileSync(wakeModelSource, installedModelPath);
  else if (fs.existsSync(installedModelPath)) fs.unlinkSync(installedModelPath);
  fs.writeFileSync(path.join(packagePath, 'MainActivity.java'), `package ${APP_ID};\n\nimport android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(AeroDevicePlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n}\n`);
  return { manifestPath, packagePath, wakeModelCopied: fs.existsSync(wakeModelSource) };
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  try {
    const result = patchAndroidProject(process.cwd(), path.dirname(path.dirname(currentFile)));
    process.stdout.write(`Patched Android plugin, wake-word and count-only notification services, and package visibility in ${result.packagePath}\n`);
    process.stdout.write(result.wakeModelCopied ? 'Wake-word model copied.\n' : 'Wake-word model missing; wake listening will remain unavailable until native-android/assets/aero-activate-android.ppn is added.\n');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
