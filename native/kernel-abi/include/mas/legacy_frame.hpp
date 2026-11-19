#pragma once
#include <cstddef>
#include <cstdint>
#include <vector>

namespace mas::native::legacy {
constexpr std::size_t kHeaderSize = 20;
constexpr std::size_t kMaxPayload = 65536;
enum class Opcode : std::uint16_t { GraphGet = 1, GraphResult = 2, Error = 3 };
enum class FrameStatus { Ok, Truncated, BadMagic, BadVersion, BadOpcode, BadId, Oversize, LengthMismatch, BadShape };
struct Frame {
  Opcode opcode = Opcode::GraphGet;
  std::uint64_t request_id = 0;
  std::vector<std::uint8_t> payload;
};
// Exact one-frame encoding. Wire format is big-endian, 20 bytes header:
// "MASL" [4], version [u16 = 1], opcode [u16], request_id [u64], payload_len [u32].
FrameStatus encode(const Frame& frame, std::vector<std::uint8_t>& bytes);
FrameStatus decode(const std::uint8_t* data, std::size_t size, Frame& out);
} // namespace mas::native::legacy
