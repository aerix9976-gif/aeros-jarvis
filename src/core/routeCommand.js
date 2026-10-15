import { normalizeText } from './normalizeText.js';
import { extractSlots } from './extractSlots.js';
import { INTENTS as I } from './intentRegistry.js';
import { translateLocalizedCommand } from './localizedCommands.js';

export function routeCommand(text, context = {}) {
  const raw = String(text ?? '').trim();
  const value = normalizeText(raw);
  const slots = extractSlots(raw);
  const result = (intent, parameters = {}, confidence = 0.92, requiresConfirmation = false, responseKey = intent) => ({ intent, parameters, confidence, requiresConfirmation, responseKey });

  if (!value) return result(I.UNKNOWN, {}, 0, false, 'empty');
  const localizedCommand = translateLocalizedCommand(raw);
  if (localizedCommand && localizedCommand !== raw) return routeCommand(localizedCommand, context);
  if (/^(help|what can you do|commands|show commands)$/.test(value)) return result(I.HELP);
  if (/^(stop listening|stop voice|disable listening)$/.test(value)) return result(I.STOP_LISTENING);
  if (/^(open|show)\s+(phone\s+)?settings$/.test(value)) return result(I.SETTINGS, { section: 'general' });
  if (/^(search|google|look up)\s+/.test(value)) {
    const query = raw.replace(/^(search|google|look up)\s+/i, '').trim();
    if (query && query.length <= 180) return result(I.WEB_SEARCH, { query });
    return result(I.UNKNOWN, { original: raw }, 0.1, false, 'invalid_search');
  }
  if (/^(open|visit|go to|launch)\s+/.test(value) && slots.url) {
    return result(I.OPEN_URL, { url: slots.url });
  }
  if (/^(open|launch|start)\s+/.test(value) && slots.appName) return result(I.OPEN_APP, { appName: slots.appName });
  if (slots.brightness !== undefined && /\b(brightness|screen)\b/.test(value)) return result(I.BRIGHTNESS_SET, { level: slots.brightness });
  if (/^(increase|raise|turn up)\s+(the\s+)?volume$/.test(value)) return result(I.VOLUME_UP);
  if (/^(decrease|lower|turn down)\s+(the\s+)?volume$/.test(value)) return result(I.VOLUME_DOWN);
  if (slots.volume !== undefined && /\b(set|change|adjust)\b/.test(value) || slots.volume !== undefined && /\b(volume|sound)\b/.test(value)) {
    return result(I.VOLUME_SET, { level: slots.volume });
  }
  if (/^(set|start)\s+(a\s+)?timer\b|^timer\b/.test(value) && slots.durationSeconds) {
    return result(I.TIMER, { seconds: slots.durationSeconds });
  }
  if (/^(call|phone)\s+/.test(value)) {
    const target = raw.replace(/^(call|phone)\s+/i, '').trim();
    if (target) {
      const digits = target.replace(/\D/g, '');
      const numericTarget = /^[+0-9().\-\s]+$/.test(target) && digits.length >= 3 && digits.length <= 18;
      const phoneNumber = numericTarget ? target.replace(/[().\-\s]/g, '') : undefined;
      return result(I.PREPARE_CALL, { target: target.slice(0, 160), ...(phoneNumber ? { phoneNumber } : {}) }, 0.9, true);
    }
  }
  if (/^(text|message|sms)\s+/.test(value)) {
    const request = raw.replace(/^(text|message|sms)\s+/i, '').trim();
    if (request) {
      const match = request.match(/^(\+?\d[\d().\-]{2,23})\s+([\s\S]+)$/);
      const recipient = match?.[1]?.replace(/[().\-]/g, '');
      const message = match?.[2]?.trim().slice(0, 300);
      return result(I.PREPARE_TEXT, { request: request.slice(0, 340), ...(recipient && message ? { recipient, message, formatValid: true } : { formatValid: false }) }, 0.9, true);
    }
  }
  if (context.lastIntent === I.OPEN_APP && slots.appName) return result(I.OPEN_APP, { appName: slots.appName });
  return result(I.UNKNOWN, { original: raw.slice(0, 500) }, 0.15, false, 'unsupported');
}
