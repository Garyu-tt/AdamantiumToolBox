package com.adamantium.aicore;

import android.content.Context;
import android.util.Base64;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.cert.Certificate;
import java.util.UUID;
import javax.net.ssl.HttpsURLConnection;

final class PoolClient {
    private static final int MAX_RESPONSE = 131072;

    static JSONObject post(Context context, String path, JSONObject data) throws Exception {
        if (!path.equals("/api/ai-core/v1/pulse") && !path.equals("/api/ai-core/v1/results"))
            throw new SecurityException("Not an enrolled gateway action");
        String base = Settings.httpsBase(Settings.prefs(context).getString(Settings.GATEWAY, ""));
        WireGuardMesh.requireGatewayRoute(context, new URL(base).getHost());
        String pin = Settings.checkedPin(Settings.prefs(context).getString(Settings.PIN, ""));
        byte[] expected = Base64.decode(pin, Base64.NO_WRAP);
        byte[] body = data.toString().getBytes(StandardCharsets.UTF_8);
        String timestamp = Long.toString(System.currentTimeMillis());
        String requestId = UUID.randomUUID().toString();
        byte[] bodyHash = MessageDigest.getInstance("SHA-256").digest(body);
        String signed = "POST\n" + path + "\n" + timestamp + "\n" + requestId + "\n" +
            Base64.encodeToString(bodyHash, Base64.NO_WRAP);
        String signature = Base64.encodeToString(
            Identity.sign(signed.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);

        HttpsURLConnection c = (HttpsURLConnection) new URL(base + path).openConnection();
        try {
            c.setConnectTimeout(7000);
            c.setReadTimeout(7000);
            c.setInstanceFollowRedirects(false);
            c.setUseCaches(false);
            c.setDoOutput(true);
            c.setRequestMethod("POST");
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            c.setRequestProperty("X-AI-Core-Node", Identity.nodeId());
            c.setRequestProperty("X-AI-Core-Key", Identity.publicKeyBase64());
            c.setRequestProperty("X-AI-Core-Timestamp", timestamp);
            c.setRequestProperty("X-AI-Core-Request", requestId);
            c.setRequestProperty("X-AI-Core-Signature", signature);
            c.setFixedLengthStreamingMode(body.length);

            // Establish validated HTTPS before sending signed material or task result.
            c.connect();
            Certificate[] chain = c.getServerCertificates();  // default platform TLS + hostname validation
            if (chain.length == 0) throw new SecurityException("No TLS peer cert");
            byte[] actual = MessageDigest.getInstance("SHA-256")
                .digest(chain[0].getPublicKey().getEncoded());
            if (!MessageDigest.isEqual(expected, actual))
                throw new SecurityException("Gateway TLS SPKI pin mismatch");

            try (java.io.OutputStream os = c.getOutputStream()) { os.write(body); }
            if (c.getResponseCode() != 200)
                throw new IllegalStateException("Gateway rejected request (HTTP " + c.getResponseCode() + ")");
            try (InputStream in = c.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[4096];
                int n;
                while ((n = in.read(buf)) != -1) {
                    if (out.size() + n > MAX_RESPONSE)
                        throw new IllegalArgumentException("Excessive gateway response");
                    out.write(buf, 0, n);
                }
                return new JSONObject(out.toString(StandardCharsets.UTF_8.name()));
            }
        } finally { c.disconnect(); }
    }
}
