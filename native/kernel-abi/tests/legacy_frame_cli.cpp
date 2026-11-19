#include "mas/legacy_frame.hpp"
#include <iostream>
#include <iterator>
#include <string>
#include <vector>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif
using namespace mas::native::legacy;
int main(int argc,char** argv){
 if(argc!=2)return 2;
#ifdef _WIN32
 _setmode(_fileno(stdin),_O_BINARY);_setmode(_fileno(stdout),_O_BINARY);
#endif
 const std::string mode=argv[1];
 if(mode=="emit") {
   Frame f{Opcode::GraphGet,42,{}};
   std::vector<std::uint8_t> bytes;
   if(encode(f,bytes)!=FrameStatus::Ok)return 3;
   std::cout.write(reinterpret_cast<const char*>(bytes.data()),bytes.size());
   return std::cout?0:4;
 }
 if(mode=="read") {
   std::vector<std::uint8_t> input;
   for(int ch=0;(ch=std::cin.get())!=EOF;){
     if(input.size()>=kMaxPayload+kHeaderSize) return 6;
     input.push_back(static_cast<std::uint8_t>(ch));
   }
   Frame f;
   if(decode(input.data(),input.size(),f)!=FrameStatus::Ok)return 7;
   if(f.opcode!=Opcode::GraphResult || f.request_id!=42)return 8;
   std::cout.write(reinterpret_cast<const char*>(f.payload.data()),f.payload.size());
   return std::cout?0:9;
 }
 return 2;
}
