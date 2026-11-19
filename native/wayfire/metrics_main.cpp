#include "metrics.hpp"
#include "unix_client.hpp"
#include <chrono>
#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <string>
#include <thread>
namespace {
long parse(const std::string& text,long min,long max){
 if(text.empty()||text.find_first_not_of("0123456789")!=std::string::npos)
  throw std::invalid_argument("invalid_numeric_option");
 const auto n=std::stol(text);
 if(n<min||n>max)throw std::invalid_argument("numeric_option_out_of_range");
 return n;
}
}
int main(int argc,char** argv){
 try{
  std::string socket;
  long count=1,intervalMs=200;
  for(int i=1;i<argc;i++){
   const std::string name=argv[i];
   if(i+1>=argc)throw std::invalid_argument("value_required");
   const std::string value=argv[++i];
   if(name=="--socket")socket=value;
   else if(name=="--samples")count=parse(value,1,120);
   else if(name=="--interval-ms")intervalMs=parse(value,50,10000);
   else throw std::invalid_argument("unknown_option");
  }
  if(socket.empty()||socket.front()!='/')throw std::invalid_argument("absolute_socket_required");
  for(long i=0;i<count;++i){
   const auto begin=std::chrono::steady_clock::now();
   const auto result=mas::wayfire::diagnostics::readMetrics(
    [&](std::string_view request){
     return mas::wayfire::exchange(socket,request,std::chrono::milliseconds(1500));
    });
   const auto us=std::chrono::duration_cast<std::chrono::microseconds>(
    std::chrono::steady_clock::now()-begin).count();
   // stdout is the raw response issued by the compositor, no synthesized FPS.
   std::cout<<result<<"\n";
   std::cerr<<"wayfire_ipc_sample="<<i<<" latency_us="<<us<<"\n";
   if(i+1<count)std::this_thread::sleep_for(std::chrono::milliseconds(intervalMs));
  }
 }catch(const std::exception& e){
  std::cerr<<"wayfire_diagnostics_error: "<<e.what()<<"\n";return 2;
 }
}
