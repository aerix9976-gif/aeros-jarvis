# Upload Aero's JARVIS from Android and build the APK

This package contains the project source and a GitHub Actions workflow. It does **not** contain an APK; GitHub Actions must compile one.

## Recommended phone-only method: Termux + Git

### 1. Download and extract the source

Download `Aeros-JARVIS-Phone-Upload-Package.zip` from the ChatGPT response and keep it in Android's **Downloads** folder.

Install Termux from its official F-Droid listing, open it, and run:

```sh
termux-setup-storage
pkg update
pkg install git unzip
mkdir -p ~/aeros-jarvis
unzip -o ~/storage/downloads/Aeros-JARVIS-Phone-Upload-Package.zip -d ~/aeros-jarvis
cd ~/aeros-jarvis
```

If Android saved the ZIP under another name or folder, change the ZIP path in the `unzip` command. The extracted project root should show files such as `package.json`, `README.md`, `src/`, `native-android/`, and `.github/`.

### 2. Make a GitHub token for this repository

Open GitHub in your browser and go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens**. Create a token restricted to only `aerix9976-gif/aeros-jarvis`, with **Contents: Read and write**. Repository metadata read access is required as well. Set an expiry you are comfortable with.

Treat the token like a password. Do not paste it into this chat, put it into a source file, or include it in the ZIP.

### 3. Push the source to the empty repository

In Termux, while in `~/aeros-jarvis`, set the commit identity once (replace the example values with your GitHub username and email), then run:

```sh
git config --global user.name "YOUR_GITHUB_USERNAME"
git config --global user.email "YOUR_GITHUB_EMAIL"
git init
git branch -M main
git add .
git status --short
git commit -m "Add Aero's JARVIS Android source"
git remote add origin https://github.com/aerix9976-gif/aeros-jarvis.git
git push -u origin main
```

When Git prompts for credentials, use your GitHub username as the username and paste the fine-grained token at the password prompt. The token will not be visible as you type. If Git says the remote `origin` already exists, use `git remote set-url origin https://github.com/aerix9976-gif/aeros-jarvis.git` before pushing. If the repository already has a commit, do not force-push; inspect the remote first.

### 4. Run the APK workflow

1. Open [the repository](https://github.com/aerix9976-gif/aeros-jarvis).
2. Tap **Actions** and choose **Build Android APK**. If GitHub asks whether to enable workflows, enable them.
3. Tap **Run workflow**, select branch `main`, and start it. A push to `main` should also trigger the workflow automatically.
4. Open the latest run. Wait for all steps to turn green; if a step fails, open it and read the first actual error.
5. Under **Artifacts**, download `aeros-jarvis-debug-apk`, then extract `app-debug.apk` from the downloaded ZIP.
6. Move `app-debug.apk` to Downloads, open it, and approve Android's “install unknown apps” prompt for the file manager/browser you used if Android requests it. Only install an APK you built and trust.

## What the workflow checks

The workflow runs `npm test`, builds the Vite web app, creates a Capacitor Android project, injects the native Aero bridge, runs Gradle to assemble a debug APK, and uploads the resulting APK as an artifact. The source's Node tests have passed locally (51/51), but a successful Android build is not claimed until the GitHub Actions run succeeds.

## Wake phrase setup is optional

The app's `Activate Aero AI` wake phrase will not work merely from uploading the source. You must separately obtain an Android-targeted Porcupine `.ppn` keyword model and a private AccessKey. Follow `docs/WAKE_WORD_SETUP.md`. Keep credentials private and don't commit your key. Without that setup, use the app's tap-to-talk microphone.

## Troubleshooting

- **`npm install` fails:** open the failed step. Registry/network errors can be temporary; re-run the workflow once. A dependency or source error needs fixing first.
- **`npm test` fails:** don't ignore it; open the failed test output.
- **Gradle/SDK error:** open the first failing Gradle step and keep its complete log so the exact error can be diagnosed.
- **No Artifacts section:** the workflow did not complete successfully or the upload-artifact step failed.
- **Git authentication rejected:** regenerate a token limited to this repository with Contents read/write and retry the password prompt. Never use your GitHub account password as the Git password.
