import { normalizeText } from './normalizeText.js';

const appAliases = [
  ['youtube', ['youtube', 'you tube']],
  ['chrome', ['chrome', 'browser']],
  ['settings', ['settings', 'phone settings']],
  ['camera', ['camera']],
  ['whatsapp', ['whatsapp', 'whats app']],
  ['phone', ['phone', 'dialer']],
  ['messages', ['messages', 'sms']],
  ['spotify', ['spotify']],
  ['files', ['files', 'file manager']],
  ['calculator', ['calculator', 'calc']]
];

function findApp(clean) {
  const matches = [];
  for (const [appName, aliases] of appAliases) {
    for (const alias of aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const match = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`, 'u').exec(clean);
      if (match) matches.push({ appName, index: match.index + match[1].length, length: alias.length });
    }
  }
  matches.sort((a, b) => a.index - b.index || b.length - a.length);
  return matches[0]?.appName;
}

export function extractSlots(text = '') {
  const raw = String(text);
  const clean = normalizeText(raw);
  const appName = findApp(clean);
  const urlMatch = raw.match(/(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d{1,5})?(?:\/[^\s]*)?/i);
  const timerMatch = clean.match(/(?:timer\s*(?:(?:for|in)\s+)?|(?:in|for)\s+)(\d{1,4})\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/);
  let durationSeconds;
  if (timerMatch) {
    const amount = Number(timerMatch[1]);
    const unit = timerMatch[2];
    const multiplier = /^h/.test(unit) ? 3600 : /^m/.test(unit) ? 60 : 1;
    const seconds = amount * multiplier;
    if (Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 86400) durationSeconds = seconds;
  }
  const volumeMatch = clean.match(/(?:volume|sound)(?:\s+to)?\s+(\d{1,3})(?:\s+percent)?\b/);
  const brightnessMatch = clean.match(/(?:brightness|screen brightness)(?:\s+to)?\s+(\d{1,3})(?:\s+percent)?\b/);
  return {
    ...(appName ? { appName } : {}),
    ...(urlMatch ? { url: urlMatch[0] } : {}),
    ...(durationSeconds ? { durationSeconds } : {}),
    ...(volumeMatch && Number(volumeMatch[1]) <= 100 ? { volume: Number(volumeMatch[1]) } : {}),
    ...(brightnessMatch && Number(brightnessMatch[1]) <= 100 ? { brightness: Number(brightnessMatch[1]) } : {})
  };
}
