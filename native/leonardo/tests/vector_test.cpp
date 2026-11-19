#include <mas/leonardo_vector.hpp>
#include <boost/json.hpp>
#include <openssl/evp.h>
#include <stdexcept>
#include <iostream>
#define CHECK(expr) do { if(!(expr)) throw std::runtime_error("test_failed: " #expr); } while(false)
using boost::json::object;
using boost::json::array;
using namespace mas::leonardo;
namespace {
void invalid(const object& obj) {
 try {svg("test",obj);CHECK(false);}
 catch(const std::invalid_argument&) {}
}
}
int main() {
 const auto transparent=svg("unsafe<&\"'",{{"width",64},{"height",32},
  {"scene",array{object{{"type","text"},{"x",1},{"y",2},{"text","A<&'\"B"}}}}});
 CHECK(transparent.find("<title>unsafe&lt;&amp;&quot;&apos;</title>")!=std::string::npos);
 CHECK(transparent.find("A&lt;&amp;&apos;&quot;B")!=std::string::npos);
 CHECK(transparent.find("width=\"64\" height=\"32\"")!=std::string::npos);
 CHECK(transparent.find("<text x=\"1\" y=\"2\"")!=std::string::npos);
 const auto first=svg("Deterministic CPU provider");
 CHECK(first==svg("Deterministic CPU provider"));
 CHECK(first!=svg("Different description"));
 CHECK(first.find("<circle")!=std::string::npos);
 CHECK(procedural("a",512,512).size()==15);
 const auto art=artifact("hello",{{"scene",array{}}});
 CHECK(art.at("mime")=="image/svg+xml"&&art.at("encoding")=="base64");
 const auto b64=art.at("data").as_string();
 std::string decoded(b64.size(),'\0');
 int n=EVP_DecodeBlock(reinterpret_cast<unsigned char*>(decoded.data()),
  reinterpret_cast<const unsigned char*>(b64.data()),int(b64.size()));
 CHECK(n>0);
 CHECK(decoded.substr(0,4)=="<svg");
 invalid({{"width",0}});
 invalid({{"width","42"}});
 invalid({{"scene","hello"}});
 invalid({{"scene",array{object{{"type","text"},{"x",3},{"y",1},{"text","X<script>"},
  {"fill","url(evil)"}}}}});
 invalid({{"scene",array{object{{"type","use"}}}}});
 invalid({{"scene",array{object{{"type","rect"},{"x",1},{"y",1},{"width",-1},{"height",2}}}}});
 array many;for(int i=0;i<97;++i)many.emplace_back(object{{"type","circle"},{"cx",0},{"cy",0},{"r",1}});
 invalid({{"scene",std::move(many)}});
 std::cout<<"LEONARDO_NATIVE_VECTOR_OK\n";
}
