package com.aero.jarvis;

import android.content.Intent;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/** Opt-in, count-only integration. It deliberately never reads notification extras or message text. */
public final class AeroNotificationListenerService extends NotificationListenerService {
    private static volatile int activeCount = 0;
    private static final String ACTION_COUNT = "com.aero.jarvis.NOTIFICATION_COUNT";

    public static int getActiveCount() { return activeCount; }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        publishCount();
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        publishCount();
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        publishCount();
    }

    @Override
    public void onListenerDisconnected() {
        activeCount = 0;
        publishCount();
        super.onListenerDisconnected();
    }

    private void publishCount() {
        try {
            StatusBarNotification[] notifications = getActiveNotifications();
            activeCount = notifications == null ? 0 : notifications.length;
        } catch (SecurityException | IllegalStateException error) {
            activeCount = 0;
        }
        Intent event = new Intent(ACTION_COUNT);
        event.setPackage(getPackageName());
        event.putExtra("count", activeCount);
        sendBroadcast(event);
    }
}
