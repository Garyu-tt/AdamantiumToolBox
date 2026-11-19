package com.adamantium.aicore;
import org.junit.Test;
import java.net.InetAddress;
import java.util.Arrays;
import static org.junit.Assert.*;

public class MeshRoutePolicyTest {
    @Test public void acceptsOverlayRoutes() {
        MeshRoutePolicy.validate(Arrays.asList("10.77.0.0/24","fd77::/64"));
    }
    @Test(expected=IllegalArgumentException.class)
    public void rejectsFullTunnel() { MeshRoutePolicy.validate(Arrays.asList("0.0.0.0/0")); }
    @Test(expected=IllegalArgumentException.class)
    public void rejectsIPv6DefaultRoute() { MeshRoutePolicy.validate(Arrays.asList("::/0")); }
    @Test public void matchesDestination() throws Exception {
        assertTrue(MeshRoutePolicy.contains(Arrays.asList("10.77.0.0/24"),
            InetAddress.getByName("10.77.0.17")));
        assertFalse(MeshRoutePolicy.contains(Arrays.asList("10.77.0.0/24"),
            InetAddress.getByName("10.78.0.17")));
    }
}
