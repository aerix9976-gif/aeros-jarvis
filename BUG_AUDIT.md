# Aero's JARVIS — bug audit (v0.7)

Date: 2026-10-15

## Fixed

1. **Microphone ownership conflict:** starting Android tap-to-talk could leave Porcupine wake-word detection running, so both audio clients could compete for the microphone. Tap-to-talk now stops the wake-word service first.
2. **Stop Listening was incomplete:** it stopped tap-to-talk but did not explicitly stop the always-on wake-word service. It now stops both listeners and refreshes displayed capabilities.
3. **Stale browser-preview message:** the voice error text incorrectly implied native Android voice support was still a future task. It now says to use the installed Android app for native tap-to-talk.
4. **Stale Vite test config:** removed an unused `test` config key because this repository uses Node's built-in test runner, not Vitest.

5. **Locale mismatch in speech output:** Android might report `es-MX`, `fr-CA`, or another region tag while the bridge only ships a fixed set of reply/TTS locales. A locale resolver now maps detected language families to a supported voice locale rather than silently falling back to English for the response.
6. **Language detection UI overclaimed results:** the UI previously called a device/browser locale fallback “detected”. It now distinguishes provider auto-detection from a fixed-locale fallback/selection.
7. **Timer unit plural edge case:** timer parsing now maps localized unit stems, including German `Stunden`, and enforces a 1–1440-unit bound in the localized parser.
8. **Speech switching allowlist:** on Android 14+, language-detection and language-switch extras are set to the supported locale allowlist, reducing unexpected language switches. Provider implementation and downloaded models still control actual behavior.
9. **Build workflow SDK prerequisites:** the Actions workflow now explicitly requests Android platform 36 and build-tools 36.0.0 rather than relying on a runner's preinstalled SDK.

## Checks completed

- `node --test`: **51 passed, 0 failed**.
- TypeScript transpile/parser checks for `src/App.jsx` and `src/main.jsx`: **pass**.
- `node --check` over source `.js`/`.mjs` and test `.js` files: **pass**.
- Android patcher fixture tests cover idempotent manifest changes, plugin/service source installation, SDK minimum, and optional model copy/removal.
- Verified the Porcupine Android dependency coordinates and `setKeywordPaths` API against current provider/Maven documentation.
- Added regression checks for locale canonicalization, fallback-label accuracy, German plural timer units, French stop-listening phrasing, and Android 14 language-switch extras.

## Not yet verified

- `npm install --no-audit --no-fund` timed out in this environment. A subsequent `npm run build` confirms dependencies were not installed (`vite: not found`). Android SDK environment variables are unset here, so Android Gradle compilation and APK generation cannot be performed locally; on-device behavior also remains **unverified**.
- There is no custom `.ppn` keyword model or Picovoice AccessKey in the source ZIP. That optional feature remains disabled until the project owner adds a model and key privately.
- GitHub Actions has not yet produced a verified APK artifact. Follow `UPLOAD_AND_BUILD_ANDROID.md` to publish the source and run the workflow.

## Remaining risks

- Generated Android Gradle files and native source must be compiled together in GitHub Actions before APK distribution.
- Tap-to-talk behavior depends on the device's configured Android speech recognition provider. That provider may process audio online.
- Wake-word detection requires a real, Android-targeted model and provider authorization; it is never simulated.
