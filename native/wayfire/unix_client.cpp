#include "unix_client.hpp"
#include "ipc_frames.hpp"
#include <cerrno>
#include <chrono>
#include <cstring>
#include <stdexcept>
#include <sys/socket.h>
#include <sys/un.h>
#include <poll.h>
#include <unistd.h>
namespace mas::wayfire {
namespace {
struct Socket {int fd=-1;~Socket(){if(fd>=0)::close(fd);}};
void ready(int fd,short events,std::chrono::steady_clock::time_point deadline){
 const auto now=std::chrono::steady_clock::now();
 if(now>=deadline)throw std::runtime_error("wayfire_ipc_timeout");
 const auto remain=std::chrono::duration_cast<std::chrono::milliseconds>(deadline-now).count();
 pollfd p{fd,events,0};
 int rc;
 do {rc=::poll(&p,1,static_cast<int>(remain));} while(rc<0&&errno==EINTR);
 if(rc<=0)throw std::runtime_error(rc==0?"wayfire_ipc_timeout":"wayfire_ipc_poll");
 if(p.revents&events)return;
 if(p.revents&(POLLHUP|POLLERR|POLLNVAL))throw std::runtime_error("wayfire_ipc_closed");
 throw std::runtime_error("wayfire_ipc_not_ready");
}
}
std::string exchange(const std::string& path,std::string_view request,
 std::chrono::milliseconds timeout){
 if(path.empty()||path[0]!='/'||path.size()>=sizeof(sockaddr_un::sun_path)||
    timeout.count()<1||timeout.count()>30000)
  throw std::invalid_argument("invalid_wayfire_socket_or_timeout");
 const auto deadline=std::chrono::steady_clock::now()+timeout;
 Socket client{::socket(AF_UNIX,SOCK_STREAM|SOCK_NONBLOCK|SOCK_CLOEXEC,0)};
 if(client.fd<0)throw std::runtime_error("wayfire_socket_failed");
 sockaddr_un address{};address.sun_family=AF_UNIX;
 std::memcpy(address.sun_path,path.c_str(),path.size()+1);
 if(::connect(client.fd,reinterpret_cast<const sockaddr*>(&address),sizeof(address))<0){
  if(errno!=EINPROGRESS)throw std::runtime_error("wayfire_connect_failed");
  ready(client.fd,POLLOUT,deadline);
  int error=0;socklen_t len=sizeof(error);
  if(getsockopt(client.fd,SOL_SOCKET,SO_ERROR,&error,&len)!=0||error)
   throw std::runtime_error("wayfire_connect_failed");
 }
 const auto data=frame(request);
 std::size_t offset=0;
 while(offset<data.size()){
  ready(client.fd,POLLOUT,deadline);
  const auto n=::send(client.fd,data.data()+offset,data.size()-offset,MSG_NOSIGNAL);
  if(n<0&&(errno==EINTR||errno==EAGAIN))continue;
  if(n<=0)throw std::runtime_error("wayfire_send_failed");
  offset+=static_cast<std::size_t>(n);
 }
 Decoder decoder;
 char bytes[4096];
 for(;;){
  ready(client.fd,POLLIN,deadline);
  const auto n=::recv(client.fd,bytes,sizeof(bytes),0);
  if(n<0&&(errno==EINTR||errno==EAGAIN))continue;
  if(n<=0)throw std::runtime_error("wayfire_receive_failed");
  auto messages=decoder.feed(std::string_view(bytes,static_cast<std::size_t>(n)));
  if(!messages.empty())return messages.front();
 }
}
}
