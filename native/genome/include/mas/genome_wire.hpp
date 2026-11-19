#pragma once
#include "mas/genome.hpp"
#include <cstddef>
#include <cstdint>
#include <vector>

namespace mas::genome::wire {
// Canonical CPU-only GA1a transport envelope. Not an authenticated signature,
// proof of code availability, or permission to express/execute a gene.
inline constexpr std::uint16_t kWireVersion = 1;
inline constexpr std::size_t kMaxWireBytes = 16u * 1024u * 1024u;

enum class Status {
  Ok, InvalidGenome, UnsupportedVersion, Truncated, Malformed,
  ResourceLimit, NonCanonical
};

// Fixed-network-endian binary, ASCII length-prefixed strings, no host pointers,
// platform-dependent enum widths, JSON, compression or run-time IO.
// On error, neither output argument is changed. All parsed Genome instances
// are validated against the canonical headless Graph IR.
Status encode(const Genome& genome, std::vector<std::uint8_t>& out);
Status decode(const std::uint8_t* data, std::size_t size, Genome& out);
} // namespace mas::genome::wire
