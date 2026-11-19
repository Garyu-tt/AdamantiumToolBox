package com.adamantium.aicore;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import org.json.JSONArray;
import org.json.JSONObject;

final class DeviceProbe {
    static JSONObject snapshot(Context context) throws Exception {
        ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
        manager.getMemoryInfo(memory);
        Intent battery = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        int charge = battery == null ? -1 : battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = battery == null ? -1 : battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
        int percent = scale > 0 ? (charge * 100 / scale) : -1;
        int plugged = battery == null ? 0 : battery.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0);
        boolean charging = plugged != 0;
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        int thermal = power.getCurrentThermalStatus();

        JSONObject metrics = new JSONObject();
        metrics.put("api", Build.VERSION.SDK_INT);
        metrics.put("abis", new JSONArray(java.util.Arrays.asList(Build.SUPPORTED_ABIS)));
        metrics.put("cpuThreads", Runtime.getRuntime().availableProcessors());
        metrics.put("totalMemoryBytes", memory.totalMem);
        metrics.put("availableMemoryBytes", memory.availMem);
        metrics.put("batteryPercent", percent);
        metrics.put("charging", charging);
        metrics.put("thermalStatus", thermal);
        metrics.put("batteryLow", memory.lowMemory); // OS memory pressure
        return metrics;
    }

    static boolean canCompute(JSONObject metrics) {
        int battery = metrics.optInt("batteryPercent", -1);
        return (metrics.optBoolean("charging") || battery >= 40) &&
            metrics.optInt("thermalStatus", 99) <= PowerManager.THERMAL_STATUS_MODERATE &&
            !metrics.optBoolean("batteryLow", true) &&
            metrics.optLong("availableMemoryBytes", 0) >= 128L * 1024 * 1024;
    }
}
