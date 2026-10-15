import { normalizeText } from './normalizeText.js';

// Intentionally translates a small, explicit command vocabulary—not arbitrary text.
// Unknown phrases remain unknown and can never become executable code.
const EXACT_COMMANDS = new Map();
const add = (command, phrases) => phrases.forEach(phrase => EXACT_COMMANDS.set(normalizeText(phrase), command));

add('help', [
  'madad', 'madad karo', 'مدد', 'مدد کرو', 'مدد کریں', 'मदद', 'मदद करो', 'सहायता',
  'ayuda', 'ayúdame', 'aide', 'aidez-moi', 'hilfe'
]);
add('stop listening', [
  'sunna band karo', 'sunna band kar do', 'awaz sunna band karo', 'سننا بند کرو', 'سننا بند کریں',
  'सुनना बंद करो', 'सुनना बंद करें', 'deja de escuchar', 'deja de oír', 'arrete decouter',
  'arrête d’écouter', 'arrête découter', 'hör auf zuzuhören', 'zuhoeren stoppen'
]);
add('open YouTube', [
  'youtube kholo', 'youtube khol do', 'youtube chalao', 'یوٹیوب کھولو', 'یوٹیوب کھولیں', 'یوٹیوب چلاؤ',
  'यूट्यूब खोलो', 'यूट्यूब खोलें', 'abre youtube', 'abrir youtube', 'ouvre youtube', 'ouvrir youtube',
  'öffne youtube', 'youtube öffnen'
]);
add('open settings', [
  'settings kholo', 'settings khol do', 'سیٹنگز کھولو', 'سیٹنگ کھولو', 'ترتیبات کھولو',
  'सेटिंग्स खोलो', 'सेटिंग खोलो', 'abre ajustes', 'abrir ajustes', 'abre configuración',
  'ouvre les paramètres', 'ouvre paramètres', 'öffne einstellungen', 'einstellungen öffnen'
]);
add('open camera', ['camera kholo', 'کیمرہ کھولو', 'कैमरा खोलो', 'abre la cámara', 'ouvre la caméra', 'öffne die kamera']);
add('open Chrome', ['chrome kholo', 'کروم کھولو', 'क्रोम खोलो', 'abre chrome', 'ouvre chrome', 'öffne chrome']);
add('increase volume', [
  'volume barhao', 'awaz barhao', 'آواز بڑھاؤ', 'آواز بڑھائیں', 'والیوم بڑھاؤ', 'آواز اونچی کرو',
  'आवाज़ बढ़ाओ', 'वॉल्यूम बढ़ाओ', 'sube el volumen', 'aumenta el volumen', 'augmente le volume',
  'monte le volume', 'lautstärke erhöhen', 'erhöhe die lautstärke'
]);
add('decrease volume', [
  'volume kam karo', 'volume kum karo', 'awaz kam karo', 'آواز کم کرو', 'آواز کم کریں', 'والیوم کم کرو',
  'आवाज़ कम करो', 'वॉल्यूम कम करो', 'baja el volumen', 'disminuye el volumen', 'baisse le volume',
  'diminue le volume', 'lautstärke verringern', 'verringere die lautstärke'
]);

const VOLUME_SET_PATTERNS = [
  /^(?:volume|sound)\s+(?:ko\s+)?(\d{1,3})(?:\s*(?:percent|por ciento))?$/u,
  /^(?:set|pon|ajusta|establece)\s+(?:el\s+)?volumen\s+(?:a|en|al)?\s*(\d{1,3})(?:\s*por ciento)?$/u,
  /^(?:regle|règle|mets|met)\s+(?:le\s+)?volume\s+(?:à|a)?\s*(\d{1,3})(?:\s*pour cent)?$/u,
  /^(?:setze|stelle|ändere|aendere)\s+(?:die\s+)?lautstärke\s+(?:auf|zu)?\s*(\d{1,3})(?:\s*prozent)?$/u,
  /^(?:والیوم|آواز|آواز کا حجم)\s*(?:کو|پر|میں)?\s*(\d{1,3})(?:\s*فیصد)?$/u,
  /^(?:वॉल्यूम|आवाज़)\s*(?:को|पर)?\s*(\d{1,3})(?:\s*प्रतिशत)?$/u
];

const TIMER_PATTERNS = [
  { regex: /^(?:pon|inicia|configura)\s+(?:un\s+)?temporizador\s+(?:de\s+)?(\d{1,4})\s*(segundos?|minutos?|horas?)$/u, unit: { segundo: 'seconds', minuto: 'minutes', hora: 'hours' } },
  { regex: /^(?:mets|démarre|demarre|lance)\s+(?:un\s+)?minuteur\s+(?:de\s+)?(\d{1,4})\s*(secondes?|minutes?|heures?)$/u, unit: { seconde: 'seconds', minute: 'minutes', heure: 'hours' } },
  { regex: /^(?:stelle|starte)\s+(?:einen\s+)?timer\s+(?:auf|für|fur)?\s*(\d{1,4})\s*(sekunden?|minuten?|stunden?)$/u, unit: { sekunde: 'seconds', minute: 'minutes', stunde: 'hours' } }
];

export function translateLocalizedCommand(text = '') {
  const value = normalizeText(text);
  if (!value) return null;
  if (EXACT_COMMANDS.has(value)) return EXACT_COMMANDS.get(value);

  for (const regex of VOLUME_SET_PATTERNS) {
    const match = regex.exec(value);
    if (match) {
      const volume = Number(match[1]);
      if (Number.isInteger(volume) && volume >= 0 && volume <= 100) return `set volume to ${volume} percent`;
      return null;
    }
  }

  for (const { regex, unit } of TIMER_PATTERNS) {
    const match = regex.exec(value);
    if (!match) continue;
    const amount = Number(match[1]);
    const matchedUnit = match[2].replace(/s$/u, '');
    const unitKey = Object.keys(unit).find(key => matchedUnit.startsWith(key));
    const englishUnit = unitKey ? unit[unitKey] : null;
    if (!Number.isInteger(amount) || amount < 1 || amount > 1440 || !englishUnit) return null;
    return `set timer for ${amount} ${englishUnit}`;
  }

  // Roman Urdu timer phrasing, plus Urdu script with Arabic-Indic or regular digits.
  const romanUrduTimer = /^(\d{1,4})\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\s+(?:ka\s+)?timer\s+(?:lagao|laga do|set karo)$/u.exec(value);
  if (romanUrduTimer) return `set timer for ${romanUrduTimer[1]} ${romanUrduTimer[2]}`;
  const urduTimer = /^(?:timer|ٹائمر)\s*(\d{1,4})\s*(seconds?|minutes?|hours?|سیکنڈ|منٹ|منٹس|گھنٹے?)\s*(?:کے لیے|لگاؤ|لگا دو)?$/u.exec(value);
  if (urduTimer) {
    const amount = Number(urduTimer[1]);
    const rawUnit = urduTimer[2];
    const englishUnit = /^(?:seconds?|سیکنڈ)$/u.test(rawUnit) ? 'seconds' : /^(?:hours?|گھنٹے?)$/u.test(rawUnit) ? 'hours' : 'minutes';
    if (amount > 0 && amount <= 1440) return `set timer for ${amount} ${englishUnit}`;
  }

  return null;
}
