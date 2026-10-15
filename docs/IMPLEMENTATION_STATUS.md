# Implementation status — 2026-10-15 (v0.7 source)

## Implemented in source

- React + Vite + Capacitor 8 project with an original responsive, reduced-motion Sentinel HUD: graphite surfaces, crimson/ember signals, and molten-amber focus accents.
- Deterministic local command router with URL/alias disambiguation, safe timer/volume/brightness bounds, and safe fallback for unknown commands.
- Local preferences and optional activity history; history stays off by default. Commands are sanitized before persistence. No raw microphone audio is written by Aero.
- Local custom-command editor with exact-phrase triggers and a strict action allow-list (app launch, Settings, volume, brightness, HTTP(S) URL, web search, Clock timer). Arbitrary code/shell commands, calls, and texts cannot be custom actions.
- Android bridge source for allow-listed app launching, media-volume adjustment, Android Settings, Clock timer hand-off, HTTP/HTTPS URLs, confirmation-only dialer/SMS composer, tap-to-talk via Android SpeechRecognizer, brightness control behind `WRITE_SETTINGS`, and spoken responses via Android TTS.
- Optional Porcupine wake-word service source. It is user-started from Config, uses an ongoing Android microphone foreground-service notification with Stop action, requires notification/microphone permissions, pauses after detection, and hands off to one tap-to-talk session when the app is visible. Requires user-supplied Android `.ppn` model and AccessKey.
- App UI has a wake-word model status check and in-memory AccessKey input. The AccessKey is not saved in app preferences.
- Optional Android `NotificationListenerService` reports only the number of active notifications after explicit system-settings consent. It does not inspect titles or bodies, and it does not persist notification contents.
- Android project patcher is repeatable/idempotent in tests, injects the Porcupine SDK dependency and service manifest entry, adds permissions, and copies the keyword model if supplied.
- v0.6 bug fix: starting tap-to-talk stops any running wake-word service before claiming the microphone; “stop listening” now stops both tap-to-talk and wake-word listening and refreshes capabilities.
- v0.7 language support: explicit command aliases across Urdu, Roman Urdu, Hindi, Spanish, French, and German; localized reply templates; automatic response-locale mapping; tactical TTS pitch/cadence profile. On Android 14+ the recognizer requests detection/switching for a supported locale allowlist, subject to provider support and downloaded models.
- GitHub Actions workflow tests, builds web assets, creates an Android project, applies the native bridge, assembles a debug APK, and uploads it.

## Important setup still required

- The standard source ZIP intentionally does **not** include a `.ppn` model or AccessKey. To activate “Activate Aero AI”, follow `docs/WAKE_WORD_SETUP.md`, train/download an Android-targeted keyword model through the provider, and place it at `native-android/assets/aero-activate-android.ppn`. Provider account/model terms apply.
- Wake-word runtime has not been compiled or tested on a physical Android device in this environment.
- 51/51 Node tests pass and JSX syntax checks pass. Vite/Gradle build is not verified here because `npm install --no-audit --no-fund` timed out; `npm run build` consequently reported `vite: not found`, and no Android SDK is configured locally. Run the included GitHub Actions workflow to verify the actual APK build.
- The full Android build and APK artifact are not yet verified. Publish the source and run the included GitHub Actions workflow using `UPLOAD_AND_BUILD_ANDROID.md`.
- Multilingual recognition is not universal or equivalent to general translation: the current router supports a bounded command vocabulary. Android 14 language detection/switch is service/model-dependent; older Android and browser speech use a fixed fallback locale.
- Tap-to-talk still depends on Android's configured speech recognition service. It may process audio online; “prefer offline” is not a guarantee that every provider works offline.

## Not implemented / intentionally deferred

- A general-purpose offline LLM. The current response engine is a deterministic command engine and must not be presented as an LLM.
- AccessibilityService automation remains deferred. Broad cross-app tap automation is not enabled. The notification listener is implemented as an opt-in count-only feature rather than a message-reading service.
- Automatic message/call sending. Only the dialer/SMS composer can be opened after user confirmation; the user still places the call or sends the message.
- Production signing, store packaging, or device-level reliability validation.
