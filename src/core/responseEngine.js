import { INTENTS as I } from './intentRegistry.js';

const RESPONSES = {
  ur: {
    [I.HELP]: 'میں معاون ایپس کھول سکتا ہوں، ویب پر تلاش کر سکتا ہوں، میڈیا والیوم اور اسکرین کی روشنی بدل سکتا ہوں، اور ٹائمر بنا سکتا ہوں۔ کال یا پیغام کے لیے آپ کی تصدیق ضروری ہے۔',
    [I.OPEN_APP]: '{app} کھول رہا ہوں۔',
    [I.WEB_SEARCH]: '{query} کے لیے ویب پر تلاش کر رہا ہوں۔',
    [I.OPEN_URL]: 'لنک کھول رہا ہوں۔',
    [I.VOLUME_SET]: 'میڈیا والیوم {level} فیصد پر سیٹ کر رہا ہوں۔',
    [I.VOLUME_UP]: 'میڈیا والیوم بڑھا رہا ہوں۔',
    [I.VOLUME_DOWN]: 'میڈیا والیوم کم کر رہا ہوں۔',
    [I.BRIGHTNESS_SET]: 'اسکرین کی روشنی {level} فیصد پر سیٹ کر رہا ہوں۔',
    [I.SETTINGS]: 'اینڈرائیڈ سیٹنگز کھول رہا ہوں۔',
    [I.TIMER]: '{seconds} سیکنڈ کا ٹائمر تیار کر رہا ہوں۔',
    [I.PREPARE_CALL]: 'کال کے لیے ڈائلر کھولنے سے پہلے آپ کی تصدیق درکار ہے۔',
    [I.PREPARE_TEXT]: 'پیغام صرف آپ کی تصدیق کے بعد تیار ہوگا۔',
    [I.STOP_LISTENING]: 'وائس ان پٹ بند کر رہا ہوں۔',
    default: 'یہ مقامی کمانڈ ابھی دستیاب نہیں۔ مدد کہیں یا کوئی واضح کمانڈ بولیں۔'
  },
  hi: {
    [I.HELP]: 'मैं समर्थित ऐप खोल सकता हूँ, वेब पर खोज सकता हूँ, मीडिया वॉल्यूम और स्क्रीन की चमक बदल सकता हूँ, और टाइमर शुरू कर सकता हूँ। कॉल और संदेश के लिए आपकी पुष्टि ज़रूरी है।',
    [I.OPEN_APP]: '{app} खोल रहा हूँ।',
    [I.WEB_SEARCH]: '{query} के लिए वेब पर खोज रहा हूँ।',
    [I.OPEN_URL]: 'लिंक खोल रहा हूँ।',
    [I.VOLUME_SET]: 'मीडिया वॉल्यूम {level} प्रतिशत पर सेट कर रहा हूँ।',
    [I.VOLUME_UP]: 'मीडिया वॉल्यूम बढ़ा रहा हूँ।',
    [I.VOLUME_DOWN]: 'मीडिया वॉल्यूम कम कर रहा हूँ।',
    [I.BRIGHTNESS_SET]: 'स्क्रीन की चमक {level} प्रतिशत पर सेट कर रहा हूँ।',
    [I.SETTINGS]: 'Android सेटिंग्स खोल रहा हूँ।',
    [I.TIMER]: '{seconds} सेकंड का टाइमर तैयार कर रहा हूँ।',
    [I.PREPARE_CALL]: 'कॉल के लिए डायलर खोलने से पहले आपकी पुष्टि चाहिए।',
    [I.PREPARE_TEXT]: 'संदेश आपकी पुष्टि के बाद ही तैयार होगा।',
    [I.STOP_LISTENING]: 'वॉइस इनपुट बंद कर रहा हूँ।',
    default: 'यह स्थानीय कमांड अभी उपलब्ध नहीं है। मदद कहें या कमांड स्पष्ट रूप से बोलें।'
  },
  es: {
    [I.HELP]: 'Puedo abrir aplicaciones compatibles, buscar en la web, ajustar el volumen y el brillo, e iniciar temporizadores. Las llamadas y los mensajes requieren tu confirmación.',
    [I.OPEN_APP]: 'Abriendo {app}.',
    [I.WEB_SEARCH]: 'Buscando {query} en la web.',
    [I.OPEN_URL]: 'Abriendo el enlace.',
    [I.VOLUME_SET]: 'Ajustando el volumen multimedia al {level} por ciento.',
    [I.VOLUME_UP]: 'Subiendo el volumen multimedia.',
    [I.VOLUME_DOWN]: 'Bajando el volumen multimedia.',
    [I.BRIGHTNESS_SET]: 'Ajustando el brillo de pantalla al {level} por ciento.',
    [I.SETTINGS]: 'Abriendo los ajustes de Android.',
    [I.TIMER]: 'Preparando un temporizador de {seconds} segundos.',
    [I.PREPARE_CALL]: 'Necesito tu confirmación antes de abrir el marcador.',
    [I.PREPARE_TEXT]: 'El borrador del mensaje solo se abrirá después de tu confirmación.',
    [I.STOP_LISTENING]: 'Deteniendo la escucha por voz.',
    default: 'Todavía no tengo un comando local para eso. Di ayuda o formula una orden compatible.'
  },
  fr: {
    [I.HELP]: 'Je peux ouvrir des applications prises en charge, rechercher sur le Web, régler le volume et la luminosité, et lancer des minuteurs. Les appels et messages exigent votre confirmation.',
    [I.OPEN_APP]: 'Ouverture de {app}.',
    [I.WEB_SEARCH]: 'Recherche de {query} sur le Web.',
    [I.OPEN_URL]: 'Ouverture du lien.',
    [I.VOLUME_SET]: 'Réglage du volume multimédia à {level} pour cent.',
    [I.VOLUME_UP]: 'Augmentation du volume multimédia.',
    [I.VOLUME_DOWN]: 'Diminution du volume multimédia.',
    [I.BRIGHTNESS_SET]: 'Réglage de la luminosité à {level} pour cent.',
    [I.SETTINGS]: 'Ouverture des paramètres Android.',
    [I.TIMER]: 'Préparation d’un minuteur de {seconds} secondes.',
    [I.PREPARE_CALL]: 'Votre confirmation est requise avant d’ouvrir le composeur.',
    [I.PREPARE_TEXT]: 'Le brouillon du message ne sera ouvert qu’après confirmation.',
    [I.STOP_LISTENING]: 'Arrêt de la commande vocale.',
    default: 'Cette commande locale n’est pas disponible. Dites aide ou reformulez la commande.'
  },
  de: {
    [I.HELP]: 'Ich kann unterstützte Apps öffnen, im Web suchen, Medienlautstärke und Helligkeit ändern und Timer starten. Anrufe und Nachrichten brauchen deine Bestätigung.',
    [I.OPEN_APP]: 'Öffne {app}.',
    [I.WEB_SEARCH]: 'Suche im Web nach {query}.',
    [I.OPEN_URL]: 'Öffne den Link.',
    [I.VOLUME_SET]: 'Stelle die Medienlautstärke auf {level} Prozent.',
    [I.VOLUME_UP]: 'Erhöhe die Medienlautstärke.',
    [I.VOLUME_DOWN]: 'Verringere die Medienlautstärke.',
    [I.BRIGHTNESS_SET]: 'Stelle die Bildschirmhelligkeit auf {level} Prozent.',
    [I.SETTINGS]: 'Öffne die Android-Einstellungen.',
    [I.TIMER]: 'Bereite einen Timer für {seconds} Sekunden vor.',
    [I.PREPARE_CALL]: 'Vor dem Öffnen des Wählfelds ist deine Bestätigung nötig.',
    [I.PREPARE_TEXT]: 'Der Nachrichtenentwurf wird erst nach deiner Bestätigung geöffnet.',
    [I.STOP_LISTENING]: 'Sprachsteuerung wird beendet.',
    default: 'Dafür gibt es noch keinen lokalen Befehl. Sage Hilfe oder formuliere einen unterstützten Befehl.'
  }
};

