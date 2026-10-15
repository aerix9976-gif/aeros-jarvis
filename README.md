# Aero's JARVIS v0.7

A JavaScript-first, local-command Android assistant with an original dark aerospace HUD. The source includes the React/Vite UI, deterministic offline command router, local settings/history, safe custom command editor, and an allow-listed Capacitor/Android bridge. v0.7 adds an ember-red and gunmetal Sentinel HUD, multilingual exact-phrase command aliases, locale-aware replies, an original low-pitch tactical speech profile, and Android 14+ language-detection/switch requests. It also prevents tap-to-talk and wake-word detection from competing for the microphone, and the Stop Listening command stops both native listeners. **An APK has not yet been built and tested successfully in this environment.**

## Requirements
- Node.js 22+ and npm
- Local Android build: Android SDK, Java 21, and Android API 30+
- Phone-only build: GitHub account and the included Actions workflow

## Run preview, tests, and build
```bash
npm install --no-audit --no-fund
npm test
npm run dev
```
Production web build:
```bash
npm run build
```

## Android build
On a development computer with Android Studio/SDK installed:
```bash
npm install --no-audit --no-fund
npx cap add android
npm run android:debug
```
The patch step injects the native plugin and the optional wake-word SDK into the generated Android project. It is safe to run repeatedly for the normal generated Capacitor layout.

## Build from a phone using GitHub Actions

For exact Android/Termux upload commands, token setup, build, artifact download, and troubleshooting, follow [`UPLOAD_AND_BUILD_ANDROID.md`](UPLOAD_AND_BUILD_ANDROID.md).

1. Create a GitHub repository and upload the extracted source to its root.
2. The included workflow uses `npm install` on GitHub Actions, so a local `package-lock.json` is optional for this starter.
3. Open the repository **Actions** tab, choose **Build Android APK**, and tap **Run workflow**.
4. After a successful run, download artifact `aeros-jarvis-debug-apk`.
5. Extract `app-debug.apk` from that artifact ZIP and install it on Android. Only install APKs you built or trust.

## Features in source
- Original responsive Sentinel HUD in gunmetal, ember red, and molten amber with reduced-motion support.
- Offline deterministic command routing for app aliases, search/URL slots, volume, brightness, timers, and help. The supported localized command vocabulary includes Urdu, Roman Urdu, Hindi, Spanish, French, and German.
- A custom-command editor that saves exact triggers on device and permits only allow-listed action types. It never accepts shell commands or arbitrary code.
- Android native bridge source for allow-listed app launch, media volume, Settings, Clock timer hand-off, HTTP/HTTPS links, screen brightness (special Android permission required), tap-to-talk, and spoken responses.
- Calls/messages require confirmation and open the dialer/SMS draft only; Aero does not place calls or send texts by itself.
- Optional “Activate Aero AI” wake-word service source. It requires an Android-targeted Picovoice keyword model and your AccessKey; neither is bundled. See [`docs/WAKE_WORD_SETUP.md`](docs/WAKE_WORD_SETUP.md).
- Optional count-only notification summary after you grant notification access in Android Settings. It displays the current count of active notifications and deliberately does not read or save their text.
- Activity history remains off by default. No raw microphone audio is saved by Aero.

## Wake phrase setup
Follow [`docs/WAKE_WORD_SETUP.md`](docs/WAKE_WORD_SETUP.md). Create/download a custom `Activate Aero AI` `.ppn` model for Android, then put it at `native-android/assets/aero-activate-android.ppn` and rebuild. In Config, enter your AccessKey to intentionally start listening. The app asks for microphone and notification permissions and uses an ongoing notification with a Stop action. Wake detection pauses after activation; if Aero is in the background, open it and tap the microphone to give the command. See the [official Porcupine Android guide](https://picovoice.ai/docs/quick-start/porcupine-android/).

## Important limitations
- Dependency installation, Vite production build, and Android Gradle compilation could not be run in this environment because `npm install` timed out. The GitHub Actions workflow is the intended full build verification path, but the build is **not claimed to have succeeded**.
- The wake phrase is unavailable in a normal source ZIP until the model is added; it is not simulated. The provider's key authorization may require internet access.
- Android speech recognition may process audio online depending on the configured system provider. Tap-to-talk uses the available Android speech service; offline mode is requested where supported but not guaranteed.
- The current “brain” is deterministic intent routing, **not a general-purpose offline LLM or live translation system**. Multilingual support is limited to the explicit command vocabulary and localized reply templates. AccessibilityService automation is deferred; the notification integration only counts active notifications and never reads message content.

## Privacy / safety behavior
- Local settings are stored with Capacitor Preferences in the native app and local storage in a browser preview.
- History saving is disabled by default; the user can enable it and clear it from Config.
- Unknown text is never executed as code; URLs accept only HTTP/HTTPS.
- Calls and SMS need confirmation and open a user-facing composer. Nothing is sent automatically.
- Wake listening is off until the user starts it and stops when the persistent notification's Stop action is used. No raw microphone audio is saved by Aero.

## Native bridge reference
The native app uses the [Capacitor Android plugin API](https://next.capacitorjs.com/docs/plugins/android). Porcupine SDK version `4.0.2` is declared in the Android app only to provide the optional wake-word engine.
