#include <mas/leonardo_vector.hpp>
#include "http_server.hpp"
#include <boost/asio.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <openssl/crypto.h>
#include <chrono>
#include <stdexcept>
#include <string>
namespace net=boost::asio;
namespace beast=boost::beast;
namespace http=beast::http;
using tcp=net::ip::tcp;
namespace {
constexpr std::string_view id="leonardo_native_vector";
constexpr std::string_view action="leonardo_native_vector.generate";
bool allowed(const std::string& value,const std::string& list) {
 size_t pos=0;
 while(pos<list.size()){
  const auto comma=list.find(',',pos);
  if(list.substr(pos,comma==std::string::npos?comma:comma-pos)==value)return true;
  if(comma==std::string::npos)break;
  pos=comma+1;
 }
 return false;
}
bool secret_ok(std::string_view got,std::string_view want) {
 return got.size()==want.size() && CRYPTO_memcmp(got.data(),want.data(),want.size())==0;
}
boost::json::object graph() {
 const std::string name(id),op(action);
 const boost::json::array required={"graphics.provider"};
 return {{"app",name},{"version",1},{"nodes",boost::json::array{
  boost::json::object{{"id",name+".view"},{"type","view"},{"title","Native Leonardo Vector"},
   {"icon","leonardo"},{"requires",required}},
  boost::json::object{{"id",name+".provider"},{"type","resource"},{"requires",required},
   {"provider",boost::json::object{{"schema","mas-graphics-provider-1"},{"locality","local"},
    {"operations",boost::json::array{
     boost::json::object{{"kind","image"},{"action",op},{"formats",boost::json::array{"image/svg+xml"}},{"priority",15}},
     boost::json::object{{"kind","render"},{"action",op},{"formats",boost::json::array{"image/svg+xml"}},{"priority",15}}
    }}}}},
  boost::json::object{{"id",op},{"type","action"},{"title","Generate native SVG"},{"requires",required}}
 }},{"edges",boost::json::array{
  boost::json::object{{"from",name+".view"},{"to",name+".provider"},{"type","uses"}},
  boost::json::object{{"from",name+".provider"},{"to",op},{"type","provides"}}}}};
}
boost::json::object generate(const boost::json::value& payload,const std::string& caps) {
 if(!allowed("graphics.provider",caps))throw std::invalid_argument("capability_denied");
 if(!payload.is_object())throw std::invalid_argument("invalid_request");
 const auto& obj=payload.as_object();
 if(!obj.contains("action")||!obj.at("action").is_string()||
    obj.at("action").as_string()!=action)throw std::invalid_argument("action_not_found");
 const auto* p=obj.if_contains("params");
 if(!p||!p->is_object())throw std::invalid_argument("invalid_params");
 const auto& params=p->as_object();
 const auto* kind=params.if_contains("kind"),*format=params.if_contains("format");
 const auto* prompt=params.if_contains("prompt");
 if(!kind||!kind->is_string()||(kind->as_string()!="image"&&kind->as_string()!="render")||
  !format||!format->is_string()||format->as_string()!="image/svg+xml")
  throw std::invalid_argument("unsupported_vector_format");
 if(!prompt||!prompt->is_string())throw std::invalid_argument("invalid_vector_request");
 boost::json::object options;
 if(const auto* opt=params.if_contains("options")){
  if(!opt->is_object())throw std::invalid_argument("invalid_vector_request");
  options=opt->as_object();
 }
 return {{"result",boost::json::object{{"status","completed"},
  {"artifact",mas::leonardo::artifact(prompt->as_string(),options)}}}};
}
http::response<http::string_body> respond(unsigned status,const boost::json::object& value) {
 http::response<http::string_body> res(static_cast<http::status>(status),11);
 res.set(http::field::content_type,"application/json; charset=utf-8");
 res.set(http::field::cache_control,"no-store");res.set(http::field::connection,"close");
 res.body()=boost::json::serialize(value);res.prepare_payload();return res;
}
}
namespace mas::leonardo::httpserver {
void serve(tcp::socket socket,const std::string& secret,const std::string& caps) {
 beast::tcp_stream stream(std::move(socket));
 stream.expires_after(std::chrono::seconds(3));
 beast::flat_buffer buffer;
 http::request_parser<http::string_body> parser;
 parser.header_limit(8192);parser.body_limit(32000);
 boost::system::error_code ec;
 http::read(stream,buffer,parser,ec);
 if(ec)return;
 auto req=parser.release();
 http::response<http::string_body> response;
 try {
  const std::string target(req.target());
  if(req.method()==http::verb::get&&target=="/health")
   response=respond(200,{{"app",std::string(id)}});
  else if(!secret_ok(std::string(req["X-Internal-Key"]),secret))
   response=respond(401,{{"error","unauthorized"}});
  else if(req.method()==http::verb::get&&target=="/graph")response=respond(200,graph());
  else if(req.method()==http::verb::post&&target=="/invoke")
   response=respond(200,generate(boost::json::parse(req.body()),caps));
  else response=respond(404,{{"error","not_found"}});
 }catch(const std::exception& error){
  response=respond(400,{{"error",std::string(error.what()).substr(0,100)}});
 }
 stream.expires_after(std::chrono::seconds(3));
 http::write(stream,response,ec);
 stream.socket().shutdown(tcp::socket::shutdown_both,ec);
}
}
