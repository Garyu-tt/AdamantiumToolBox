#include "mas/legacy_frame.hpp"
#include <algorithm>
#include <utility>
namespace mas::native::legacy {
namespace {
bool opcode_known(Opcode op) {
  return op == Opcode::GraphGet || op == Opcode::GraphResult || op == Opcode::Error;
}
void put(std::vector<std::uint8_t>& out, std::uint64_t n, int count) {
  for (int shift = (count-1)*8; shift >= 0; shift -= 8)
    out.push_back(static_cast<std::uint8_t>((n >> shift) & 255u));
}
std::uint64_t get(const std::uint8_t* p, int count) {
  std::uint64_t result = 0;
  for (int i=0; i<count; ++i) result = (result<<8)|p[i];
  return result;
}
FrameStatus check(const Frame& f) {
  if (!opcode_known(f.opcode)) return FrameStatus::BadOpcode;
  if (!f.request_id) return FrameStatus::BadId;
  if (f.payload.size() > kMaxPayload) return FrameStatus::Oversize;
  if (f.opcode == Opcode::GraphGet && !f.payload.empty()) return FrameStatus::BadShape;
  if (f.opcode == Opcode::GraphResult && f.payload.empty()) return FrameStatus::BadShape;
  if (f.opcode == Opcode::Error && (f.payload.empty() || f.payload.size()>256)) return FrameStatus::BadShape;
  return FrameStatus::Ok;
}
}
FrameStatus encode(const Frame& frame, std::vector<std::uint8_t>& bytes) {
  const auto s=check(frame);
  if(s!=FrameStatus::Ok) return s;
  std::vector<std::uint8_t> encoded;
  encoded.reserve(kHeaderSize+frame.payload.size());
  encoded.insert(encoded.end(),{'M','A','S','L'});
  put(encoded,1,2);
  put(encoded,static_cast<std::uint16_t>(frame.opcode),2);
  put(encoded,frame.request_id,8);
  put(encoded,frame.payload.size(),4);
  encoded.insert(encoded.end(),frame.payload.begin(),frame.payload.end());
  bytes.swap(encoded);
  return FrameStatus::Ok;
}
FrameStatus decode(const std::uint8_t* data,std::size_t size,Frame& out) {
  if(!data || size<kHeaderSize) return FrameStatus::Truncated;
  if(!std::equal(data,data+4,"MASL")) return FrameStatus::BadMagic;
  if(get(data+4,2)!=1) return FrameStatus::BadVersion;
  const auto op=static_cast<Opcode>(get(data+6,2));
  if(!opcode_known(op)) return FrameStatus::BadOpcode;
  const auto id=get(data+8,8);
  if(!id) return FrameStatus::BadId;
  const auto length=get(data+16,4);
  if(length>kMaxPayload) return FrameStatus::Oversize;
  if(size!=kHeaderSize+length) return FrameStatus::LengthMismatch;
  Frame candidate{op,id,{data+kHeaderSize,data+size}};
  auto result=check(candidate);
  if(result==FrameStatus::Ok) out=std::move(candidate);
  return result;
}
}
