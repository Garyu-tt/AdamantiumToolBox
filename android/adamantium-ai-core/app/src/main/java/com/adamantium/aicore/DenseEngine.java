package com.adamantium.aicore;

/** Bounded, pure-Java neural dense layer; no Android-specific dependencies. */
public final class DenseEngine {
    public static final int MAX_DIM = 64;
    private DenseEngine() {}

    public static float[] infer(float[] input, float[][] weights, float[] bias, boolean relu) {
        if (input == null || weights == null || bias == null ||
            input.length == 0 || input.length > MAX_DIM ||
            weights.length == 0 || weights.length > MAX_DIM || bias.length != weights.length)
            throw new IllegalArgumentException("Dense dimensions exceed negotiated limits");
        float[] output = new float[weights.length];
        for (int y = 0; y < weights.length; ++y) {
            if (Thread.currentThread().isInterrupted()) throw new IllegalStateException("Cancelled");
            if (weights[y] == null || weights[y].length != input.length || !Float.isFinite(bias[y]))
                throw new IllegalArgumentException("Malformed weights / bias");
            float value = bias[y];
            for (int x = 0; x < input.length; ++x) {
                if (!Float.isFinite(input[x]) || !Float.isFinite(weights[y][x]))
                    throw new IllegalArgumentException("Non-finite tensor");
                value += input[x] * weights[y][x];
            }
            if (!Float.isFinite(value)) throw new IllegalArgumentException("Numerical overflow");
            output[y] = relu ? Math.max(0f, value) : value;
        }
        return output;
    }
}
