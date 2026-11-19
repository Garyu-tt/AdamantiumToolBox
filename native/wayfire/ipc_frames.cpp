#include "ipc_frames.hpp"
#include <cstdint>
#include <cstring>
#include <stdexcept>
namespace mas::wayfire {
std::string frame(std::string_view json){
 if(json.empty()||json.size()>max_payload)throw std::length_error("wayfire_frame_size");
 const auto length=static_cast<std::uint32_t>(json.size());
 std::string out(4+json.size(),'\0');
 std::memcpy(out.data(),&length,4);
 std::memcpy(out.data()+4,json.data(),json.size());
 return out;
}
std::vector<std::string> Decoder::feed(std::string_view bytes){
 if(bytes.size()>max_payload+4||buffer_.size()>max_payload+4-bytes.size()){
  reset();throw std::length_error("wayfire_frame_overflow");
 }
 buffer_.append(bytes.data(),bytes.size());
 std::vector<std::string> messages;
 std::size_t consumed=0;
 while(buffer_.size()-consumed>=4){
  std::uint32_t length=0;
  std::memcpy(&length,buffer_.data()+consumed,4);
  if(length==0||length>max_payload){reset();throw std::length_error("wayfire_frame_size");}
  if(buffer_.size()-consumed<4u+length)break;
  messages.emplace_back(buffer_.data()+consumed+4,length);
  consumed+=4u+length;
 }
 if(consumed)buffer_.erase(0,consumed);
 return messages;
}
}
