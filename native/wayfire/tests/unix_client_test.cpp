#include "unix_client.hpp"
#include "ipc_frames.hpp"
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#include <thread>
#include <filesystem>
#include <cstring>
#include <iostream>
#include <stdexcept>
#include <vector>
#define CHECK(x) do {if(!(x))throw std::logic_error("ipc_test_failed");}while(false)
int main(){
 auto root=std::filesystem::temp_directory_path()/"mas-wayfire-XXXXXX";
 auto name=root.string();std::vector<char> temp(name.begin(),name.end());temp.push_back(0);
 char* directory=mkdtemp(temp.data());CHECK(directory!=nullptr);
 const std::string path=std::string(directory)+"/sock";
 int server=::socket(AF_UNIX,SOCK_STREAM,0);CHECK(server>=0);
 sockaddr_un address{};address.sun_family=AF_UNIX;
 std::memcpy(address.sun_path,path.c_str(),path.size()+1);
 CHECK(::bind(server,reinterpret_cast<sockaddr*>(&address),sizeof(address))==0);
 CHECK(::listen(server,1)==0);
 std::thread worker([&]{
  int peer=::accept(server,nullptr,nullptr);CHECK(peer>=0);
  mas::wayfire::Decoder decoder;char buffer[512];
  for(;;){
   const auto n=::recv(peer,buffer,sizeof(buffer),0);CHECK(n>0);
   const auto messages=decoder.feed(std::string_view(buffer,n));
   if(messages.empty())continue;
   CHECK(messages.front()==R"({"method":"example","data":{}})");
   const auto reply=mas::wayfire::frame(R"({"result":"connected"})");
   CHECK(::send(peer,reply.data(),2,0)==2);
   CHECK(::send(peer,reply.data()+2,reply.size()-2,0)==ssize_t(reply.size()-2));
   break;
  }
  ::close(peer);
 });
 const auto result=mas::wayfire::exchange(path,R"({"method":"example","data":{}})");
 CHECK(result==R"({"result":"connected"})");
 worker.join();::close(server);
 std::filesystem::remove_all(directory);
 bool failed=false;
 try{mas::wayfire::exchange("relative/path","{}");}
 catch(const std::invalid_argument&){failed=true;}
 CHECK(failed);
 std::cout<<"MAS_WAYFIRE_UNIX_OK socket roundtrip, partial response, invalid path\n";
}
