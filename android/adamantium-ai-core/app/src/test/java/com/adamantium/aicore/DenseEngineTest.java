package com.adamantium.aicore;

import org.junit.Test;
import static org.junit.Assert.*;

public class DenseEngineTest {
    @Test public void denseWithRelu() {
        float[] actual = DenseEngine.infer(
            new float[]{2f, -1f},
            new float[][]{{3f, 4f}, {-1f, 1f}},
            new float[]{1f, 0f}, true);
        assertArrayEquals(new float[]{3f, 0f}, actual, 1e-6f);
    }

    @Test public void denseWithoutActivation() {
        float[] actual = DenseEngine.infer(
            new float[]{2f, -1f},
            new float[][]{{3f, 4f}, {-1f, 1f}},
            new float[]{1f, 0f}, false);
        assertArrayEquals(new float[]{3f, -3f}, actual, 1e-6f);
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectNonFiniteTensor() {
        DenseEngine.infer(new float[]{Float.NaN},
            new float[][]{{1f}}, new float[]{0f}, false);
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectDimensionMismatch() {
        DenseEngine.infer(new float[]{1f, 2f},
            new float[][]{{1f}}, new float[]{0f}, false);
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectOversizedLayers() {
        DenseEngine.infer(new float[65],
            new float[][]{{1f}}, new float[]{0f}, false);
    }

    @Test(expected = IllegalStateException.class)
    public void honorsCancellation() {
        Thread.currentThread().interrupt();
        try {
            DenseEngine.infer(new float[]{1f}, new float[][]{{1f}}, new float[]{0f}, false);
        } finally {
            Thread.interrupted();
        }
    }
}
