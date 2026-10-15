import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AudioLines, Command, Database, History, Home, Languages, Mic, MicOff, Settings2, ShieldCheck, Terminal, Trash2, Volume2, Zap } from 'lucide-react';
import { routeCommand } from './core/routeCommand.js';
import { INTENTS as I } from './core/intentRegistry.js';
import { getResponse } from './core/responseEngine.js';
import { runAction, getCapabilities, addNativeSpeechListeners, startNativeSpeechRecognition, stopNativeSpeechRecognition, startNativeWakeWordListening, stopNativeWakeWordListening, requestBrightnessPermission, openNotificationAccessSettings, speakResponse, stopSpeechOutput } from './native/jarvisBridge.js';
import { Capacitor } from '@capacitor/core';
import { DEFAULT_SETTINGS, localRepository } from './core/localRepository.js';
import { CUSTOM_ACTIONS, normalizeCustomCommand, routeCustomCommand, sanitizeCustomCommands } from './core/customCommands.js';
import { normalizeText } from './core/normalizeText.js';
import { languageStatus, resolveResponseLocale } from './core/languages.js';
const initialMessages = [{ role: 'system', text: 'Systems online. Local command core ready.', time: 'READY' }];
export default function App() {
  const [screen, setScreen] = useState('home');
  const [state, setState] = useState('STANDBY');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(initialMessages);
  const [capabilities, setCapabilities] = useState({ native: false, bridge: false, canWriteSystemSettings: false, wakeWordModelAvailable: false, wakeWordRunning: false, wakeWordTriggered: false, notificationAccessGranted: false, activeNotificationCount: 0, voice: 'tap-to-talk available in compatible browser', actions: ['local command routing'] });
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const nativeVoiceCleanupRef = useRef(null);
  const submitRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [customCommands, setCustomCommands] = useState([]);
  const [customPhrase, setCustomPhrase] = useState('');
  const [customAction, setCustomAction] = useState(CUSTOM_ACTIONS.OPEN_APP);
  const [customValue, setCustomValue] = useState('youtube');
  const [customError, setCustomError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [storageStatus, setStorageStatus] = useState('LOCAL SETTINGS');
  const [pendingAction, setPendingAction] = useState(null);
  const [wakeAccessKey, setWakeAccessKey] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState('Not detected yet');
  const detectedLanguageRef = useRef('');
  const [wakeMessage, setWakeMessage] = useState('Wake phrase unavailable until an Android-targeted keyword model is added and configured.');
  const currentSettingsRef = useRef(settings);
  const wakeHandlingRef = useRef(false);
  currentSettingsRef.current = settings;
  async function handleWakeWordDetected() {
    if (document.visibilityState !== 'visible') {
      setWakeMessage('Wake phrase detected. Open Aero from the notification, then tap the microphone to speak.');
      return;
    }
    if (wakeHandlingRef.current) return;
    wakeHandlingRef.current = true;
    setWakeMessage('Wake phrase detected. Wake listening paused; starting one command session.');
    setMessages(prev => [...prev, { role: 'system', text: 'Activate Aero AI detected. Wake listening has paused; tap-to-talk is starting.', time: 'WAKE' }]);
    try {
      await stopNativeWakeWordListening();
      const result = await startNativeSpeechRecognition(currentSettingsRef.current.voiceLanguage);
      if (!result?.ok) {
        setListening(false); setState('STANDBY');
        setMessages(prev => [...prev, { role: 'system', text: result?.message || 'Wake phrase detected, but tap-to-talk did not start. Tap the microphone to retry.', time: 'VOICE ERR' }]);
      } else {
        setListening(true); setState('LISTENING');
        if (result.message) setMessages(prev => [...prev, { role: 'system', text: result.message, time: result.processingMode === 'on-device' ? 'LOCAL VOICE' : 'VOICE INFO' }]);
      }
      const updated = await getCapabilities();
      setCapabilities(updated);
    } catch {
      setMessages(prev => [...prev, { role: 'system', text: 'Wake phrase detected, but voice hand-off failed. Tap the microphone to retry.', time: 'VOICE ERR' }]);
    } finally { wakeHandlingRef.current = false; }
  }
  async function startWakeWord() {
    const key = wakeAccessKey.trim();
    const result = await startNativeWakeWordListening(key);
    setWakeMessage(result.message || (result.ok ? 'Wake-word service requested.' : 'Wake-word service did not start.'));
    setMessages(prev => [...prev, { role: 'system', text: result.message || 'Wake-word service did not start.', time: result.ok ? 'WAKE' : 'WAKE ERR' }]);
    if (result.ok) setWakeAccessKey('');
    const updated = await getCapabilities();
    setCapabilities(updated);
  }
  async function stopWakeWord() {
    const result = await stopNativeWakeWordListening();
    setWakeMessage(result.message || 'Wake-word listening stopped.');
    setMessages(prev => [...prev, { role: 'system', text: result.message || 'Wake-word listening stopped.', time: result.ok ? 'WAKE OFF' : 'WAKE ERR' }]);
    const updated = await getCapabilities();
    setCapabilities(updated);
  }
  useEffect(() => {
    let mounted = true;
    const refreshCapabilities = () => getCapabilities().then(value => { if (mounted) setCapabilities(value); return value; }).catch(() => null);
    refreshCapabilities();
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      refreshCapabilities().then(value => { if (mounted && value?.wakeWordTriggered) handleWakeWordDetected(); });
    };
    document.addEventListener('visibilitychange', onVisibility);
    addNativeSpeechListeners({
      onResult: event => {
        setListening(false); setState('THINKING');
        const transcript = String(event?.transcript || '').slice(0, 500);
        const selectedLanguage = currentSettingsRef.current.voiceLanguage;
        const spokenLanguage = String(event?.language || detectedLanguageRef.current || selectedLanguage || 'auto');
        if (spokenLanguage && spokenLanguage !== 'auto') {
          detectedLanguageRef.current = spokenLanguage;
          setDetectedLanguage(languageStatus(spokenLanguage, event?.languageAutoDetected === true, selectedLanguage === 'auto'));
        }
        if (transcript) submitRef.current?.(transcript, spokenLanguage);
        else setMessages(prev => [...prev, { role: 'system', text: 'No speech was recognized. Type your command instead.', time: 'VOICE OFF' }]);
      },
      onLanguageDetected: event => {
        const language = String(event?.language || '').trim();
        if (language && language.length <= 35) { detectedLanguageRef.current = language; setDetectedLanguage(languageStatus(language, true, currentSettingsRef.current.voiceLanguage === 'auto')); }
      },
      onError: event => {
        setListening(false); setState('STANDBY');
        setMessages(prev => [...prev, { role: 'system', text: String(event?.message || 'Android speech recognition failed. Typed commands still work.'), time: 'VOICE ERR' }]);
      },
      onState: event => {
        if (event?.state === 'stopped') { setListening(false); setState('STANDBY'); }
        if (event?.state === 'listening' || event?.state === 'started') { setListening(true); setState('LISTENING'); }
        if (event?.state === 'processing') setState('THINKING');
      },
      onWakeWordDetected: () => { handleWakeWordDetected(); },
      onNotificationCountChanged: event => { setCapabilities(current => ({ ...current, activeNotificationCount: Number.isFinite(event?.count) ? Math.max(0, event.count) : current.activeNotificationCount })); },
      onWakeWordError: event => {
        setWakeMessage(String(event?.message || 'Wake-word engine failed to start. Check model and AccessKey.'));
        setCapabilities(current => ({ ...current, wakeWordRunning: false }));
        setMessages(prev => [...prev, { role: 'system', text: String(event?.message || 'Wake-word engine failed to start.'), time: 'WAKE ERR' }]);
      }
    }).then(cleanup => { if (mounted) nativeVoiceCleanupRef.current = cleanup; else cleanup(); }).catch(() => {});
    Promise.all([localRepository.loadSettings(), localRepository.loadHistory(), localRepository.loadCustomCommands()])
      .then(([savedSettings, savedHistory, savedCustomCommands]) => {
        if (!mounted) return;
        setSettings(savedSettings);
        setHistory(savedSettings.saveHistory ? savedHistory.slice(0, 20) : []);
        setCustomCommands(sanitizeCustomCommands(savedCustomCommands));
      })
      .catch(() => { if (mounted) setStorageStatus('STORAGE UNAVAILABLE'); })
      .finally(() => { if (mounted) setHydrated(true); });
    return () => { mounted = false; try { recognitionRef.current?.stop(); } catch {} try { stopNativeSpeechRecognition(); } catch {} try { nativeVoiceCleanupRef.current?.(); } catch {} };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        await localRepository.saveSettings(settings);
        if (settings.saveHistory) await localRepository.saveHistory(history);
        else await localRepository.clearHistory();
        if (!cancelled) setStorageStatus('SAVED ON THIS DEVICE');
      } catch {
        if (!cancelled) setStorageStatus('STORAGE UNAVAILABLE');
      }
    })();
    return () => { cancelled = true; };
  }, [settings, history, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    localRepository.saveCustomCommands(customCommands).catch(() => setStorageStatus('CUSTOM COMMAND STORAGE UNAVAILABLE'));
  }, [customCommands, hydrated]);
  const time = useMemo(() => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date()), [messages.length]);
  async function submit(text = input, recognizedLanguage = null) {
    const commandText = String(text ?? '').trim(); if (!commandText) return;
    setInput(''); setState('THINKING');
    const routed = routeCustomCommand(commandText, customCommands) || routeCommand(commandText);
    const candidateLanguage = String(recognizedLanguage || (settings.voiceLanguage === 'auto' ? detectedLanguageRef.current || navigator.language || 'en-US' : settings.voiceLanguage) || 'en-US');
    const baseLanguage = candidateLanguage.split(/[-_]/u)[0].toLowerCase();
    const responseLanguage = ['en', 'ur', 'hi', 'es', 'fr', 'de'].includes(baseLanguage) ? resolveResponseLocale(candidateLanguage) : 'en-US';
    const reply = getResponse(routed, responseLanguage);
    setMessages(prev => [...prev, { role: 'user', text: commandText, time }, { role: 'assistant', text: reply, time }]);
    if (settings.voiceResponses && routed.intent !== I.UNKNOWN) {
      const speechResult = await speakResponse(reply, responseLanguage, settings.voiceStyle);
      if (!speechResult?.ok) setMessages(prev => [...prev, { role: 'system', text: speechResult?.message || 'Voice response could not start. Check your installed system voice package.', time: 'VOICE ERR' }]);
    }
    const historyLabel = routed.intent === I.PREPARE_CALL ? 'call [details hidden]' : routed.intent === I.PREPARE_TEXT ? 'text [details hidden]' : commandText;
    setHistory(prev => [{ command: historyLabel, intent: routed.intent, time }, ...prev].slice(0, 20));
    if (routed.requiresConfirmation) {
      setPendingAction(routed);
      setMessages(prev => [...prev, { role: 'system', text: 'Action held for your review. Nothing has been called or sent.', time: 'SECURE' }]);
      setState('STANDBY'); return;
    }
    if (routed.intent === I.STOP_LISTENING) {
      try { recognitionRef.current?.stop(); } catch {}
      if (Capacitor.isNativePlatform()) {
        await Promise.all([
          stopNativeSpeechRecognition().catch(() => null),
          stopNativeWakeWordListening().catch(() => null)
        ]);
        try { setCapabilities(await getCapabilities()); } catch {}
      }
      stopSpeechOutput().catch(() => {});
      recognitionRef.current = null; setListening(false); setState('STANDBY');
      setMessages(prev => [...prev, { role: 'system', text: 'Tap-to-talk and wake-word listening stopped.', time: 'VOICE OFF' }]);
      return;
    }
    if (routed.intent !== 'unknown' && routed.intent !== 'help') {
      setState('EXECUTING');
      const result = await runAction(routed);
      if (result?.message) setMessages(prev => [...prev, { role: 'system', text: result.message, time: result.ok ? 'DONE' : 'LIMIT' }]);
    }
    setState('SPEAKING'); window.setTimeout(() => setState('STANDBY'), 900);
  }
  submitRef.current = submit;
  async function confirmPendingAction() {
    const action = pendingAction;
    if (!action) return;
    setPendingAction(null);
    setState('EXECUTING');
    const result = await runAction(action);
    if (result?.message) setMessages(prev => [...prev, { role: 'system', text: result.message, time: result.ok ? 'COMPOSER' : 'LIMIT' }]);
    setState('STANDBY');
  }
  async function voiceInput() {
    if (listening) {
      if (Capacitor.isNativePlatform()) {
        const result = await stopNativeSpeechRecognition();
        if (result?.message) setMessages(prev => [...prev, { role: 'system', text: result.message, time: result.ok ? 'VOICE OFF' : 'VOICE ERR' }]);
      }
      try { recognitionRef.current?.stop(); } catch {}
      setListening(false); setState('STANDBY'); return;
    }
    if (Capacitor.isNativePlatform()) {
      setListening(true); setState('LISTENING');
      const result = await startNativeSpeechRecognition(settings.voiceLanguage);
      if (!result?.ok) {
        setListening(false); setState('STANDBY');
        setMessages(prev => [...prev, { role: 'system', text: result?.message || 'Android voice input could not start. Type your command instead.', time: 'VOICE ERR' }]);
      } else if (result.message) {
        setMessages(prev => [...prev, { role: 'system', text: result.message, time: result.processingMode === 'on-device' ? 'LOCAL VOICE' : 'VOICE INFO' }]);
      }
      try { setCapabilities(await getCapabilities()); } catch {}
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setMessages(prev => [...prev, { role: 'system', text: 'Speech recognition is not available in this browser preview. Use the installed Android app for native tap-to-talk, or type a command here.', time: 'VOICE OFF' }]); return; }
    const rec = new Recognition(); recognitionRef.current = rec;
    const browserLanguage = settings.voiceLanguage === 'auto' ? (navigator.language || 'en-US') : settings.voiceLanguage;
    rec.lang = browserLanguage; rec.interimResults = false; rec.maxAlternatives = 1;
    detectedLanguageRef.current = browserLanguage;
    setDetectedLanguage(languageStatus(browserLanguage, false, settings.voiceLanguage === 'auto'));
    rec.onstart = () => { setListening(true); setState('LISTENING'); };
    rec.onresult = e => submit(e.results[0][0].transcript, browserLanguage);
    rec.onerror = () => setMessages(prev => [...prev, { role: 'system', text: 'Voice input failed or was denied. Typed commands still work.', time: 'VOICE ERR' }]);
    rec.onend = () => { if (recognitionRef.current === rec) recognitionRef.current = null; setListening(false); setState('STANDBY'); };
    try { rec.start(); } catch { recognitionRef.current = null; setListening(false); setState('STANDBY'); setMessages(prev => [...prev, { role: 'system', text: 'Voice input could not start. Type your command instead.', time: 'VOICE ERR' }]); }
  }
  function addCustomCommand(event) {
    event?.preventDefault?.();
    const candidate = normalizeCustomCommand({
      id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      phrase: customPhrase,
      action: customAction,
      value: customValue
    }, customCommands.length);
    if (!candidate) {
      setCustomError('That command is invalid. Check the phrase and the selected action value.');
      return;
    }
    if (customCommands.some(item => normalizeText(item.phrase) === candidate.trigger)) {
      setCustomError('That trigger phrase already exists. Use a different exact phrase.');
      return;
    }
    if (customCommands.length >= 30) {
      setCustomError('You can save up to 30 custom commands. Delete one before adding another.');
      return;
    }
    setCustomCommands(current => sanitizeCustomCommands([...current, candidate]));
    setCustomPhrase('');
    setCustomError('');
  }

  const customActionNeedsValue = [CUSTOM_ACTIONS.OPEN_APP, CUSTOM_ACTIONS.SET_VOLUME, CUSTOM_ACTIONS.SET_BRIGHTNESS, CUSTOM_ACTIONS.OPEN_URL, CUSTOM_ACTIONS.WEB_SEARCH, CUSTOM_ACTIONS.TIMER].includes(customAction);
  const customActionLabels = {
    [CUSTOM_ACTIONS.OPEN_APP]: 'Open an allow-listed app',
    [CUSTOM_ACTIONS.OPEN_SETTINGS]: 'Open Android Settings',
    [CUSTOM_ACTIONS.VOLUME_UP]: 'Increase media volume',
    [CUSTOM_ACTIONS.VOLUME_DOWN]: 'Decrease media volume',
    [CUSTOM_ACTIONS.SET_VOLUME]: 'Set media volume',
    [CUSTOM_ACTIONS.SET_BRIGHTNESS]: 'Set screen brightness',
    [CUSTOM_ACTIONS.OPEN_URL]: 'Open a web URL',
    [CUSTOM_ACTIONS.WEB_SEARCH]: 'Search the web',
    [CUSTOM_ACTIONS.TIMER]: 'Open a Clock timer'
  };
  function customActionValueControl() {
    if (!customActionNeedsValue) return null;
    if (customAction === CUSTOM_ACTIONS.OPEN_APP) return <select className="config-select full-select" aria-label="App for custom command" value={customValue} onChange={e=>setCustomValue(e.target.value)}><option value="youtube">YouTube</option><option value="chrome">Chrome</option><option value="camera">Camera</option><option value="whatsapp">WhatsApp</option><option value="phone">Phone dialer</option><option value="messages">Messages</option><option value="spotify">Spotify</option><option value="files">Files</option><option value="calculator">Calculator</option></select>;
    if (customAction === CUSTOM_ACTIONS.SET_VOLUME || customAction === CUSTOM_ACTIONS.SET_BRIGHTNESS) return <input className="custom-input" type="number" min="0" max="100" value={customValue} onChange={e=>setCustomValue(e.target.value)} aria-label="Percentage" placeholder="0–100 percent"/>;
    if (customAction === CUSTOM_ACTIONS.TIMER) return <input className="custom-input" type="number" min="1" max="86400" value={customValue} onChange={e=>setCustomValue(e.target.value)} aria-label="Timer duration in seconds" placeholder="Seconds, max 86400"/>;
    if (customAction === CUSTOM_ACTIONS.OPEN_URL) return <input className="custom-input" value={customValue} onChange={e=>setCustomValue(e.target.value)} aria-label="URL for custom command" placeholder="https://example.com"/>;
    if (customAction === CUSTOM_ACTIONS.WEB_SEARCH) return <input className="custom-input" value={customValue} onChange={e=>setCustomValue(e.target.value)} aria-label="Search query for custom command" placeholder="Search phrase"/>;
    return null;
  }

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark"><Zap size={17} fill="currentColor" /></div><div><div className="brand-title">AERO<span> / JARVIS</span></div><div className="brand-sub">PERSONAL INTELLIGENCE SYSTEM</div></div><div className="top-right"><span className="live-dot"/> SENTINEL CORE <span className="version">v0.7</span></div></header>
    <section className="content">
      <div className="eyebrow"><span>SYS // 01</span><span>SECURE LOCAL SESSION</span><span>{time}</span></div>
      {pendingAction && <section className="confirmation-card" aria-live="polite"><div className="section-title"><span><ShieldCheck size={14}/> ACTION REVIEW</span><span>CONFIRM FIRST</span></div>
        {pendingAction.intent === I.PREPARE_CALL ? <><p className="confirm-title">Review call request</p><p className="confirm-body">Target: <b>{pendingAction.parameters.target}</b></p><p className="confirm-note">Aero will only open the Android dialer. You must review the number and place the call yourself. {pendingAction.parameters.phoneNumber ? '' : 'Contact-name lookup is unavailable; enter a phone number to continue.'}</p></> : <><p className="confirm-title">Review message draft</p><p className="confirm-body">Recipient: <b>{pendingAction.parameters.recipient || 'Not detected'}</b></p><p className="confirm-body">Message: {pendingAction.parameters.message || 'Not detected'}</p><p className="confirm-note">Aero will open the SMS composer only. Nothing is sent automatically. Use: text +15551234567 your message.</p></>}
        <div className="confirm-actions"><button className="cancel-confirm" onClick={()=>setPendingAction(null)}>CANCEL</button><button className="accept-confirm" disabled={pendingAction.intent === I.PREPARE_CALL ? !pendingAction.parameters.phoneNumber : !pendingAction.parameters.formatValid} onClick={confirmPendingAction}>{pendingAction.intent === I.PREPARE_CALL ? 'OPEN DIALER' : 'OPEN MESSAGE DRAFT'}</button></div>
      </section>}
      {screen === 'home' && <>
        <div className="hero-heading"><div><p className="overline">AUTONOMOUS. PRECISE. AWAKE.</p><h1>Core<br/><em>online.</em></h1></div><div className="system-pill"><span className="live-dot"/> SENTINEL ONLINE</div></div>
        <section className={`reactor-panel state-${state.toLowerCase()}`} aria-label={`Assistant state ${state}`}>
          <div className="reactor-top"><span><Activity size={13}/> CORE STATUS</span><span className="state-label">{state}</span></div>
          <div className="reactor-stage"><div className="orbit orbit-outer"/><div className="orbit orbit-mid"/><div className="orbit orbit-inner"/><div className="crosshair cross-a"/><div className="crosshair cross-b"/><div className="core-glow"/><div className="core"><span>AE</span><small>SNTL / 01</small></div><div className="orbit-dot dot-one"/><div className="orbit-dot dot-two"/><div className="orbit-dot dot-three"/></div>
          <div className="reactor-bottom"><span>SENTINEL CORE <b>LOCAL</b></span><div className="bars" aria-hidden="true">{Array.from({length:22},(_,i)=><i key={i} style={{'--i':i}}/>)}</div><span>LATENCY <b>— MS</b></span></div>
        </section>
        <div className="quick-grid"><button onClick={() => submit('help')}><Command/><span>COMMANDS</span><small>Available actions</small></button><button onClick={() => setScreen('permissions')}><ShieldCheck/><span>PERMISSIONS</span><small>Device access</small></button><button onClick={() => setScreen('history')}><History/><span>ACTIVITY LOG</span><small>{history.length} recent actions</small></button></div>
        <section className="console-card"><div className="section-title"><span><Terminal size={14}/> COMMAND CONSOLE</span><span className="console-status">INPUT READY</span></div><div className="command-line"><span className="prompt">›</span><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="Try: open YouTube, set volume 35…" aria-label="Enter command"/><button className="mic-button" onClick={voiceInput} aria-label={listening?'Stop voice input':'Start voice input'}>{listening?<MicOff size={17}/>:<Mic size={17}/>}</button><button className="send-button" onClick={()=>submit()} aria-label="Execute command"><AudioLines size={17}/></button></div><div className="command-hint"><span>LOCAL INTENT ENGINE</span><span>NO API KEY REQUIRED</span></div></section>
        <section className="feed"><div className="section-title"><span><Activity size={14}/> SESSION STREAM</span><span>{messages.length.toString().padStart(2,'0')} EVENTS</span></div>{messages.slice(-4).map((m,i)=><div className={`feed-row ${m.role}`} key={i}><span className="feed-tag">{m.role==='user'?'YOU':m.role==='assistant'?'AERO':m.time}</span><p>{m.text}</p><time>{m.time}</time></div>)}</section>
      </>}
      {screen === 'permissions' && <section className="page-card"><p className="overline">ACCESS CONTROL / 02</p><h1>Permission<br/><em>center.</em></h1><p className="page-desc">Aero only uses capabilities granted by Android. Device controls require the installed app and a working native bridge.</p><div className="permission-row"><ShieldCheck/><div><b>Native Android bridge</b><small>{capabilities.bridge?'Connected':'Not connected in this build'}</small></div><span className="badge">{capabilities.bridge?'READY':'PENDING'}</span></div><div className="permission-row"><Mic/><div><b>Microphone / tap-to-talk</b><small>{capabilities.native ? 'Android speech provider; may use online processing unless on-device recognition is available. No always-on listening.' : 'Browser speech recognition only if supported. Tap starts one short session.'}</small></div><span className="badge">ON REQUEST</span></div><div className="permission-row"><Volume2/><div><b>System controls</b><small>Allow-listed app launch, media volume, Settings and Clock timer</small></div><span className="badge">{capabilities.bridge?'LIMITED':'PENDING'}</span></div><div className="permission-row"><Database/><div><b>Notification summary · count only</b><small>{capabilities.notificationAccessGranted ? `Android access enabled. ${capabilities.activeNotificationCount} active notification${capabilities.activeNotificationCount === 1 ? '' : 's'} currently visible.` : 'Optional special access. Aero counts active notifications only; it does not read or save notification titles, bodies, or message text.'}</small></div><span className="badge">{capabilities.notificationAccessGranted ? 'ENABLED' : 'OPTIONAL'}</span><button className="mini-action" onClick={()=>openNotificationAccessSettings().then(result=>setMessages(prev=>[...prev,{role:'system',text:result.message,time:result.ok?'PERMISSION':'LIMIT'}]))}>{capabilities.notificationAccessGranted ? 'MANAGE' : 'GRANT'}</button></div><div className="permission-row"><Activity/><div><b>Screen brightness</b><small>{capabilities.canWriteSystemSettings ? 'Permission granted. Brightness changes are available.' : 'Requires the separate Android “Modify system settings” permission. Aero changes only the brightness percentage when explicitly commanded.'}</small></div><span className="badge">{capabilities.canWriteSystemSettings ? 'GRANTED' : 'OPTIONAL'}</span><button className="mini-action" onClick={()=>requestBrightnessPermission().then(result=>setMessages(prev=>[...prev,{role:'system',text:result.message,time:result.ok?'PERMISSION':'LIMIT'}]))}>GRANT</button></div><button className="back-button" onClick={()=>setScreen('home')}>← BACK TO CORE</button></section>}
      {screen === 'history' && <section className="page-card"><p className="overline">SESSION RECORD / 03</p><h1>Activity<br/><em>log.</em></h1>{history.length===0?<p className="page-desc">No commands recorded yet. Execute a command from the console to populate this list.</p>:history.map((h,i)=><div className="permission-row" key={i}><Terminal/><div><b>{h.command}</b><small>Intent: {h.intent}</small></div><span className="badge">{h.time}</span></div>)}<button className="back-button" onClick={()=>setScreen('home')}>← BACK TO CORE</button></section>}
      {screen === 'commands' && <section className="page-card"><p className="overline">LOCAL INTENT REGISTRY / 04</p><h1>Command<br/><em>library.</em></h1><p className="page-desc">Create exact-phrase shortcuts saved only on this device. Custom commands can only run listed safe actions; calls, messages, shell commands, and arbitrary code are not available here.</p><div className="command-list">{['open YouTube','open settings','search the web for…','set volume 35','set brightness 50','increase volume','set a timer for 5 minutes','call … (confirmation)','text … (confirmation)','help','stop listening'].map(x=><button key={x} onClick={()=>{setScreen('home');setInput(x)}}>{x}<span>↗</span></button>)}</div>
        <div className="custom-editor"><div className="section-title"><span><Command size={14}/> CUSTOM COMMAND BUILDER</span><span>{customCommands.length}/30</span></div><form onSubmit={addCustomCommand} className="custom-form"><label>Trigger phrase<input className="custom-input" value={customPhrase} onChange={e=>setCustomPhrase(e.target.value)} maxLength={60} placeholder="e.g. launch study mode" required/></label><label>Action<select className="config-select full-select" value={customAction} onChange={e=>{setCustomAction(e.target.value);setCustomValue(e.target.value===CUSTOM_ACTIONS.OPEN_APP?'youtube':e.target.value===CUSTOM_ACTIONS.TIMER?'300':e.target.value===CUSTOM_ACTIONS.OPEN_URL?'https://example.com':e.target.value===CUSTOM_ACTIONS.WEB_SEARCH?'weather today':'50');setCustomError('');}}>{Object.entries(customActionLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{customActionNeedsValue && <label>Action value{customActionValueControl()}</label>}<button className="accept-confirm custom-add" type="submit" disabled={customCommands.length>=30}>ADD LOCAL COMMAND</button>{customError && <p className="custom-error" role="alert">{customError}</p>}</form>
        {customCommands.length===0?<p className="custom-empty">No custom commands created yet.</p>:<div className="custom-saved-list">{customCommands.map(command=><div className="custom-saved-row" key={command.id}><div><b>{command.phrase}</b><small>{customActionLabels[command.action]}{command.value!==undefined?` · ${command.value}`:''}</small></div><button onClick={()=>setCustomCommands(current=>current.filter(item=>item.id!==command.id))} aria-label={`Delete command ${command.phrase}`}><Trash2 size={14}/></button></div>)}</div>}</div><button className="back-button" onClick={()=>setScreen('home')}>← BACK TO CORE</button></section>}
      {screen === 'settings' && <section className="page-card"><p className="overline">SYSTEM CONFIG / 05</p><h1>Core<br/><em>settings.</em></h1><p className="page-desc">Your settings stay on this device. History saving starts disabled; no microphone audio is stored by this app.</p>
        <div className="permission-row"><Database/><div><b>Save activity history</b><small>Keep the latest commands after restarting the app. Off means history stays in this session only.</small></div><label className="switch-label"><input type="checkbox" checked={settings.saveHistory} onChange={e=>setSettings(prev=>({...prev,saveHistory:e.target.checked}))} aria-label="Save activity history"/><span>{settings.saveHistory?'ON':'OFF'}</span></label></div>
        <div className="permission-row"><Languages/><div><b>Voice recognition language</b><small>Language status: {detectedLanguage}. Auto-switch needs a compatible Android 14+ speech service and downloaded language models; older Android and browser modes use a fixed locale.</small></div><select className="config-select language-select" aria-label="Voice recognition language" value={settings.voiceLanguage} onChange={e=>{const value=e.target.value;detectedLanguageRef.current=value==='auto'?'':value;setDetectedLanguage(value==='auto'?'Not detected yet':languageStatus(value,false,false));setSettings(prev=>({...prev,voiceLanguage:value}));}}><option value="auto">AUTO / MULTI</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option><option value="ur-PK">Urdu (PK)</option><option value="hi-IN">Hindi (IN)</option><option value="es-ES">Spanish</option><option value="fr-FR">French</option><option value="de-DE">German</option></select></div>
        <div className="permission-row"><AudioLines/><div><b>Voice profile</b><small>TACTICAL is a restrained, lower-pitch delivery. The exact timbre depends on the installed Android/browser voice; this is not an exact character voice copy.</small></div><select className="config-select voice-select" aria-label="Voice profile" value={settings.voiceStyle} onChange={e=>setSettings(prev=>({...prev,voiceStyle:e.target.value}))}><option value="tactical">TACTICAL</option><option value="natural">SYSTEM DEFAULT</option></select></div>
        <div className="permission-row"><AudioLines/><div><b>Spoken responses</b><small>Speak replies in the detected command language where a matching system voice is installed. Tactical mode lowers pitch and slows cadence; disabled by default.</small></div><label className="switch-label"><input type="checkbox" checked={settings.voiceResponses} onChange={e=>setSettings(prev=>({...prev,voiceResponses:e.target.checked}))} aria-label="Enable spoken responses"/><span>{settings.voiceResponses?'ON':'OFF'}</span></label></div>
        <div className="wake-word-panel">
          <div className="section-title"><span><Mic size={14}/> WAKE PHRASE / ANDROID ONLY</span><span className="badge">{capabilities.wakeWordRunning ? 'LISTENING' : capabilities.wakeWordTriggered ? 'TRIGGERED' : capabilities.wakeWordModelAvailable ? 'MODEL READY' : 'SETUP NEEDED'}</span></div>
          <p className="page-desc">Phrase: <b>Activate Aero AI</b>. This feature uses a separate Android keyword model and a user-started foreground service. A persistent notification with a Stop action must remain visible. The AccessKey is kept in memory only and is never saved to app preferences.</p>
          {!capabilities.wakeWordModelAvailable && <p className="wake-word-warning">The model is not in this build yet. Add the Android-targeted <code>aero-activate-android.ppn</code> file to <code>native-android/assets/</code>, then rebuild. See <code>docs/WAKE_WORD_SETUP.md</code>.</p>}
          <label className="wake-key-label">Picovoice AccessKey<input className="custom-input" type="password" autoComplete="off" value={wakeAccessKey} onChange={e=>setWakeAccessKey(e.target.value)} placeholder="Enter key here; not saved" aria-label="Picovoice AccessKey"/></label>
          <p className="wake-word-status" role="status">{wakeMessage}</p>
          <div className="confirm-actions"><button className="accept-confirm" onClick={startWakeWord} disabled={!Capacitor.isNativePlatform() || !capabilities.wakeWordModelAvailable || wakeAccessKey.trim().length < 12 || capabilities.wakeWordRunning}>START WAKE PHRASE</button><button className="cancel-confirm" onClick={stopWakeWord} disabled={!Capacitor.isNativePlatform() || (!capabilities.wakeWordRunning && !capabilities.wakeWordTriggered)}>STOP</button></div>
          <p className="custom-empty">The detector pauses after activation. If Aero is open, it starts a single tap-to-talk session. If Aero is in the background, tap the notification/app and then the microphone. No audio is stored by Aero; Picovoice key authorization may require internet access.</p>
        </div>
        <div className="permission-row"><Volume2/><div><b>Stop speech output</b><small>Immediately stop Aero's current spoken response.</small></div><button className="mini-action" onClick={()=>stopSpeechOutput().then(result=>setMessages(prev=>[...prev,{role:'system',text:result.message,time:result.ok?'VOICE OFF':'VOICE ERR'}]))}>STOP</button></div>
        <div className="permission-row"><ShieldCheck/><div><b>Call and message safety</b><small>Confirmation remains required. This setting cannot disable that protection.</small></div><span className="badge">LOCKED</span></div>
        <p className="storage-status">{storageStatus}</p>
        <button className="back-button clear-button" onClick={()=>{setHistory([]);localRepository.clearHistory().then(()=>setStorageStatus('ACTIVITY LOG CLEARED')).catch(()=>setStorageStatus('COULD NOT CLEAR LOG'));}}><Trash2 size={13}/> CLEAR ACTIVITY LOG</button>
        <button className="back-button" onClick={()=>setScreen('home')}>← BACK TO CORE</button></section>}
    </section>
    <nav className="bottom-nav" aria-label="Main navigation"><button className={screen==='home'?'active':''} onClick={()=>setScreen('home')}><Home/><span>CORE</span></button><button className={screen==='commands'?'active':''} onClick={()=>setScreen('commands')}><Command/><span>COMMANDS</span></button><button className={screen==='history'?'active':''} onClick={()=>setScreen('history')}><History/><span>LOG</span></button><button className={screen==='settings'?'active':''} onClick={()=>setScreen('settings')}><Settings2/><span>CONFIG</span></button></nav>
  </main>;
}
