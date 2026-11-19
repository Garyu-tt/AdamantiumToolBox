package com.adamantium.aicore;

import java.net.InetAddress;
import java.util.Collection;

/** Pure routing guard: a model/pool mesh must not silently become a full-device VPN. */
public final class MeshRoutePolicy {
    private MeshRoutePolicy() {}

    public static void validate(Collection<String> cidrs) {
        if (cidrs == null || cidrs.isEmpty()) throw new IllegalArgumentException("No mesh routes");
        for (String route : cidrs) {
            if (route == null || !route.matches("(?i)[0-9a-f:.]+/[0-9]{1,3}"))
                throw new IllegalArgumentException("Malformed mesh route");
            int slash = route.lastIndexOf('/');
            int prefix = Integer.parseInt(route.substring(slash + 1));
            String address = route.substring(0, slash);
            final byte[] raw;
            try {
                // Prevent resolving arbitrary hostnames in an operator-supplied route.
                raw = InetAddress.getByName(address).getAddress();
            } catch (Exception e) {
                throw new IllegalArgumentException("Invalid mesh route", e);
            }
            if (prefix == 0 || prefix > raw.length * 8)
                throw new IllegalArgumentException("Full-tunnel/default or invalid route denied");
        }
    }

    /** Returns true if target address falls within at least one operator-approved route. */
    public static boolean contains(Collection<String> cidrs, InetAddress target) {
        byte[] address = target.getAddress();
        for (String cidr : cidrs) {
            int slash = cidr.lastIndexOf('/');
            byte[] network;
            try { network = InetAddress.getByName(cidr.substring(0, slash)).getAddress(); }
            catch (Exception ignored) { continue; }
            if (network.length != address.length) continue;
            int bits = Integer.parseInt(cidr.substring(slash + 1));
            boolean match = true;
            for (int i=0; i<address.length && bits>0; i++) {
                int n = Math.min(bits,8), mask=(0xff << (8-n)) & 0xff;
                if ((address[i] & mask) != (network[i] & mask)) { match=false; break; }
                bits -= n;
            }
            if (match) return true;
        }
        return false;
    }
}
