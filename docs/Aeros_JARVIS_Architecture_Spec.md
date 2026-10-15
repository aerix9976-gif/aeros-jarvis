# Aero's JARVIS — Architecture & Product Specification

**Version:** 1.0  
**Status:** Design/specification review — no application code has been built yet  
**Target:** Installable Android APK, designed for Android 11+  
**Core requirement:** No paid AI API, API key, account, or cloud LLM required for core functions.

## 1. Product goal

Aero's JARVIS is a personal, offline-first voice assistant with a futuristic HUD interface inspired by the genre of Brahma Echo-style assistants, without copying its exact layout or assets. The user can say **“Activate Aero AI”** while the user-enabled listening service is running, speak a supported command, and receive an action or spoken response. Text input remains available when the microphone is unavailable.

## 2. AI behavior and honest boundaries

The first version contains an original JavaScript assistant engine rather than an external AI API:

- A local intent router normalizes text, matches phrases and aliases, extracts values such as app names and timer durations, and selects a registered action.
- A response layer gives deterministic, context-aware responses for supported commands.
- A small local session memory remembers the current conversation and recent actions; saved preferences and custom commands remain on the device.
- A custom-command builder lets the user add trigger phrases and choose from supported actions.
- Unsupported questions receive an honest “I don't know that yet” response or offer to open a web search when explicitly requested. The app must not pretend that a rule-based engine has general human-level reasoning.

There is no external LLM/API in v1. A true open-ended generative model can be evaluated as a separate, optional on-device model later; it is not promised in the first APK because model quality, download size, RAM, speed, and licensing must be tested on the target phone.

## 3. Recommended technology

- **UI and main application logic:** JavaScript + React + Vite.
- **Android packaging:** Capacitor 8, producing a real Android project/APK.
- **Android-only capabilities:** a small Kotlin/Java Capacitor plugin for native actions that browser JavaScript cannot perform safely or reliably.
- **Persistence:** device-local storage for settings, history, command aliases, and preferences.
- **Wake phrase:** offline keyword-spotting engine behind the native Android bridge, with a model configured for “Activate Aero AI.” The project must include a working model or explicitly identify the wake phrase as not ready; it must never fake wake-word detection using a button animation.
- **Speech input:** prefer an on-device speech recognizer when available; provide tap-to-talk as a reliable fallback. Any recognizer that may send speech off-device must be clearly disclosed and opt-in.
- **Speech output:** Android TextToSpeech, with voice/language settings where supported.

JavaScript drives the interface and the command brain, but the app will still contain a small native bridge. A pure web page cannot freely manipulate Android system settings, stay alive as an always-listening service, or bypass permissions.

## 4. Version-one feature scope

### Assistant interactions

- Start/stop listening from the UI and persistent Android notification.
- Wake phrase when a compatible local model is available and service has been started by the user.
- Tap-to-talk and typed input as alternatives.
- Spoken responses, transcript display, command result status, and local conversation history.
- Offline intent handling with clear feedback when a command is unsupported.

### Supported phone actions

- Open installed apps using Android app-launch APIs.
- Open a URL or launch a browser search when requested.
- Open Android settings pages for Wi-Fi, Bluetooth, display, sound, and app permissions; do not claim a restricted toggle succeeded unless Android confirms it.
- Adjust media volume with user-requested commands.
- Change brightness only when the required Android permissions and settings allow it.
- Create timers/alarms by opening Android clock intents where possible.
- Use Home/Back/Recents and deeper on-screen interactions only through a separately enabled Accessibility Service; clearly explain the permission before directing the user to Android Settings.
- Read notifications only after the user explicitly enables Notification Access.
- Prepare calls and texts through Android dialer/SMS intents. Sending a message or placing a call requires a visible confirmation step; no silent messaging or calling.
- Add/edit/delete user-defined command aliases that map only to supported actions.

### Not in v1

- Unrestricted control of every app or Android system feature.
- Hidden recording, covert background listening, bypassing Android permission prompts, or silently sending communications.
- A cloud chat model, API key setup, subscriptions, or mandatory sign-in.
- Claims that it can see arbitrary screen content without Accessibility/Media Projection permissions and explicit user consent.

## 5. Wake phrase and privacy requirements

Always-listening behavior is opt-in, visibly indicated, and manually stoppable. The native service must start from a visible app action and display a persistent notification while the microphone is active. The user can stop it from either the app or notification. No raw microphone audio is saved to disk by default. The wake-word detector should process audio locally; speech recognition happens after activation. If a chosen recognition engine requires network access, the UI must disclose that behavior and retain a text-input fallback.

Background microphone access is restricted by Android, including Android 11+ microphone foreground-service requirements and later restrictions on starting services from the background. Therefore the app must not promise reliable wake listening after force-stop, reboot, or every battery-management state. Settings should explain battery optimization and device-specific behavior rather than hiding it.

## 6. Visual direction

**Design phrase:** “A quiet spacecraft instrument, not a neon gaming dashboard.”

