package com.adamantium.aicore;

import android.content.Context;
import android.net.VpnService;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Log;
import com.wireguard.android.backend.GoBackend;
import com.wireguard.android.backend.Tunnel;
import com.wireguard.config.Config;
import com.wireguard.config.InetNetwork;
import com.wireguard.config.Peer;
import java.io.*;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

/** Android-only runtime transport. This never provisions or administers remote servers. */
final class WireGuardMesh {
    static final String ENABLED = "mesh_enabled";
    private static final String FILE = "mesh-profile.aesgcm";
    private static final String KEY = "adamantium.ai.core.mesh.profile.v1";
    private static final int MAX_CONFIG_BYTES = 64 * 1024;
    private static final ExecutorService worker = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean connecting = new AtomicBoolean(false);
    private static volatile GoBackend backend;
    private static volatile boolean up;
    private static final Tunnel tunnel = new Tunnel() {
        @Override public String getName() { return "adamantiummesh"; }
        @Override public void onStateChange(State state) { up = state == State.UP; }
    };

    static boolean hasProfile(Context c) { return new File(c.getFilesDir(), FILE).isFile(); }
    static boolean isUp() { return up && backend != null && backend.getState(tunnel) == Tunnel.State.UP; }

    private static SecretKey secret() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(KEY)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(KEY,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).build());
            generator.generateKey();
        }
        return ((KeyStore.SecretKeyEntry) store.getEntry(KEY,null)).getSecretKey();
    }

    private static byte[] readBounded(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] b = new byte[4096];
        int n;
        while ((n = in.read(b)) >= 0) {
            if (out.size() + n > MAX_CONFIG_BYTES) throw new IOException("WireGuard profile too large");
            out.write(b,0,n);
        }
        return out.toByteArray();
    }

    private static Config parse(byte[] raw) throws Exception {
        Config cfg = Config.parse(new ByteArrayInputStream(raw));
        if (cfg.getPeers().isEmpty() || cfg.getInterface().getAddresses().isEmpty())
            throw new IllegalArgumentException("Mesh profile requires addresses and peers");
        List<String> routes = new ArrayList<>();
        for (Peer peer: cfg.getPeers()) {
            for (InetNetwork network: peer.getAllowedIps()) routes.add(network.toString());
        }
        MeshRoutePolicy.validate(routes);
        if (!cfg.getInterface().getIncludedApplications().isEmpty() ||
            !cfg.getInterface().getExcludedApplications().isEmpty())
            throw new IllegalArgumentException("Per-app tunnel routing is not supported in R02");
        return cfg;
    }

    static synchronized void importProfile(Context c, InputStream input) throws Exception {
        byte[] raw = readBounded(input);
        Config cfg = parse(raw);
        // Store a normalized, validated profile encrypted with Android Keystore.
        byte[] data = cfg.toWgQuickString().getBytes(StandardCharsets.UTF_8);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, secret());
        byte[] iv = cipher.getIV(), encrypted = cipher.doFinal(data);
        File target = new File(c.getFilesDir(), FILE);
        File temporary = new File(c.getFilesDir(), FILE+".new");
        try (FileOutputStream stream = new FileOutputStream(temporary)) {
            stream.write(iv); stream.write(encrypted);
            stream.getFD().sync();
        }
        if (!temporary.renameTo(target)) {
            temporary.delete();
            throw new IOException("Could not atomically save mesh profile");
        }
    }

    private static Config load(Context c) throws Exception {
        byte[] encrypted;
        try (FileInputStream stream = new FileInputStream(new File(c.getFilesDir(),FILE))) {
            encrypted = readBounded(stream);
        }
        if (encrypted.length < 29) throw new IOException("Corrupt mesh profile");
        byte[] iv=Arrays.copyOfRange(encrypted,0,12);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, secret(), new GCMParameterSpec(128,iv));
        return parse(cipher.doFinal(encrypted,12,encrypted.length-12));
    }

    static void ensureConnected(Context c) {
        if (!Settings.prefs(c).getBoolean(ENABLED,false) || !hasProfile(c) ||
            isUp() || VpnService.prepare(c) != null || !connecting.compareAndSet(false,true)) return;
        Context app = c.getApplicationContext();
        worker.execute(() -> {
            try {
                if (!Settings.prefs(app).getBoolean(ENABLED,false)) return;
                if (backend == null) backend = new GoBackend(app);
                backend.setState(tunnel,Tunnel.State.UP,load(app));
                up = backend.getState(tunnel) == Tunnel.State.UP;
            } catch (Exception error) {
                up = false;
                Log.w("AiCoreMesh","Tunnel unavailable: "+error.getClass().getSimpleName());
            } finally { connecting.set(false); }
        });
    }

    static void stop(Context c) {
        Settings.prefs(c).edit().putBoolean(ENABLED,false).apply();
        worker.execute(() -> {
            try { if (backend != null) backend.setState(tunnel,Tunnel.State.DOWN,null); }
            catch (Exception e) { Log.w("AiCoreMesh","Tunnel stop: "+e.getClass().getSimpleName()); }
            finally { up=false; }
        });
    }

    /** Reject HTTPS destinations outside the operator's approved WireGuard overlay ranges. */
    static void requireGatewayRoute(Context c, String host) throws Exception {
        if (!isUp()) throw new SecurityException("Mesh tunnel not UP");
        Set<String> routes = new HashSet<>();
        for (Peer p:load(c).getPeers()) for(InetNetwork n:p.getAllowedIps()) routes.add(n.toString());
        InetAddress[] addresses = InetAddress.getAllByName(host);
        if (addresses.length==0) throw new SecurityException("Gateway unresolved");
        for (InetAddress address:addresses) {
            if (!MeshRoutePolicy.contains(routes,address))
                throw new SecurityException("Gateway address is outside WireGuard mesh routes");
        }
    }
}
