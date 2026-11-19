package com.adamantium.aicore;

import android.Manifest;
import android.app.Activity;
import android.content.*;
import android.os.*;
import android.text.InputType;
import android.view.View;
import android.widget.*;

public final class MainActivity extends Activity {
    private EditText gateway, pin, chat;
    private TextView status;

    private TextView text(String value) {
        TextView t = new TextView(this);
        t.setText(value);
        t.setTextSize(15);
        t.setPadding(0, 12, 0, 6);
        return t;
    }

    private EditText field(LinearLayout root, String title, String saved) {
        root.addView(text(title));
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setText(saved);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        root.addView(input);
        return input;
    }

    private void button(LinearLayout root, String title, View.OnClickListener click) {
        Button b = new Button(this);
        b.setText(title);
        b.setOnClickListener(click);
        root.addView(b);
    }

    private void show(String message) { status.setText(message); }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setPadding(24, 24, 24, 24);
        root.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(root);
        setContentView(scroll);

        root.addView(text("ADAMANTIUM AI CORE\nMobile AI worker + permissioned phone gateway"));
        try {
            root.addView(text("Node fingerprint (enroll explicitly on your pool):\n" + Identity.nodeId()));
            root.addView(text("Public signing key (Base64 DER):\n" + Identity.publicKeyBase64()));
        } catch (Exception e) { root.addView(text("Device key unavailable: " + e.getClass().getSimpleName())); }
        android.content.SharedPreferences p = Settings.prefs(this);
        gateway = field(root, "Gateway HTTPS origin (no embedded server default)", p.getString(Settings.GATEWAY, ""));
        pin = field(root, "Gateway certificate SPKI SHA-256 Base64", p.getString(Settings.PIN, ""));
        chat = field(root, "Chat HTTPS URL (optional remote Conversation Hub)", p.getString(Settings.CHAT, ""));
        status = text(p.getBoolean(Settings.ENABLED, false) ? "Pool opt-in enabled" : "Pool opt-in disabled");
        root.addView(status);

        button(root, "Save configuration", v -> {
            try {
                String host = Settings.httpsBase(gateway.getText().toString());
                String checked = Settings.checkedPin(pin.getText().toString());
                String chatUrl = chat.getText().toString().trim();
                if (!chatUrl.isEmpty()) chatUrl = Settings.httpsChat(chatUrl);
                p.edit().putString(Settings.GATEWAY, host).putString(Settings.PIN, checked)
                    .putString(Settings.CHAT, chatUrl).apply();
                show("Saved. Enroll displayed node public key on your trusted gateway.");
            } catch (Exception e) { show(e.getMessage()); }
        });

        button(root, "Start pool watchdog (opt-in)", v -> {
            if (!Settings.configured(this)) { show("Save a valid HTTPS gateway and SPKI pin first."); return; }
            if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
                    android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 4);
            }
            p.edit().putBoolean(Settings.ENABLED, true).apply();
            try {
                startForegroundService(new Intent(this, WatchdogService.class));
                show("Watchdog start requested; see persistent notification and gateway enrollment.");
            } catch (RuntimeException e) {
                p.edit().putBoolean(Settings.ENABLED, false).apply();
                show("Android rejected background service start: " + e.getClass().getSimpleName());
            }
        });

        button(root, "Stop contributing", v -> {
            p.edit().putBoolean(Settings.ENABLED, false).apply();
            stopService(new Intent(this, WatchdogService.class));
            show("Stopped locally. Coordinator must expire outstanding leases.");
        });

        button(root, "Open configured chat", v -> {
            try {
                String u = Settings.httpsChat(p.getString(Settings.CHAT, ""));
                startActivity(new Intent(this, ChatActivity.class).putExtra("url", u));
            } catch (Exception e) { show("Set chat HTTPS URL first."); }
        });
        root.addView(text("R01: CPU dense-layer tasks only. No arbitrary remote phone control. " +
            "Thermal/battery gates and Android service restrictions apply. " +
            "Remote chat requires a separately deployed chat server."));
    }
}
