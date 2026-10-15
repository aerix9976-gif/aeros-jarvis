import { normalizeText } from './normalizeText.js';

export const CUSTOM_ACTIONS = Object.freeze({
  OPEN_APP: 'open_app',
  OPEN_SETTINGS: 'settings',
  VOLUME_UP: 'volume_up',
  VOLUME_DOWN: 'volume_down',
  SET_VOLUME: 'volume_set',
  SET_BRIGHTNESS: 'brightness_set',
  OPEN_URL: 'open_url',
  WEB_SEARCH: 'web_search',
  TIMER: 'timer'
});

const ACTIONS = new Set(Object.values(CUSTOM_ACTIONS));
const APPS = new Set(['youtube', 'chrome', 'camera', 'whatsapp', 'phone', 'messages', 'spotify', 'files', 'calculator']);
const MAX_COMMANDS = 30;

function safeUrl(value) {
  try {
    const raw = String(value || '').trim();
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function normalizeCustomCommand(command, index = 0) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) return null;
  const phrase = String(command.phrase || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const trigger = normalizeText(phrase);
  const action = String(command.action || '');
  const id = /^[a-zA-Z0-9_-]{1,48}$/.test(String(command.id || '')) ? String(command.id) : `custom-${index}`;
  if (trigger.length < 2 || !ACTIONS.has(action)) return null;
  const result = { id, phrase, trigger, action };
  const rawValue = String(command.value ?? '').trim();
  if (action === CUSTOM_ACTIONS.OPEN_APP) {
    const app = normalizeText(rawValue);
    if (!APPS.has(app)) return null;
    result.value = app;
  } else if (action === CUSTOM_ACTIONS.SET_VOLUME || action === CUSTOM_ACTIONS.SET_BRIGHTNESS) {
    if (!/^\d{1,3}$/.test(rawValue)) return null;
    const level = Number(rawValue);
    if (!Number.isInteger(level) || level < 0 || level > 100) return null;
    result.value = String(level);
  } else if (action === CUSTOM_ACTIONS.OPEN_URL) {
    const url = safeUrl(rawValue);
    if (!url) return null;
    result.value = url;
  } else if (action === CUSTOM_ACTIONS.WEB_SEARCH) {
    if (!rawValue || rawValue.length > 180) return null;
    result.value = rawValue;
  } else if (action === CUSTOM_ACTIONS.TIMER) {
    if (!/^\d{1,5}$/.test(rawValue)) return null;
    const seconds = Number(rawValue);
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 86400) return null;
    result.value = String(seconds);
  } else if (rawValue) {
    // Actions without parameters intentionally discard the supplied value.
  }
  return result;
}

export function sanitizeCustomCommands(commands) {
  if (!Array.isArray(commands)) return [];
  const clean = [];
  const triggers = new Set();
  for (const [index, raw] of commands.slice(0, MAX_COMMANDS * 2).entries()) {
    const command = normalizeCustomCommand(raw, index);
    if (!command || triggers.has(command.trigger) || clean.some(item => item.id === command.id)) continue;
    triggers.add(command.trigger);
    clean.push(command);
    if (clean.length >= MAX_COMMANDS) break;
  }
  return clean;
}

export function routeCustomCommand(text, commands = []) {
  const trigger = normalizeText(text);
  if (!trigger) return null;
  const command = sanitizeCustomCommands(commands).find(item => item.trigger === trigger);
  if (!command) return null;
  const parameter = command.value;
  switch (command.action) {
    case CUSTOM_ACTIONS.OPEN_APP: return { intent: 'open_app', parameters: { appName: parameter }, confidence: 1, requiresConfirmation: false, customCommandId: command.id };
    case CUSTOM_ACTIONS.OPEN_SETTINGS: return { intent: 'settings', parameters: { section: 'general' }, confidence: 1, requiresConfirmation: false, customCommandId: command.id };
    case CUSTOM_ACTIONS.VOLUME_UP: return { intent: 'volume_up', parameters: {}, confidence: 1, requiresConfirmation: false, customCommandId: command.id };
    case CUSTOM_ACTIONS.VOLUME_DOWN: return { intent: 'volume_down', parameters: {}, confidence: 1, requiresConfirmation: false, customCommandId: command.id };
    case CUSTOM_ACTIONS.SET_VOLUME: return { intent: 'volume_set', parameters: { level: Number(parameter) }, confidence: 1, requiresConfirmation: false, customCommandId: command.id };
    case CUSTOM_ACTIONS.SET_BRIGHTNESS: return { intent: 'brightness_set', parameters: { level: Number(parameter) }, confidence: 1, requiresConfirmation: false, customCommandId: command.id };
    case CUSTOM_ACTIONS.OPEN_URL: return { intent: 'open_url', parameters: { url: parameter }, confidence: 1, requiresConfirmation: false, customCommandId: command.id };
    case CUSTOM_ACTIONS.WEB_SEARCH: return { intent: 'web_search', parameters: { query: parameter }, confidence: 1, requiresConfirmation: false, customCommandId: command.id };
    case CUSTOM_ACTIONS.TIMER: return { intent: 'timer', parameters: { seconds: Number(parameter) }, confidence: 1, requiresConfirmation: false, customCommandId: command.id };
    default: return null;
  }
}
