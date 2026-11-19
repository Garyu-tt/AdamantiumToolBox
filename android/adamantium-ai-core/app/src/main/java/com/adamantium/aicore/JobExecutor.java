package com.adamantium.aicore;

import org.json.JSONArray;
import org.json.JSONObject;

/** A lease may trigger ONLY an explicitly compiled, bounded operation. */
final class JobExecutor {
    private static float[] readVector(JSONArray a) throws Exception {
        if (a == null || a.length() < 1 || a.length() > DenseEngine.MAX_DIM)
            throw new IllegalArgumentException("Vector exceeds limit");
        float[] v = new float[a.length()];
        for (int i=0; i<v.length; i++) {
            double d = a.getDouble(i);
            if (!Double.isFinite(d) || Math.abs(d) > 1000000d)
                throw new IllegalArgumentException("Non-finite or excessive vector value");
            v[i] = (float)d;
        }
        return v;
    }

    static JSONObject execute(JSONObject job) throws Exception {
        String id = job.getString("id");
        if (!id.matches("[A-Za-z0-9_-]{1,128}"))
            throw new IllegalArgumentException("Invalid lease ID");
        if (!"ml.dense.f32".equals(job.getString("op")))
            throw new IllegalArgumentException("Unsupported capability");
        long expires = job.getLong("expiresAtMs");
        long now = System.currentTimeMillis();
        if (expires <= now || expires > now + 60000)
            throw new IllegalArgumentException("Missing or excessive lease deadline");

        float[] input = readVector(job.getJSONArray("input"));
        JSONArray raw = job.getJSONArray("weights");
        if (raw.length() < 1 || raw.length() > DenseEngine.MAX_DIM)
            throw new IllegalArgumentException("Excessive output size");
        float[][] weights = new float[raw.length()][];
        for (int i=0; i<weights.length; i++) weights[i] = readVector(raw.getJSONArray(i));
        float[] bias = readVector(job.getJSONArray("bias"));
        String activation = job.optString("activation", "none");
        if (!activation.equals("none") && !activation.equals("relu"))
            throw new IllegalArgumentException("Activation not supported");

        float[] result = DenseEngine.infer(input, weights, bias, activation.equals("relu"));
        if (System.currentTimeMillis() >= expires)
            throw new IllegalArgumentException("Lease expired during computation");

        JSONArray values = new JSONArray();
        for (float v : result) values.put(v);
        return new JSONObject()
            .put("jobId", id)
            .put("op", "ml.dense.f32")
            .put("result", values)
            .put("completedAtMs", System.currentTimeMillis());
    }
}
