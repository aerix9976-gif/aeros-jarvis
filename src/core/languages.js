const SPEECH_LOCALES = Object.freeze({
  en: 'en-US',
  ur: 'ur-PK',
  hi: 'hi-IN',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE'
});

/** Convert detected BCP-47 tags to one of the locales supported by our current reply dictionaries/TTS bridge. */
export function resolveResponseLocale(languageTag = 'en-US') {
  const value = String(languageTag || 'en-US').trim().replaceAll('_', '-');
  const base = value.split('-')[0].toLowerCase();
  if (base === 'en' && value.toLowerCase() === 'en-gb') return 'en-GB';
  return SPEECH_LOCALES[base] || 'en-US';
}

export function languageStatus(languageTag, autoDetected = false, autoMode = true) {
  const value = String(languageTag || '').trim();
  if (!value || value === 'auto') return 'Not detected yet';
  if (autoMode && autoDetected) return `Auto-detected: ${value}`;
  if (autoMode) return `Device/browser fallback: ${value}`;
  return `Selected locale: ${value}`;
}
