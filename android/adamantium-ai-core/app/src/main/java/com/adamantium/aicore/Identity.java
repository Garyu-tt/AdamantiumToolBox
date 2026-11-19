package com.adamantium.aicore;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.*;
import java.security.cert.Certificate;
import java.security.spec.ECGenParameterSpec;

final class Identity {
    private static final String ALIAS = "adamantium_ai_core_device_r01";

    private static KeyStore store() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        return ks;
    }

    static synchronized PublicKey publicKey() throws Exception {
        KeyStore ks = store();
        if (!ks.containsAlias(ALIAS)) {
            KeyPairGenerator g = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore");
            KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                ALIAS, KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY)
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
                .build();
            g.initialize(spec);
            g.generateKeyPair();
        }
        Certificate cert = store().getCertificate(ALIAS);
        if (cert == null) throw new GeneralSecurityException("Device key unavailable");
        return cert.getPublicKey();
    }

    static byte[] sign(byte[] payload) throws Exception {
        publicKey();
        Key key = store().getKey(ALIAS, null);
        if (!(key instanceof PrivateKey)) throw new GeneralSecurityException("No private device key");
        Signature s = Signature.getInstance("SHA256withECDSA");
        s.initSign((PrivateKey) key);
        s.update(payload);
        return s.sign();
    }

    static String publicKeyBase64() throws Exception {
        return Base64.encodeToString(publicKey().getEncoded(), Base64.NO_WRAP);
    }

    static String nodeId() throws Exception {
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(publicKey().getEncoded());
        StringBuilder b = new StringBuilder();
        for (byte v : hash) b.append(String.format(java.util.Locale.ROOT, "%02x", v & 255));
        return b.toString();
    }
}