function englishResponse(command) {
  switch (command.intent) {
    case I.HELP: return 'I can open supported apps, search the web, adjust media volume and screen brightness, start timers, and run your saved exact-phrase shortcuts. Calls and texts still require confirmation.';
    case I.OPEN_APP: return `I'll try to open ${command.parameters.appName}.`;
    case I.WEB_SEARCH: return `Searching the web for ${command.parameters.query}.`;
    case I.OPEN_URL: return `Opening ${command.parameters.url}.`;
    case I.VOLUME_SET: return `Setting media volume to ${command.parameters.level} percent.`;
    case I.VOLUME_UP: return 'Increasing media volume.';
    case I.VOLUME_DOWN: return 'Decreasing media volume.';
    case I.BRIGHTNESS_SET: return `Setting screen brightness to ${command.parameters.level} percent. Android may ask for the separate Modify system settings permission first.`;
    case I.SETTINGS: return 'Opening Android settings.';
    case I.TIMER: return `Preparing a ${command.parameters.seconds}-second timer.`;
    case I.PREPARE_CALL: return 'I will prepare the call for your confirmation.';
    case I.PREPARE_TEXT: return 'I will prepare a message for your confirmation.';
    case I.STOP_LISTENING: return 'Stopping voice listening.';
    default: return 'I do not have an offline command for that yet. Try “help” or type a more specific command.';
  }
}

function fill(template, parameters) {
  return template.replace(/\{(app|query|url|level|seconds)\}/gu, (_, key) => {
    const values = { app: parameters.appName, query: parameters.query, url: parameters.url, level: parameters.level, seconds: parameters.seconds };
    return String(values[key] ?? '');
  });
}

export function getResponse(command, languageTag = 'en-US') {
  const language = String(languageTag || 'en-US').split(/[-_]/u)[0].toLowerCase();
  const dictionary = RESPONSES[language];
  if (!dictionary) return englishResponse(command);
  const template = dictionary[command.intent] || dictionary.default;
  return fill(template, command.parameters || {});
}
