package com.aero.jarvis;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.Handler;
import android.os.Looper;

import androidx.core.app.NotificationCompat;

import ai.picovoice.porcupine.PorcupineException;
import ai.picovoice.porcupine.PorcupineManager;

/** User-started foreground service. Captures audio only while explicitly enabled. */
public final class AeroWakeWordService extends Service {
    public static final String ACTION_START = "com.aero.jarvis.wake.START";
    public static final String ACTION_STOP = "com.aero.jarvis.wake.STOP";
    public static final String ACTION_WAKE_WORD_DETECTED = "com.aero.jarvis.wake.DETECTED";
    public static final String EXTRA_ACCESS_KEY = "picovoice_access_key";
    public static final String MODEL_ASSET = "aero-activate-android.ppn";
    private static final String CHANNEL_ID = "aero_wake_word";
    private static final int NOTIFICATION_ID = 4401;
    private static volatile boolean detecting = false;
    private static volatile boolean triggered = false;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private PorcupineManager porcupineManager;

    public static boolean isDetecting() { return detecting; }
    public static boolean wasTriggered() { return triggered; }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_STOP : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopAndRelease();
            return START_NOT_STICKY;
        }
        if (!ACTION_START.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (porcupineManager != null && detecting) return START_NOT_STICKY;
        String accessKey = intent.getStringExtra(EXTRA_ACCESS_KEY);
        if (accessKey == null || accessKey.trim().isEmpty()) {
            stopSelf();
            return START_NOT_STICKY;
        }
        try {
            startForeground(NOTIFICATION_ID, buildNotification("Wake phrase active · say “Activate Aero AI”", true), ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            triggered = false;
            porcupineManager = new PorcupineManager.Builder()
                .setAccessKey(accessKey.trim())
                .setKeywordPaths(new String[]{MODEL_ASSET})
                .build(getApplicationContext(), keywordIndex -> {
                    if (keywordIndex == 0) mainHandler.post(this::onWakeWordDetected);
                });
            porcupineManager.start();
            detecting = true;
        } catch (Exception error) {
            releaseDetector();
            detecting = false;
            triggered = false;
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            sendStatus("Wake-word engine failed to start. Check the AccessKey, Android keyword model, and network authorization.");
        }
        return START_NOT_STICKY;
    }

    private void onWakeWordDetected() {
        if (!detecting) return;
        triggered = true;
        releaseDetector();
        detecting = false;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification("Wake phrase detected · tap to open Aero", false));
        Intent event = new Intent(ACTION_WAKE_WORD_DETECTED);
        event.setPackage(getPackageName());
        sendBroadcast(event);
    }

    private Notification buildNotification(String status, boolean activelyListening) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(this, 1, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent stopIntent = new Intent(this, AeroWakeWordService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(this, 2, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon == 0 ? android.R.drawable.ic_btn_speak_now : getApplicationInfo().icon)
            .setContentTitle("Aero's JARVIS")
            .setContentText(status)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(activelyListening
                ? "The microphone is active for on-device wake-word detection. Tap Stop to end listening."
                : "Wake listening is paused after detection. Open Aero and tap the microphone to give a command."))
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW);
        if (activelyListening) builder.addAction(android.R.drawable.ic_media_pause, "Stop", stopPending);
        else builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopPending);
        return builder.build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Aero wake-word listening", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Persistent status and stop control while the wake phrase is enabled.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private void sendStatus(String message) {
        Intent event = new Intent("com.aero.jarvis.wake.ERROR");
        event.setPackage(getPackageName());
        event.putExtra("message", message);
        sendBroadcast(event);
    }

    private void releaseDetector() {
        PorcupineManager current = porcupineManager;
        porcupineManager = null;
        if (current != null) {
            try { current.stop(); } catch (Exception ignored) { }
            try { current.delete(); } catch (Exception ignored) { }
        }
    }

    private void stopAndRelease() {
        detecting = false;
        triggered = false;
        releaseDetector();
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        detecting = false;
        triggered = false;
        releaseDetector();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
