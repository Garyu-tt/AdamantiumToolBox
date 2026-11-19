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
    private static final int WG_IMPORT=71, MODEL_IMPORT=72, VPN_PERMISSION=73;

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


        button(root, "Import WireGuard mesh profile (.conf)", v -> {
            Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            pick.setType("*/*"); pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION |
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
            startActivityForResult(pick,WG_IMPORT);
        });
        button(root, "Connect WireGuard mesh", v -> {
            if (!WireGuardMesh.hasProfile(this)) { show("Import an approved mesh profile first."); return; }
            Intent consent = android.net.VpnService.prepare(this);
            if (consent != null) startActivityForResult(consent,VPN_PERMISSION);
            else enableMesh();
        });
        button(root, "Disconnect WireGuard mesh", v -> {
            WireGuardMesh.stop(this); show("WireGuard disconnect requested; pool traffic gated.");
        });
        button(root, "Import model artifact", v -> {
            Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            pick.setType("*/*"); pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION |
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
            startActivityForResult(pick,MODEL_IMPORT);
        });
        button(root, "List model artifacts", v -> {
            try { show(ModelRegistry.list(this).toString(2)); }
            catch (Exception e) { show("Model registry unavailable: "+e.getClass().getSimpleName()); }
        });
        root.addView(text("Mesh: "+(WireGuardMesh.isUp()?"UP":"DOWN")+
            " | Profile: "+(WireGuardMesh.hasProfile(this)?"imported":"missing")+
            ". Imported weights are registered for future backends, not claimed as executing LLMs."));
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

    private void enableMesh() {
        Settings.prefs(this).edit().putBoolean(WireGuardMesh.ENABLED,true).apply();
        WireGuardMesh.ensureConnected(this);
        show("Mesh connection requested; tunnel state becomes UP after backend setup.");
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request,result,data);
        if (request==VPN_PERMISSION) {
            if(result==RESULT_OK) enableMesh();
            else show("VPN permission denied; tunnel remains inactive.");
            return;
        }
        if (result!=RESULT_OK || data==null || data.getData()==null) return;
        try {
            if (request==WG_IMPORT) {
                try (java.io.InputStream in=getContentResolver().openInputStream(data.getData())) {
                    if (in==null) throw new java.io.IOException("Empty document stream");
                    WireGuardMesh.importProfile(this,in);
                }
                show("WireGuard profile encrypted in Android Keystore-backed app storage.");
            } else if (request==MODEL_IMPORT) {
                org.json.JSONObject m=ModelRegistry.importModel(this,data.getData(),data.getFlags());
                show("Model artifact registered: "+m.getString("name")+
                    " (weights not loaded until an inference backend is installed)");
            }
        } catch (Exception e) {
            show("Import rejected: "+e.getClass().getSimpleName()+" - "+e.getMessage());
        }
    }
}