Palette:

- Deep space: `#070608`
- Graphite panel: `#141116`
- Sentinel red: `#FF4A4F`
- Ember orange: `#FF633F`
- Molten amber: `#FFAD57`
- Text white: `#EDF4FF`
- Muted telemetry: `#8290A6`

Typography:

- Display: Space Grotesk or a similar geometric sans, used for the wordmark and major states.
- Body: Inter or platform sans for readable command text.
- Telemetry: monospace system font for status, latency, and diagnostic values.

Signature element: a central “AERO reactor” made from a crisp core, three thin orbital rings, and short segmented arcs. Motion changes by state (slow breathing in standby, reactive waveform while listening, rotating sweep while thinking, brief pulse on completion). Avoid heavy particle effects and excessive blur to keep older phones responsive. Respect Android reduced-animation/accessibility preferences where practical.

Main HUD sketch:

```text
┌────────────────────────────┐
│ AERO / JARVIS       MIC ●   │
│                            │
│         [ AERO CORE ]      │
│        AWAITING INPUT      │
│   “Say Activate Aero AI”   │
│                            │
│  [Open app] [Volume] [Web] │
│                            │
│ ┌────────────────────────┐ │
│ │ Type a command…     ↗  │ │
│ └────────────────────────┘ │
│  HOME   CONSOLE   SKILLS   │
└────────────────────────────┘
```

Screens: Home HUD, Conversation/Command Console, Custom Commands, Permissions & Service Status, Settings/About. The initial screen should make listening state, privacy status, and microphone controls unmistakable.

## 7. Architecture

1. **Presentation layer (React/CSS):** HUD states, transcript, settings, actions, animations, accessibility labels.
2. **Assistant core (JavaScript):** text normalization, local intent matching, slot extraction, context/session state, command registry, safe response generation.
3. **Action broker (JavaScript):** validates the intent and parameters, asks for confirmation for sensitive actions, then calls the native bridge.
4. **Native Capacitor plugin (Kotlin/Java):** microphone service/wake-word engine integration, app launching, Android intents, volume/brightness APIs, TTS, and permission status.
5. **Local persistence:** settings, command aliases, and history on-device; provide a clear “clear history” action.
6. **Build pipeline:** source project + GitHub Actions Android build workflow, producing a debug APK artifact for installation.

The command broker uses an allow-list. Natural-language input is never executed as arbitrary shell, JavaScript, or Android code. Unknown commands do not trigger guessed actions.

## 8. Delivery and download path

Deliverables after approval and implementation:

1. `Aeros-JARVIS-Source.zip` — complete editable project, including Android source and build workflow.
2. `app-debug.apk` — generated by the Android build workflow, if the build completes successfully.
3. `README.md` — exact phone-friendly steps.

Expected phone workflow: download the source ZIP, upload/extract it into a GitHub repository, run the included **Build Android APK** GitHub Actions workflow, download the resulting APK artifact from the workflow run, open it on the phone, allow installation from that source if Android asks, and install. The build workflow must be tested before this is described as successful. A signed Play Store release is out of scope for v1.

## 9. Acceptance criteria

- The app packages as an Android APK and starts on Android 11+.
- Main HUD renders well on a narrow phone screen and animations remain responsive on modest hardware.
- Local text commands route to the correct supported action or return a clear unsupported response.
- App launch, browser/setting intents, volume changes, and TTS are tested on-device or in an Android emulator.
- High-impact actions ask for confirmation.
- Listening state, stop controls, permissions, and privacy behavior are visible.
- No external AI API key or login is needed for core use.
- README clearly documents APK retrieval, installation, service limitations, and permissions.

## 10. Known risks to validate during implementation

- A genuinely custom “Activate Aero AI” wake-word model must be available and correctly licensed; otherwise tap-to-talk ships as the reliable fallback and wake-word support must be labeled experimental.
- Speech-recognition availability and offline language data vary by Android device.
- Background execution and microphone policies differ by Android version and vendor battery controls.
- Accessibility, notification access, brightness modification, calls, and SMS each have distinct permissions or confirmation constraints.
- The exact APK output size and performance will depend on the chosen wake-word model and bundled assets.

## References used for feasibility

- Capacitor 8 Android plugin guide: https://next.capacitorjs.com/docs/plugins/android
- Capacitor 8 environment/build requirements: https://capacitorjs.com/docs/getting-started/environment-setup
- Android foreground-service changes: https://developer.android.com/develop/background-work/services/fgs/changes
- Android 11 foreground services: https://developer.android.com/about/versions/11/privacy/foreground-services
- Candidate offline wake-word implementation to evaluate (not adopted until license/model validation): https://github.com/voicute/onnx-wakeword
- Recent Brahma/Brahma Echo-style assistant demos used as broad inspiration, not copied assets: https://www.youtube.com/watch?v=vk-nU1CVvZg and https://www.youtube.com/watch?v=mKA1iyMIqo0
