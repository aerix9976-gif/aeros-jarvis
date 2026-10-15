import { Capacitor, registerPlugin } from '@capacitor/core';
import { INTENTS as I } from '../core/intentRegistry.js';

const AeroDevice = registerPlugin('AeroDevice');

export async function getCapabilities() {
  const native = Capacitor.isNativePlatform();
  if (!native) {
    return {
      native: false,
      bridge: false,
      canWriteSystemSettings: false,
      wakeWordModelAvailable: false, wakeWordRunning: false, wakeWordTriggered: false, notificationAccessGranted: false, activeNotificationCount: 0,
      voice: 'tap-to-talk only where browser speech recognition is available; multilingual auto-switch depends on browser support; wake phrase unavailable',
      automaticLanguageSwitchAvailable: false,
      actions: ['local command routing', 'web preview']
    };
  }
  try {
    const result = await AeroDevice.getCapabilities();
    const bridge = result?.bridge === true;
    return {
      native: true,
      bridge,
      canWriteSystemSettings: result?.canWriteSystemSettings === true,
      wakeWordModelAvailable: result?.wakeWordModelAvailable === true,
      wakeWordRunning: result?.wakeWordRunning === true,
      wakeWordTriggered: result?.wakeWordTriggered === true,
      notificationAccessGranted: result?.notificationAccessGranted === true,
      activeNotificationCount: Number.isFinite(result?.activeNotificationCount) ? Math.max(0, result.activeNotificationCount) : 0,
      voice: result?.tapToTalk ? `Android tap-to-talk via system speech service; ${result?.wakeWordRunning ? 'custom wake phrase active' : result?.wakeWordModelAvailable ? 'custom wake phrase ready after user start' : 'wake phrase requires custom Android model'}; online speech processing may occur` : 'Android speech recognition unavailable; typed commands still work',
      onDeviceSpeech: result?.onDeviceSpeechAvailable === true,
      automaticLanguageSwitchAvailable: result?.automaticLanguageSwitchAvailable === true,
      actions: bridge ? ['allow-listed app launch', 'media volume', 'Android settings', 'Clock timer', 'HTTP/HTTPS links', 'confirmed dialer/SMS composer', ...(result?.tapToTalk ? ['user-started tap-to-talk'] : []), ...(result?.wakeWordModelAvailable ? ['user-started Porcupine wake phrase'] : [])] : ['native platform detected; device bridge unavailable']
    };
  } catch {
    return { native: true, bridge: false, automaticLanguageSwitchAvailable: false, voice: 'native voice service is not connected', actions: ['local command routing'] };
  }
}

async function nativeCall(method, parameters = {}) {
  try {
    const result = await AeroDevice[method](parameters);
    return {
      ok: result?.ok !== false,
      message: typeof result?.message === 'string' ? result.message : 'Android action completed.',
      ...(typeof result?.processingMode === 'string' ? { processingMode: result.processingMode } : {}),
      ...(typeof result?.needsPermission === 'boolean' ? { needsPermission: result.needsPermission } : {}),
      ...(Number.isFinite(result?.count) ? { count: result.count } : {})
    };
  } catch (error) {
    const message = typeof error?.message === 'string' ? error.message.slice(0, 220) : '';
    return { ok: false, message: message || 'Android could not complete that action.' };
  }
}

export async function addNativeSpeechListeners(handlers = {}) {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handles = await Promise.all([
    AeroDevice.addListener('speechResult', event => handlers.onResult?.(event)),
    AeroDevice.addListener('speechError', event => handlers.onError?.(event)),
    AeroDevice.addListener('speechLanguage', event => handlers.onLanguageDetected?.(event)),
    AeroDevice.addListener('speechState', event => handlers.onState?.(event)),
    AeroDevice.addListener('wakeWordDetected', event => handlers.onWakeWordDetected?.(event)),
    AeroDevice.addListener('wakeWordError', event => handlers.onWakeWordError?.(event)),
    AeroDevice.addListener('notificationCountChanged', event => handlers.onNotificationCountChanged?.(event))
  ]);
  return () => { for (const handle of handles) { try { handle.remove(); } catch {} } };
}

export async function startNativeSpeechRecognition(language = 'auto') {
  if (!Capacitor.isNativePlatform()) return { ok: false, message: 'Native Android speech recognition is unavailable in the browser preview.' };
  const allowed = ['auto', 'en-US', 'en-GB', 'ur-PK', 'hi-IN', 'es-ES', 'fr-FR', 'de-DE'];
  const result = await nativeCall('startSpeechRecognition', { language: allowed.includes(language) ? language : 'auto' });
  return result;
}

export async function stopNativeSpeechRecognition() {
  if (!Capacitor.isNativePlatform()) return { ok: false, message: 'Native Android speech recognition is unavailable in the browser preview.' };
  return nativeCall('stopSpeechRecognition');
}

export async function requestBrightnessPermission() {
  if (!Capacitor.isNativePlatform()) return { ok: false, message: 'Brightness control is available only in the installed Android app.' };
  return nativeCall('requestBrightnessPermission');
}

export async function openNotificationAccessSettings() {
  if (!Capacitor.isNativePlatform()) return { ok: false, message: 'Notification count integration is available only in the installed Android app.' };
  return nativeCall('openNotificationAccessSettings');
}

