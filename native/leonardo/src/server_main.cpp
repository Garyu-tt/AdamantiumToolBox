#include "http_server.hpp"
#include <boost/asio.hpp>
#include <boost/asio/post.hpp>
#include <boost/asio/thread_pool.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <atomic>
#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <string>
#include <thread>
namespace net=boost::asio;
namespace beast=boost::beast;
namespace http=beast::http;
using tcp=net::ip::tcp;
namespace {
std::string env(const char* key){const char* value=std::getenv(key);return value?value:"";}
size_t count_env(const char* key,size_t fallback,size_t limit) {
 const auto value=env(key);
 if(value.empty())return fallback;
 if(value.size()>3||value.find_first_not_of("0123456789")!=std::string::npos)
  throw std::invalid_argument(std::string("invalid_")+key);
 const auto count=std::stoull(value);
 if(count<1||count>limit)throw std::invalid_argument(std::string("invalid_")+key);
 return static_cast<size_t>(count);
}
}
int main() {
 try {
  const auto secret=env("ADA_INTERNAL_KEY"),caps=env("ADA_CAPS"),port=env("APP_PORT");
  if(secret.size()<24)throw std::runtime_error("internal_key_missing");
  if(port.empty()||port.find_first_not_of("0123456789")!=std::string::npos)
   throw std::runtime_error("APP_PORT_required");
  const int p=std::stoi(port);
  if(p<1024||p>65535)throw std::runtime_error("invalid_port");
  const unsigned hw=std::thread::hardware_concurrency();
  const size_t defaultWorkers=std::clamp<size_t>(hw?hw:2,2,8);
  const size_t workers=count_env("MAS_NATIVE_WORKERS",defaultWorkers,32);
  const size_t limit=count_env("MAS_NATIVE_MAX_INFLIGHT",workers*2,128);
  if(limit<workers)throw std::runtime_error("max_inflight_below_workers");
  net::io_context io;
  tcp::acceptor server(io,tcp::endpoint(net::ip::address_v4::loopback(),uint16_t(p)));
  net::thread_pool pool(workers);
  std::atomic_size_t inflight{0};
  for(;;) {
   tcp::socket socket(io);server.accept(socket);
   size_t current=inflight.load(std::memory_order_relaxed);
   bool reserved=false;
   while(current<limit) {
    if(inflight.compare_exchange_weak(current,current+1,std::memory_order_acq_rel)) {
     reserved=true;break;
    }
   }
   if(!reserved) {
    boost::system::error_code ec;
    http::response<http::string_body> busy(http::status::service_unavailable,11);
    busy.set(http::field::content_type,"application/json; charset=utf-8");
    busy.set(http::field::cache_control,"no-store");
    busy.set(http::field::connection,"close");
    busy.set(http::field::retry_after,"1");
    busy.body()=R"({"error":"server_busy"})";
    busy.prepare_payload();
    beast::tcp_stream stream(std::move(socket));
    stream.expires_after(std::chrono::milliseconds(200));
    http::write(stream,busy,ec);
    stream.socket().shutdown(tcp::socket::shutdown_both,ec);
    continue;
   }
   try {
    net::post(pool,[&inflight,&secret,&caps,socket=std::move(socket)]()mutable {
     struct Ticket {std::atomic_size_t& n;~Ticket(){n.fetch_sub(1,std::memory_order_acq_rel);}} ticket{inflight};
     try {mas::leonardo::httpserver::serve(std::move(socket),secret,caps);}
     catch(const std::exception& error) {std::cerr<<"request_error: "<<error.what()<<'\n';}
    });
   }catch(...) {inflight.fetch_sub(1,std::memory_order_acq_rel);throw;}
  }
 }catch(const std::exception& error){std::cerr<<error.what()<<'\n';return 2;}
}
