import { sanitizeCustomCommands } from './customCommands.js';
const SETTINGS_KEY = 'aero.jarvis.settings.v1';
const HISTORY_KEY = 'aero.jarvis.history.v1';
const CUSTOM_COMMANDS_KEY = 'aero.jarvis.customCommands.v1';
const MAX_HISTORY = 50;
const LANGUAGES = new Set(['auto', 'en-US', 'en-GB', 'ur-PK', 'hi-IN', 'es-ES', 'fr-FR', 'de-DE']);
const VOICE_STYLES = new Set(['tactical', 'natural']);

export const DEFAULT_SETTINGS = Object.freeze({
  saveHistory: false,
  voiceLanguage: 'auto',
  voiceStyle: 'tactical',
  voiceResponses: false
});

function sanitizeSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_SETTINGS };
  return {
    saveHistory: value.saveHistory === true,
    voiceLanguage: LANGUAGES.has(value.voiceLanguage) ? value.voiceLanguage : DEFAULT_SETTINGS.voiceLanguage,
    voiceStyle: VOICE_STYLES.has(value.voiceStyle) ? value.voiceStyle : DEFAULT_SETTINGS.voiceStyle,
    voiceResponses: value.voiceResponses === true
  };
}

function sanitizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_HISTORY).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const command = typeof item.command === 'string' ? item.command.trim().slice(0, 500) : '';
    const intent = typeof item.intent === 'string' ? item.intent.slice(0, 80) : 'unknown';
    const time = typeof item.time === 'string' ? item.time.slice(0, 40) : '';
    if (!command) return [];
    return [{ command, intent, time }];
  });
}

function parseJson(raw, fallback) {
  if (typeof raw !== 'string' || !raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

/** Storage-neutral repository; injected adapters make the data rules testable offline. */
export function createLocalRepository(storage) {
  if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
    throw new TypeError('A storage adapter with get and set methods is required.');
  }
  return {
    async loadSettings() {
      return sanitizeSettings(parseJson(await storage.get(SETTINGS_KEY), null));
    },
    async saveSettings(value) {
      const clean = sanitizeSettings(value);
      await storage.set(SETTINGS_KEY, JSON.stringify(clean));
      return clean;
    },
    async loadHistory() {
      return sanitizeHistory(parseJson(await storage.get(HISTORY_KEY), []));
    },
    async saveHistory(value) {
      const clean = sanitizeHistory(value);
      await storage.set(HISTORY_KEY, JSON.stringify(clean));
      return clean;
    },
    async clearHistory() {
      if (typeof storage.remove === 'function') await storage.remove(HISTORY_KEY);
      else await storage.set(HISTORY_KEY, '[]');
    },
    async loadCustomCommands() {
      const raw = parseJson(await storage.get(CUSTOM_COMMANDS_KEY), []);
      return sanitizeCustomCommands(raw);
    },
    async saveCustomCommands(value) {
      const clean = sanitizeCustomCommands(value);
      await storage.set(CUSTOM_COMMANDS_KEY, JSON.stringify(clean));
      return clean;
    },
    async clearCustomCommands() {
      if (typeof storage.remove === 'function') await storage.remove(CUSTOM_COMMANDS_KEY);
      else await storage.set(CUSTOM_COMMANDS_KEY, '[]');
    }
  };
}

async function getStorageAdapter() {
  // Prefer the Capacitor Preferences plugin on an installed Android app.
  if (globalThis.Capacitor?.isNativePlatform?.()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      return {
        async get(key) { return (await Preferences.get({ key })).value; },
        async set(key, value) { await Preferences.set({ key, value }); },
        async remove(key) { await Preferences.remove({ key }); }
      };
    } catch { /* Fall through to browser storage if the native plugin is missing. */ }
  }
  return {
    async get(key) { try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; } },
    async set(key, value) {
      try {
        if (!globalThis.localStorage) throw new Error('Storage is unavailable');
        globalThis.localStorage.setItem(key, value);
      } catch { throw new Error('Local storage is unavailable in this browser.'); }
    },
    async remove(key) { try { globalThis.localStorage?.removeItem(key); } catch { /* best effort */ } }
  };
}

let repositoryPromise;
async function repository() {
  if (!repositoryPromise) repositoryPromise = getStorageAdapter().then(createLocalRepository);
  return repositoryPromise;
}

export const localRepository = {
  async loadSettings() { return (await repository()).loadSettings(); },
  async saveSettings(value) { return (await repository()).saveSettings(value); },
  async loadHistory() { return (await repository()).loadHistory(); },
  async saveHistory(value) { return (await repository()).saveHistory(value); },
  async clearHistory() { return (await repository()).clearHistory(); },
  async loadCustomCommands() { return (await repository()).loadCustomCommands(); },
  async saveCustomCommands(value) { return (await repository()).saveCustomCommands(value); },
  async clearCustomCommands() { return (await repository()).clearCustomCommands(); }
};
