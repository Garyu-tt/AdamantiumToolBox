package com.adamantium.aicore;

import android.content.*;
import android.util.Log;

/** Best-effort restart ONLY after an explicit persisted operator opt-in. */
public final class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!Settings.prefs(context).getBoolean(Settings.ENABLED, false) ||
            !Settings.configured(context)) return;
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) &&
            !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) return;
        try {
            context.startForegroundService(new Intent(context, WatchdogService.class));
        } catch (RuntimeException e) {
            Log.w("AiCoreBoot", "Android denied best-effort watchdog restart: " +
                e.getClass().getSimpleName());
        }
    }
}
