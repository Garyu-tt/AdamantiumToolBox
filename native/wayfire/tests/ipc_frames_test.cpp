#include "ipc_frames.hpp"
#include <iostream>
#include <stdexcept>
#define CHECK(x) do {if(!(x))throw std::logic_error("frame_test_failed");}while(false)
int main(){
 const std::string request=R"({"method":"window-rules/list-views","data":{}})";
 const auto packed=mas::wayfire::frame(request);
 CHECK(packed.size()==request.size()+4);
 mas::wayfire::Decoder d;
 for(std::size_t i=0;i<packed.size()-1;++i)
  CHECK(d.feed(std::string_view(packed).substr(i,1)).empty());
 auto messages=d.feed(std::string_view(packed).substr(packed.size()-1));
 CHECK(messages.size()==1&&messages[0]==request&&d.pending()==0);
 messages=d.feed(packed+packed);
 CHECK(messages.size()==2&&messages[0]==request&&messages[1]==request);
 bool failed=false;
 try{mas::wayfire::frame("");}catch(const std::length_error&){failed=true;}
 CHECK(failed);
 failed=false;
 try{d.feed(std::string(4,'\xff'));}catch(const std::length_error&){failed=true;}
 CHECK(failed&&d.pending()==0);
 failed=false;
 try{d.feed(std::string(mas::wayfire::max_payload+5,'x'));}
 catch(const std::length_error&){failed=true;}
 CHECK(failed&&d.pending()==0);
 std::cout<<"MAS_WAYFIRE_CODEC_OK segmented, multi, oversized, reset\n";
}
