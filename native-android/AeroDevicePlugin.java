package com.aero.jarvis;

import android.Manifest;
import android.content.Intent;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.IntentFilter;
import android.content.res.AssetManager;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.net.Uri;
import android.provider.AlarmClock;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

import java.util.ArrayList;
import java.util.Locale;

/** Small, allow-listed bridge. No shell execution, arbitrary intents, or hidden background services. */
@CapacitorPlugin(name = "AeroDevice", permissions = {
    @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class AeroDevicePlugin extends Plugin {
    private SpeechRecognizer speechRecognizer;
    private boolean speechListening = false;
    private String detectedSpeechLanguageTag = "";
    private boolean speechLanguageAutoDetected = false;
    private TextToSpeech textToSpeech;
    private boolean textToSpeechReady = false;
    private boolean textToSpeechInitializing = false;
    private BroadcastReceiver wakeWordReceiver;
    private boolean wakeWordReceiverRegistered = false;

    @Override
    public void load() {
        super.load();
        wakeWordReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                if (intent == null) return;
                if (AeroWakeWordService.ACTION_WAKE_WORD_DETECTED.equals(intent.getAction())) {
                    JSObject payload = new JSObject();
                    payload.put("phrase", "Activate Aero AI");
                    payload.put("message", "Wake phrase detected. Wake listening paused; Aero can now accept a command.");
                    notifyListeners("wakeWordDetected", payload, true);
                } else if ("com.aero.jarvis.wake.ERROR".equals(intent.getAction())) {
                    JSObject payload = new JSObject();
                    payload.put("message", intent.getStringExtra("message") == null ? "Wake-word service failed." : intent.getStringExtra("message"));
                    notifyListeners("wakeWordError", payload, true);
                } else if ("com.aero.jarvis.NOTIFICATION_COUNT".equals(intent.getAction())) {
                    JSObject payload = new JSObject();
                    payload.put("count", intent.getIntExtra("count", 0));
                    notifyListeners("notificationCountChanged", payload, true);
                }
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(AeroWakeWordService.ACTION_WAKE_WORD_DETECTED);
        filter.addAction("com.aero.jarvis.wake.ERROR");
        filter.addAction("com.aero.jarvis.NOTIFICATION_COUNT");
        try {
            ContextCompat.registerReceiver(getContext(), wakeWordReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
            wakeWordReceiverRegistered = true;
        } catch (Exception ignored) { wakeWordReceiverRegistered = false; }
    }

    private boolean hasWakeWordModel() {
        try (java.io.InputStream input = getContext().getAssets().open(AeroWakeWordService.MODEL_ASSET)) {
            return input != null;
        } catch (Exception ignored) { return false; }
    }

    private boolean hasNotificationAccess() {
        String enabled = Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
        if (enabled == null || enabled.isEmpty()) return false;
        for (String flattened : enabled.split(":")) {
            ComponentName component = ComponentName.unflattenFromString(flattened);
            if (component != null && getContext().getPackageName().equals(component.getPackageName())) return true;
        }
        return false;
    }

    private void success(PluginCall call, String message) {
        JSObject result = new JSObject();
        result.put("ok", true);
        result.put("message", message);
        call.resolve(result);
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ok", true);
        result.put("bridge", true);
        result.put("platform", "android");
        result.put("actions", "app_launch,media_volume,screen_brightness_optional_permission,system_settings,timer,http_https_url,confirmed_dialer,sms_draft,tap_to_talk,speech_output");
        result.put("tapToTalk", SpeechRecognizer.isRecognitionAvailable(getContext()));
        result.put("canWriteSystemSettings", Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.System.canWrite(getContext()));
        result.put("wakeWordModelAvailable", hasWakeWordModel());
        result.put("wakeWordRunning", AeroWakeWordService.isDetecting());
        result.put("wakeWordTriggered", AeroWakeWordService.wasTriggered());
        result.put("notificationAccessGranted", hasNotificationAccess());
        result.put("activeNotificationCount", AeroNotificationListenerService.getActiveCount());
        result.put("onDeviceSpeechAvailable", Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext()));
        result.put("automaticLanguageSwitchAvailable", Build.VERSION.SDK_INT >= 34);
        call.resolve(result);
    }

    @PluginMethod
    public void startSpeechRecognition(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionsCallback");
            return;
        }
        startRecognitionAfterPermission(call);
    }

    @PermissionCallback
    private void microphonePermissionsCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            startRecognitionAfterPermission(call);
        } else {
            call.reject("Microphone permission was not granted. You can still type commands.");
        }
    }

    private void startRecognitionAfterPermission(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("No Android speech recognition service is available on this device.");
            return;
        }
        String language = call.getString("language", "auto");
        if (!("auto".equals(language)) && !"en-US".equals(language) && !"en-GB".equals(language)
                && !"ur-PK".equals(language) && !"hi-IN".equals(language) && !"es-ES".equals(language)
                && !"fr-FR".equals(language) && !"de-DE".equals(language)) {
            language = "auto";
        }
        final boolean useAutomaticLanguage = "auto".equals(language);
        final String languageTag = useAutomaticLanguage ? Locale.getDefault().toLanguageTag() : language;
        detectedSpeechLanguageTag = languageTag;
        speechLanguageAutoDetected = false;
        getActivity().runOnUiThread(() -> {
            try {
                // Never let the always-on keyword detector compete with tap-to-talk for the microphone.
                getContext().stopService(new Intent(getContext(), AeroWakeWordService.class));
                releaseSpeechRecognizer(false);
                boolean useOnDevice = Build.VERSION.SDK_INT >= 31
                    && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext());
                speechRecognizer = useOnDevice
                    ? SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext())
                    : SpeechRecognizer.createSpeechRecognizer(getContext());
                final SpeechRecognizer activeRecognizer = speechRecognizer;
                activeRecognizer.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle params) {
                        if (speechRecognizer != activeRecognizer) return;
                        notifySpeechState("listening", "Microphone is active for this tap-to-talk session.");
                    }
                    @Override public void onBeginningOfSpeech() { }
                    @Override public void onRmsChanged(float rmsdB) { }
                    @Override public void onBufferReceived(byte[] buffer) { }
                    @Override public void onEndOfSpeech() {
                        if (speechRecognizer != activeRecognizer) return;
                        notifySpeechState("processing", "Speech captured; Android is processing recognition.");
                    }
                    @Override public void onError(int error) {
                        if (speechRecognizer != activeRecognizer) return;
                        speechListening = false;
                        String message = speechErrorMessage(error);
                        JSObject payload = new JSObject();
                        payload.put("message", message);
                        notifyListeners("speechError", payload, true);
                        notifySpeechState("stopped", message);
                        releaseSpeechRecognizer(false);
                    }
                    @Override public void onResults(Bundle results) {
                        if (speechRecognizer != activeRecognizer) return;
                        speechListening = false;
                        ArrayList<String> matches = results == null ? null : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (matches != null && !matches.isEmpty() && matches.get(0) != null && !matches.get(0).trim().isEmpty()) {
                            JSObject payload = new JSObject();
                            payload.put("transcript", matches.get(0).trim().substring(0, Math.min(500, matches.get(0).trim().length())));
                            payload.put("language", useAutomaticLanguage
                                ? (detectedSpeechLanguageTag == null || detectedSpeechLanguageTag.isEmpty() ? languageTag : detectedSpeechLanguageTag)
                                : languageTag);
                            payload.put("languageAutoDetected", useAutomaticLanguage && speechLanguageAutoDetected);
                            payload.put("processingMode", useOnDevice ? "on-device" : "system-provider");
                            notifyListeners("speechResult", payload, true);
                            notifySpeechState("stopped", "Tap-to-talk finished.");
                        } else {
                            JSObject payload = new JSObject();
                            payload.put("message", "No speech was recognized. Try again or type your command.");
                            notifyListeners("speechError", payload, true);
                            notifySpeechState("stopped", "No speech was recognized.");
                        }
                        releaseSpeechRecognizer(false);
                    }
                    @Override public void onLanguageDetection(Bundle results) {
                        if (speechRecognizer != activeRecognizer || !useAutomaticLanguage || Build.VERSION.SDK_INT < 34 || results == null) return;
                        String detected = results.getString(SpeechRecognizer.DETECTED_LANGUAGE);
                        if (detected == null || detected.length() < 2 || detected.length() > 35
                                || !detected.matches("[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*")) return;
                        if (!("en-US".equalsIgnoreCase(detected) || "en-GB".equalsIgnoreCase(detected)
                                || "ur-PK".equalsIgnoreCase(detected) || "hi-IN".equalsIgnoreCase(detected)
                                || "es-ES".equalsIgnoreCase(detected) || "fr-FR".equalsIgnoreCase(detected)
                                || "de-DE".equalsIgnoreCase(detected))) return;
                        detectedSpeechLanguageTag = detected;
                        speechLanguageAutoDetected = true;
                        JSObject languagePayload = new JSObject();
                        languagePayload.put("language", detected);
                        notifyListeners("speechLanguage", languagePayload, true);
                    }
                    @Override public void onPartialResults(Bundle partialResults) { }
                    @Override public void onEvent(int eventType, Bundle params) { }
                });
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                if (useAutomaticLanguage && Build.VERSION.SDK_INT >= 34) {
                    intent.putExtra(RecognizerIntent.EXTRA_ENABLE_LANGUAGE_DETECTION, true);
                    intent.putExtra(RecognizerIntent.EXTRA_ENABLE_LANGUAGE_SWITCH, RecognizerIntent.LANGUAGE_SWITCH_BALANCED);
                    // Bound language switching to the supported response/voice locales. The Android provider
                    // still needs corresponding downloaded recognition models and may ignore these extras.
                    ArrayList<String> allowedLanguages = new ArrayList<>();
                    allowedLanguages.add("en-US");
                    allowedLanguages.add("en-GB");
                    allowedLanguages.add("ur-PK");
                    allowedLanguages.add("hi-IN");
                    allowedLanguages.add("es-ES");
                    allowedLanguages.add("fr-FR");
                    allowedLanguages.add("de-DE");
                    intent.putStringArrayListExtra(RecognizerIntent.EXTRA_LANGUAGE_DETECTION_ALLOWED_LANGUAGES, allowedLanguages);
                    intent.putStringArrayListExtra(RecognizerIntent.EXTRA_LANGUAGE_SWITCH_ALLOWED_LANGUAGES, allowedLanguages);
                } else {
                    // Older recognizers use the device locale as a best-effort fallback; auto-switch is not available there.
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, languageTag);
                }
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
                intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
                intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
                speechListening = true;
                speechRecognizer.startListening(intent);
                JSObject payload = new JSObject();
                payload.put("ok", true);
                payload.put("message", useAutomaticLanguage
                    ? (Build.VERSION.SDK_INT >= 34
                        ? "Tap-to-talk started. Automatic language detection and switching are requested; support and downloaded models depend on the Android speech service."
                        : "Tap-to-talk started in your device language. Automatic language switching needs a compatible Android 14+ speech service; choose a language manually on older devices.")
                    : (useOnDevice
                        ? "Tap-to-talk started using Android on-device speech recognition."
                        : "Tap-to-talk started using the Android speech service. Offline mode is requested but not guaranteed."));
                payload.put("processingMode", useOnDevice ? "on-device" : "system-provider");
                call.resolve(payload);
                notifySpeechState("started", "Tap-to-talk started.");
            } catch (Exception error) {
                speechListening = false;
                releaseSpeechRecognizer(false);
                call.reject("Android speech recognition could not start. You can type your command.");
            }
        });
    }

    @PluginMethod
    public void stopSpeechRecognition(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            releaseSpeechRecognizer(true);
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("message", "Tap-to-talk stopped.");
            call.resolve(result);
        });
    }

    private void notifySpeechState(String state, String message) {
        JSObject payload = new JSObject();
        payload.put("state", state);
        payload.put("message", message);
        notifyListeners("speechState", payload, true);
    }

    private String speechErrorMessage(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO: return "Android reported an audio error. Try again or type a command.";
            case SpeechRecognizer.ERROR_CLIENT: return "Android speech recognition was interrupted. Try again.";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "Microphone permission is required for tap-to-talk.";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "The configured speech service had a network issue. Try again or type a command.";
            case SpeechRecognizer.ERROR_NO_MATCH: return "No speech was recognized. Try again or type a command.";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "Speech recognition is busy. Wait briefly and try again.";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "No speech was detected. Tap the microphone and try again.";
            default: return "Android speech recognition failed. Try again or type a command.";
        }
    }

    private void releaseSpeechRecognizer(boolean notifyStopped) {
        SpeechRecognizer previous = speechRecognizer;
        speechRecognizer = null;
        boolean wasListening = speechListening;
        speechListening = false;
        if (previous != null) {
            try { previous.cancel(); } catch (Exception ignored) { }
            try { previous.destroy(); } catch (Exception ignored) { }
        }
        if (notifyStopped && wasListening) notifySpeechState("stopped", "Tap-to-talk stopped.");
    }

    @Override
    protected void handleOnDestroy() {
        if (wakeWordReceiverRegistered && wakeWordReceiver != null) {
            try { getContext().unregisterReceiver(wakeWordReceiver); } catch (Exception ignored) { }
            wakeWordReceiverRegistered = false;
        }
        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                releaseSpeechRecognizer(false);
                if (textToSpeech != null) {
                    try { textToSpeech.stop(); } catch (Exception ignored) { }
                    try { textToSpeech.shutdown(); } catch (Exception ignored) { }
                    textToSpeech = null;
                    textToSpeechReady = false;
                }
            });
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void openNotificationAccessSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (intent.resolveActivity(getContext().getPackageManager()) == null) {
                call.reject("Android notification-access settings are not available on this device.");
                return;
            }
            getContext().startActivity(intent);
            success(call, "Opened Android notification access settings. Enable Aero only if you want a count of active notifications; notification text is not read or stored.");
        } catch (Exception error) {
            call.reject("Android could not open notification access settings.");
        }
    }

    @PluginMethod
    public void startWakeWord(PluginCall call) {
        String accessKey = call.getString("accessKey");
        if (accessKey == null || accessKey.trim().length() < 12 || accessKey.length() > 2048) {
            call.reject("Enter a valid Picovoice AccessKey. The key is not saved by Aero.");
            return;
        }
        if (!hasWakeWordModel()) {
            call.reject("The Android wake-word model is missing. Add aero-activate-android.ppn to native-android/assets and rebuild the APK.");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("notifications", call, "wakeWordNotificationPermissionsCallback");
            return;
        }
        continueWakeWordPermissionFlow(call);
    }

    @PermissionCallback
    private void wakeWordNotificationPermissionsCallback(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            continueWakeWordPermissionFlow(call);
        } else {
            call.reject("Notification permission is needed so the wake-word service can show its visible status and Stop control.");
        }
    }

    private void continueWakeWordPermissionFlow(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "wakeWordMicrophonePermissionsCallback");
            return;
        }
        startWakeWordAfterPermission(call);
    }

    @PermissionCallback
    private void wakeWordMicrophonePermissionsCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            startWakeWordAfterPermission(call);
        } else {
            call.reject("Microphone permission was not granted. Wake-word listening remains off.");
        }
    }

    private void startWakeWordAfterPermission(PluginCall call) {
        String accessKey = call.getString("accessKey");
        if (accessKey == null || !hasWakeWordModel()) {
            call.reject("Wake-word setup is incomplete. Check the AccessKey and Android keyword model.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                releaseSpeechRecognizer(true);
                Intent intent = new Intent(getContext(), AeroWakeWordService.class);
                intent.setAction(AeroWakeWordService.ACTION_START);
                intent.putExtra(AeroWakeWordService.EXTRA_ACCESS_KEY, accessKey.trim());
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
                else getContext().startService(intent);
                JSObject result = new JSObject();
                result.put("ok", true);
                result.put("message", "Wake-word service requested. Android should show a persistent notification with a Stop action. Listening depends on the configured model and AccessKey.");
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Android could not start wake-word listening. Open Aero in the foreground and try again.");
            }
        });
    }

    @PluginMethod
    public void stopWakeWord(PluginCall call) {
        try {
            getContext().stopService(new Intent(getContext(), AeroWakeWordService.class));
            success(call, "Wake-word service stopped. The microphone is no longer used by wake-word detection.");
        } catch (Exception error) {
            call.reject("Wake-word listening could not be stopped through the app. Use its persistent notification Stop action.");
        }
    }

    @PluginMethod
    public void requestBrightnessPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            success(call, "This Android version does not require the special brightness permission.");
            return;
        }
        if (Settings.System.canWrite(getContext())) {
            success(call, "Aero already has permission to adjust screen brightness.");
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("needsPermission", true);
            result.put("message", "Android opened the special permission page. Enable ‘Allow modifying system settings’, return to Aero, then try brightness again.");
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Android could not open the brightness permission page. You can change brightness from Quick Settings instead.");
        }
    }

    @PluginMethod
    public void setBrightness(PluginCall call) {
        Integer percent = call.getInt("level");
        if (percent == null || percent < 0 || percent > 100) {
            call.reject("Screen brightness must be a percentage from 0 to 100.");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.System.canWrite(getContext())) {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                JSObject result = new JSObject();
                result.put("ok", false);
                result.put("needsPermission", true);
                result.put("message", "Allow Aero to modify system settings on the Android page, return here, then repeat the brightness command. Brightness was not changed yet.");
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Aero needs Android’s ‘Modify system settings’ permission for screen brightness.");
            }
            return;
        }
        try {
            int safePercent = Math.max(1, percent); // Never set the display to absolute black.
            int brightness = Math.max(1, Math.min(255, Math.round(safePercent * 255.0f / 100.0f)));
            boolean modeWritten = Settings.System.putInt(getContext().getContentResolver(), Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL);
            boolean valueWritten = Settings.System.putInt(getContext().getContentResolver(), Settings.System.SCREEN_BRIGHTNESS, brightness);
            if (!valueWritten) {
                call.reject("Android did not accept the brightness change. Use Quick Settings instead.");
                return;
            }
            success(call, "Screen brightness set to approximately " + safePercent + " percent" + (modeWritten ? "." : "; automatic brightness mode may affect the result."));
        } catch (Exception error) {
            call.reject("Android could not change screen brightness. Check the special system-settings permission.");
        }
    }

    @PluginMethod
    public void speakText(PluginCall call) {
        String text = call.getString("text");
        String language = call.getString("language", "en-US");
        String style = call.getString("style", "tactical");
        if (text == null || text.trim().isEmpty() || text.length() > 400) {
            call.reject("Speech output must contain 1 to 400 characters.");
            return;
        }
        if ("auto".equals(language)) language = Locale.getDefault().toLanguageTag();
        if (!"en-US".equals(language) && !"en-GB".equals(language) && !"ur-PK".equals(language)
                && !"hi-IN".equals(language) && !"es-ES".equals(language) && !"fr-FR".equals(language)
                && !"de-DE".equals(language)) language = "en-US";
        if (!"natural".equals(style)) style = "tactical";
        final String languageTag = language;
        final String voiceStyle = style;
        final String speechText = text.trim().replaceAll("\\p{Cntrl}", " ");
        getActivity().runOnUiThread(() -> {
            if (textToSpeechInitializing) {
                call.reject("The Android speech engine is still starting. Try the next response again.");
                return;
            }
            if (textToSpeechReady && textToSpeech != null) {
                speakWithReadyEngine(call, speechText, languageTag, voiceStyle);
                return;
            }
            textToSpeechInitializing = true;
            textToSpeech = new TextToSpeech(getContext(), status -> getActivity().runOnUiThread(() -> {
                textToSpeechInitializing = false;
                if (status != TextToSpeech.SUCCESS || textToSpeech == null) {
                    call.reject("Android text-to-speech is unavailable. Check your system TTS engine or install a voice package.");
                    return;
                }
                textToSpeechReady = true;
                speakWithReadyEngine(call, speechText, languageTag, voiceStyle);
            }));
        });
    }

    private void speakWithReadyEngine(PluginCall call, String text, String languageTag, String voiceStyle) {
        try {
            Locale locale = Locale.forLanguageTag(languageTag);
            int languageResult = textToSpeech.setLanguage(locale);
            if (languageResult == TextToSpeech.LANG_MISSING_DATA || languageResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                call.reject("The installed Android TTS engine does not have a voice for " + languageTag + ". Install that voice or choose another language.");
                return;
            }
            boolean tactical = "tactical".equals(voiceStyle);
            // Pitch/rate are presentation controls; the installed TTS engine still supplies the actual voice.
            textToSpeech.setPitch(tactical ? 0.84f : 1.0f);
            textToSpeech.setSpeechRate(tactical ? 0.90f : 1.0f);
            int result = textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "aero-" + System.currentTimeMillis());
            if (result == TextToSpeech.ERROR) call.reject("Android speech output could not start.");
            else success(call, "Speaking response using Android text-to-speech.");
        } catch (Exception error) {
            call.reject("Android speech output could not start.");
        }
    }

    @PluginMethod
    public void stopSpeechOutput(PluginCall call) {
        if (textToSpeech != null) {
            try { textToSpeech.stop(); } catch (Exception ignored) { }
        }
        success(call, "Speech output stopped.");
    }

    @PluginMethod
    public void launchApp(PluginCall call) {
        String appName = call.getString("appName");
        if (appName == null) {
            call.reject("An allow-listed app name is required.");
            return;
        }
        String key = appName.trim().toLowerCase(Locale.ROOT);

        if ("phone".equals(key)) {
            launchIntent(call, new Intent(Intent.ACTION_DIAL), "Opened the dialer. No call was placed.");
            return;
        }

        String[] packages;
        switch (key) {
            case "youtube": packages = new String[]{"com.google.android.youtube"}; break;
            case "chrome": packages = new String[]{"com.android.chrome", "com.chrome.beta", "com.chrome.dev"}; break;
            case "camera": packages = new String[]{"com.google.android.GoogleCamera", "com.android.camera2", "com.android.camera", "com.sec.android.app.camera"}; break;
            case "whatsapp": packages = new String[]{"com.whatsapp"}; break;
            case "messages": packages = new String[]{"com.google.android.apps.messaging", "com.samsung.android.messaging", "com.android.mms"}; break;
            case "spotify": packages = new String[]{"com.spotify.music"}; break;
            case "files": packages = new String[]{"com.google.android.apps.nbu.files", "com.google.android.documentsui", "com.android.documentsui"}; break;
            case "calculator": packages = new String[]{"com.google.android.calculator", "com.sec.android.app.popupcalculator"}; break;
            default:
                call.reject("That app is not in Aero's approved launch list.");
                return;
        }

        PackageManager packageManager = getContext().getPackageManager();
        for (String packageName : packages) {
            Intent launchIntent = packageManager.getLaunchIntentForPackage(packageName);
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
                launchIntent.setPackage(packageName);
                launchIntent.addCategory(Intent.CATEGORY_LAUNCHER);
                try {
                    getContext().startActivity(launchIntent);
                    success(call, "Opened " + key + ".");
                    return;
                } catch (Exception ignored) {
                    // Try the next known package for variants such as vendor camera and files apps.
                }
            }
        }
        call.reject("No supported installed app was found for " + key + ". Check whether it is installed.");
    }

    @PluginMethod
    public void setMediaVolume(PluginCall call) {
        Integer percent = call.getInt("level");
        if (percent == null || percent < 0 || percent > 100) {
            call.reject("Media volume must be a percentage from 0 to 100.");
            return;
        }
        AudioManager audio = (AudioManager) getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
        if (audio == null) {
            call.reject("Android media audio service is unavailable.");
            return;
        }
        int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        int target = Math.round(max * (percent / 100.0f));
        audio.setStreamVolume(AudioManager.STREAM_MUSIC, target, AudioManager.FLAG_SHOW_UI);
        success(call, "Media volume set to approximately " + percent + " percent.");
    }

    @PluginMethod
    public void adjustMediaVolume(PluginCall call) {
        Integer direction = call.getInt("direction");
        if (direction == null || (direction != -1 && direction != 1)) {
            call.reject("Volume direction must be -1 or 1.");
            return;
        }
        AudioManager audio = (AudioManager) getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
        if (audio == null) {
            call.reject("Android media audio service is unavailable.");
            return;
        }
        int current = audio.getStreamVolume(AudioManager.STREAM_MUSIC);
        int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        int target = Math.max(0, Math.min(max, current + direction));
        audio.setStreamVolume(AudioManager.STREAM_MUSIC, target, AudioManager.FLAG_SHOW_UI);
        success(call, direction > 0 ? "Media volume increased." : "Media volume decreased.");
    }

    @PluginMethod
    public void prepareCall(PluginCall call) {
        String raw = call.getString("phoneNumber");
        String number = cleanPhoneNumber(raw);
        if (number == null) {
            call.reject("Enter a valid phone number. No call was placed.");
            return;
        }
        launchIntent(call, new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + number)),
            "Opened the dialer. Review the number and tap Call yourself; Aero did not place a call.");
    }

    @PluginMethod
    public void prepareText(PluginCall call) {
        String rawNumber = call.getString("recipient");
        String number = cleanPhoneNumber(rawNumber);
        String rawMessage = call.getString("message");
        String message = rawMessage == null ? "" : rawMessage.trim().replaceAll("\\p{Cntrl}", "");
        if (number == null || message.isEmpty() || message.length() > 300) {
            call.reject("A valid recipient number and message of 1 to 300 characters are required. Nothing was sent.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + number));
        intent.putExtra("sms_body", message);
        launchIntent(call, intent, "Opened a message draft. Review it and press Send yourself; Aero did not send a message.");
    }

    private String cleanPhoneNumber(String raw) {
        if (raw == null || !raw.matches("\\+?[0-9().\\-]{3,24}")) return null;
        String number = raw.replaceAll("[().\\-]", "");
        String digits = number.replaceAll("\\D", "");
        if (digits.length() < 3 || digits.length() > 18) return null;
        return number;
    }

    @PluginMethod
    public void openSystemSettings(PluginCall call) {
        launchIntent(call, new Intent(Settings.ACTION_SETTINGS), "Opened Android Settings.");
    }

    @PluginMethod
    public void openTimer(PluginCall call) {
        Integer seconds = call.getInt("seconds");
        if (seconds == null || seconds < 1 || seconds > 86400) {
            call.reject("Timer duration must be between 1 second and 24 hours.");
            return;
        }
        Intent intent = new Intent(AlarmClock.ACTION_SET_TIMER);
        intent.putExtra(AlarmClock.EXTRA_LENGTH, seconds);
        intent.putExtra(AlarmClock.EXTRA_MESSAGE, "Aero's JARVIS");
        intent.putExtra(AlarmClock.EXTRA_SKIP_UI, false);
        launchIntent(call, intent, "Opened the Clock timer with the requested duration. Confirm it in Clock to start it.");
    }

    @PluginMethod
    public void openUrl(PluginCall call) {
        String rawUrl = call.getString("url");
        if (rawUrl == null || rawUrl.length() > 2048) {
            call.reject("A valid HTTP or HTTPS URL is required.");
            return;
        }
        Uri uri = Uri.parse(rawUrl);
        String scheme = uri.getScheme();
        if (scheme == null || !("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) || uri.getHost() == null) {
            call.reject("Only valid HTTP and HTTPS links can be opened.");
            return;
        }
        launchIntent(call, new Intent(Intent.ACTION_VIEW, uri), "Opened the link in an installed browser.");
    }

    private void launchIntent(PluginCall call, Intent intent, String message) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (intent.resolveActivity(getContext().getPackageManager()) == null) {
                call.reject("No compatible Android app is available for this action.");
                return;
            }
            getContext().startActivity(intent);
            success(call, message);
        } catch (Exception error) {
            call.reject("Android could not complete that action.");
        }
    }
}