export async function startNativeWakeWordListening(accessKey) {
  if (!Capacitor.isNativePlatform()) return { ok: false, message: 'Always-on wake-word detection requires the installed Android app.' };
  const key = String(accessKey || '').trim();
  if (key.length < 12 || key.length > 2048) return { ok: false, message: 'Enter your Picovoice AccessKey in Config. Aero does not save it.' };
  return nativeCall('startWakeWord', { accessKey: key });
}

export async function stopNativeWakeWordListening() {
  if (!Capacitor.isNativePlatform()) return { ok: false, message: 'Wake-word listening requires the installed Android app.' };
  return nativeCall('stopWakeWord');
}

export async function speakResponse(text, language = 'en-US', style = 'tactical') {
  const message = String(text || '').trim().slice(0, 400);
  if (!message) return { ok: false, message: 'There is no response to speak.' };
  if (Capacitor.isNativePlatform()) {
    return nativeCall('speakText', { text: message, language, style: ['tactical', 'natural'].includes(style) ? style : 'tactical' });
  }
  try {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      return { ok: false, message: 'Speech output is not supported in this browser.' };
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    const supported = ['en-US', 'en-GB', 'ur-PK', 'hi-IN', 'es-ES', 'fr-FR', 'de-DE'];
    utterance.lang = supported.includes(language) ? language : (navigator.language || 'en-US');
    utterance.rate = style === 'tactical' ? 0.88 : 1;
    utterance.pitch = style === 'tactical' ? 0.82 : 1;
    window.speechSynthesis.speak(utterance);
    return { ok: true, message: 'Speaking response.' };
  } catch {
    return { ok: false, message: 'Speech output could not start.' };
  }
}

export async function stopSpeechOutput() {
  if (Capacitor.isNativePlatform()) return nativeCall('stopSpeechOutput');
  try { window.speechSynthesis?.cancel(); return { ok: true, message: 'Speech output stopped.' }; }
  catch { return { ok: false, message: 'Speech output could not be stopped.' }; }
}

function parseHttpUrl(raw) {
  try {
    const url = new URL(String(raw ?? '').includes('://') ? String(raw) : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export async function runAction(command) {
  const p = command.parameters || {};
  const native = Capacitor.isNativePlatform();
  try {
    if (command.intent === I.WEB_SEARCH) {
      const query = String(p.query || '').trim();
      if (!query || query.length > 180) return { ok: false, message: 'Search query is empty or too long.' };
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      if (native) return await nativeCall('openUrl', { url });
      window.open(url, '_blank', 'noopener,noreferrer');
      return { ok: true, message: 'Search opened in a new browser tab (if pop-ups are allowed).' };
    }
    if (command.intent === I.OPEN_URL) {
      const url = parseHttpUrl(p.url);
      if (!url) return { ok: false, message: 'Only valid HTTP and HTTPS links are allowed.' };
      if (native) return await nativeCall('openUrl', { url: url.href });
      window.open(url.href, '_blank', 'noopener,noreferrer');
      return { ok: true, message: 'Link opened in a new browser tab (if allowed).' };
    }
    if (native) {
      if (command.intent === I.OPEN_APP) return await nativeCall('launchApp', { appName: p.appName });
      if (command.intent === I.VOLUME_SET) return await nativeCall('setMediaVolume', { level: p.level });
      if (command.intent === I.VOLUME_UP) return await nativeCall('adjustMediaVolume', { direction: 1 });
      if (command.intent === I.VOLUME_DOWN) return await nativeCall('adjustMediaVolume', { direction: -1 });
      if (command.intent === I.BRIGHTNESS_SET) return await nativeCall('setBrightness', { level: p.level });
      if (command.intent === I.SETTINGS) return await nativeCall('openSystemSettings');
      if (command.intent === I.TIMER) return await nativeCall('openTimer', { seconds: p.seconds });
      if (command.intent === I.PREPARE_CALL) {
        if (!p.phoneNumber) return { ok: false, message: 'Enter a phone number in the call request. Contact lookup is not enabled.' };
        return await nativeCall('prepareCall', { phoneNumber: p.phoneNumber });
      }
      if (command.intent === I.PREPARE_TEXT) {
        if (!p.formatValid || !p.recipient || !p.message) return { ok: false, message: 'Use: text +15551234567 your message. Nothing was sent.' };
        return await nativeCall('prepareText', { recipient: p.recipient, message: p.message });
      }
    }
    if (command.intent === I.OPEN_APP) return { ok: false, message: `Opening the installed ${p.appName} app needs the native Android bridge; this web preview cannot launch Android apps.` };
    if (command.intent === I.PREPARE_CALL) return { ok: false, message: 'Call preparation requires the installed Android app. No call was placed.' };
    if (command.intent === I.PREPARE_TEXT) return { ok: false, message: 'Message preparation requires the installed Android app. Nothing was sent.' };
    if ([I.VOLUME_SET, I.VOLUME_UP, I.VOLUME_DOWN, I.BRIGHTNESS_SET, I.SETTINGS, I.TIMER].includes(command.intent)) {
      return { ok: false, message: 'This action needs the native Android bridge, which is not available in this web preview.' };
    }
    if (command.intent === I.STOP_LISTENING) return { ok: false, message: 'Use the microphone control to stop tap-to-talk; continuous wake-word listening is not active.' };
    return { ok: true, message: '' };
  } catch {
    return { ok: false, message: 'The action could not be completed.' };
  }
}
