package com.adamantium.aicore;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.concurrent.*;

public final class WatchdogService extends Service {
    private static final String CHANNEL = "ai_core_pool";
    private static final int NOTIFICATION_ID = 2117;
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "ai-core-watchdog");
        t.setDaemon(true);
        return t;
    });
    private ScheduledFuture<?> schedule;

    @Override public void onCreate() {
        super.onCreate();
        NotificationChannel channel = new NotificationChannel(
            CHANNEL, "Adamantium AI compute", NotificationManager.IMPORTANCE_LOW);
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
    }

    private Notification notification() {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(this, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL)
            .setContentTitle("Adamantium AI Core")
            .setContentText("Opt-in compute gateway active; Android may suspend execution")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentIntent(pending)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .build();
    }

    @Override public synchronized int onStartCommand(Intent intent, int flags, int startId) {
        if (!Settings.prefs(this).getBoolean(Settings.ENABLED, false) || !Settings.configured(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        try {
            if (Build.VERSION.SDK_INT >= 34)
                startForeground(NOTIFICATION_ID, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            else startForeground(NOTIFICATION_ID, notification());
            if (schedule == null || schedule.isCancelled()) {
                schedule = executor.scheduleWithFixedDelay(this::safePulse, 0, 45, TimeUnit.SECONDS);
            }
            return START_STICKY;
        } catch (RuntimeException e) {
            Log.w("AiCoreWatchdog", "Foreground service unavailable: " + e.getClass().getSimpleName());
            stopSelf();
            return START_NOT_STICKY;
        }
    }

    private void safePulse() {
        if (!Settings.prefs(this).getBoolean(Settings.ENABLED, false) ||
            !Settings.configured(this) || Thread.currentThread().isInterrupted()) return;
        try {
            JSONObject metrics = DeviceProbe.snapshot(this);
            boolean ready = DeviceProbe.canCompute(metrics);
            JSONObject capability = new JSONObject()
                .put("op", "ml.dense.f32")
                .put("backend", "cpu-java")
                .put("maxInput", DenseEngine.MAX_DIM)
                .put("maxOutput", DenseEngine.MAX_DIM)
                .put("precision", "f32");
            JSONObject payload = new JSONObject()
                .put("protocol", "android-ai-pool-v1")
                .put("nodeId", Identity.nodeId())
                .put("metrics", metrics)
                .put("ready", ready)
                .put("capabilities", new JSONArray().put(capability))
                .put("clientTimestampMs", System.currentTimeMillis());
            JSONObject response = PoolClient.post(this, "/api/ai-core/v1/pulse", payload);
            JSONObject job = response.optJSONObject("job");
            if (job == null || !ready ||
                !Settings.prefs(this).getBoolean(Settings.ENABLED, false) ||
                !DeviceProbe.canCompute(DeviceProbe.snapshot(this))) return;
            JSONObject result = JobExecutor.execute(job);
            if (Settings.prefs(this).getBoolean(Settings.ENABLED, false))
                PoolClient.post(this, "/api/ai-core/v1/results", result);
        } catch (Exception e) {
            // Failed handshake/lease does not grant permission for alternate transport or credentials.
            Log.w("AiCoreWatchdog", "Pulse failed: " + e.getClass().getSimpleName());
        }
    }

    @Override public synchronized void onDestroy() {
        if (schedule != null) schedule.cancel(true);
        executor.shutdownNow();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
