#include "mas/legacy_frame.hpp"
#include <algorithm>
#include <iostream>
using namespace mas::native::legacy;
#define REQUIRE(x) do {if(!(x)){std::cerr<<"FAIL:"<<__LINE__<<" "<<#x<<'\n';return 1;}}while(0)
int main(){
  Frame request{Opcode::GraphGet,42,{}};
  std::vector<std::uint8_t> wire;
  REQUIRE(encode(request,wire)==FrameStatus::Ok);
  REQUIRE(wire.size()==20);
  REQUIRE(wire[0]=='M' && wire[3]=='L' && wire[4]==0 && wire[5]==1 && wire[7]==1 && wire[15]==42 && wire[19]==0);
  Frame decoded;
  REQUIRE(decode(wire.data(),wire.size(),decoded)==FrameStatus::Ok);
  REQUIRE(decoded.opcode==Opcode::GraphGet && decoded.request_id==42);
  auto malformed=wire;
  malformed[0]=0;
  REQUIRE(decode(malformed.data(),malformed.size(),decoded)==FrameStatus::BadMagic);
  REQUIRE(decoded.request_id==42); // fail without mutation
  malformed=wire;malformed[5]=2;
  REQUIRE(decode(malformed.data(),malformed.size(),decoded)==FrameStatus::BadVersion);
  malformed=wire;malformed[7]=4;
  REQUIRE(decode(malformed.data(),malformed.size(),decoded)==FrameStatus::BadOpcode);
  malformed=wire;malformed[15]=0;
  REQUIRE(decode(malformed.data(),malformed.size(),decoded)==FrameStatus::BadId);
  malformed=wire;malformed[19]=1;
  REQUIRE(decode(malformed.data(),malformed.size(),decoded)==FrameStatus::LengthMismatch);
  malformed=wire;malformed[16]=0;malformed[17]=2;malformed[18]=0;malformed[19]=1;
  REQUIRE(decode(malformed.data(),malformed.size(),decoded)==FrameStatus::Oversize);
  REQUIRE(decode(wire.data(),19,decoded)==FrameStatus::Truncated);
  Frame payload{Opcode::GraphResult,UINT64_C(0x0102030405060708),{'{','}'}};
  REQUIRE(encode(payload,wire)==FrameStatus::Ok);
  REQUIRE(wire.size()==22 && wire[8]==1 && wire[15]==8 && wire[19]==2);
  REQUIRE(decode(wire.data(),wire.size(),decoded)==FrameStatus::Ok);
  REQUIRE(decoded.payload==payload.payload);
  Frame invalid{Opcode::Error,1,std::vector<std::uint8_t>(257,'x')};
  auto before=wire;
  REQUIRE(encode(invalid,wire)==FrameStatus::BadShape && wire==before);
  Frame empty_result{Opcode::GraphResult,1,{}};
  REQUIRE(encode(empty_result,wire)==FrameStatus::BadShape);
  std::cout<<"MAS_LEGACY_FRAME_R01_OK: endian, bounds, malformed, no-mutation\n";
}
