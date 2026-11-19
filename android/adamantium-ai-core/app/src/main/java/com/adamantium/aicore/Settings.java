package com.adamantium.aicore;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import java.net.URI;

final class Settings {
    private static final String NAME = "ai_core_operator_config";
    static final String GATEWAY = "gateway";
    static final String PIN = "pin";
    static final String CHAT = "chat";
    static final String ENABLED = "enabled";

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    static String httpsBase(String value) {
        try {
            URI u = URI.create(value.trim());
            if (!"https".equalsIgnoreCase(u.getScheme()) || u.getHost() == null ||
                u.getUserInfo() != null || u.getQuery() != null || u.getFragment() != null ||
                !(u.getPath().isEmpty() || "/".equals(u.getPath()))) {
                throw new IllegalArgumentException("Expected HTTPS origin only");
            }
            return u.getScheme().toLowerCase() + "://" + u.getRawAuthority();
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("Gateway must be HTTPS origin (no path or credentials)", e);
        }
    }

    static String httpsChat(String value) {
        try {
            URI u = URI.create(value.trim());
            if (!"https".equalsIgnoreCase(u.getScheme()) || u.getHost() == null || u.getUserInfo() != null)
                throw new IllegalArgumentException();
            return value.trim();
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("Chat must be an HTTPS URL", e);
        }
    }

    static String checkedPin(String value) {
        try {
            byte[] bytes = Base64.decode(value.trim(), Base64.DEFAULT);
            if (bytes.length != 32) throw new IllegalArgumentException();
            return Base64.encodeToString(bytes, Base64.NO_WRAP);
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("SPKI pin must be 32-byte Base64 SHA-256", e);
        }
    }

    static boolean configured(Context context) {
        SharedPreferences p = prefs(context);
        try {
            httpsBase(p.getString(GATEWAY, ""));
            checkedPin(p.getString(PIN, ""));
            return true;
        } catch (RuntimeException e) { return false; }
    }
}
