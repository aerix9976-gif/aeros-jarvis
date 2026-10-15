# Activate Aero AI — wake phrase setup

Aero's wake phrase is an optional Android-only feature. It is **not available in the standard source snapshot** until you add your own keyword model and AccessKey. This is deliberate: the repository does not bundle a third-party model or account credential.

## 1. Create the Android keyword model

1. Open the [Picovoice Porcupine Android quick start](https://picovoice.ai/docs/quick-start/porcupine-android/) and follow its link to Picovoice Console.
2. Sign in to the service and create a custom Porcupine wake word for the exact phrase **Activate Aero AI**.
3. Select the **Android** target/platform when training and download the keyword model `.ppn` file.
4. Copy the `.ppn` file into this repository as:

   `native-android/assets/aero-activate-android.ppn`

   Keep the exact filename. The Android patch script copies this asset into the generated app. Do not put it in `src/`.

5. Follow the current Picovoice account and model licensing terms for development and distribution. Do not upload private account credentials or an AccessKey to GitHub.

## 2. Build the APK

Use the included GitHub Actions workflow (`Actions → Build Android APK → Run workflow`) or run the documented Android build locally. The workflow installs Porcupine Android SDK version `4.0.2`, copies the keyword asset if present, builds `app-debug.apk`, and uploads it as an artifact.

## 3. Start wake detection in Aero

1. Install your newly built APK and open Aero.
2. Go to **Config** and find **Wake phrase / Android only**.
3. Paste your Picovoice AccessKey into the password field and tap **Start wake phrase**. Aero keeps it in memory only; it is not written to the local preferences store. The first authorization may require an internet connection.
4. Grant microphone and notification permissions when Android prompts. Android must show the ongoing wake-listening notification with a **Stop** action. You can stop listening from Config or from that notification.
5. Say **Activate Aero AI**. Detection pauses the wake-word microphone. If Aero is visible, it attempts to start one command-level tap-to-talk session. If Aero was in the background, open Aero from the notification and tap the microphone to speak.

## Privacy and limitations

- Wake detection is user-started; it is not silently enabled on app launch.
- While active, Android continuously supplies microphone frames to the local keyword detector. Keep the persistent notification visible and use Stop when you are done.
- Aero does not save raw microphone audio. After the phrase is detected, wake detection pauses instead of leaving a second microphone listener running while commands are recognized.
- Picovoice AccessKey authorization may use network connectivity, according to the provider's runtime and account requirements. Wake detection itself uses the local Android keyword engine after initialization; check the provider's current documentation and terms.
- The standard ZIP has no `.ppn` file, therefore the UI reports that setup is needed and disables Start until you add the model and rebuild.
- A successful Gradle build and real-device test are still required before treating this feature as production-ready.
