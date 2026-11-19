#include <mas/leonardo_vector.hpp>
#include <openssl/evp.h>
#include <array>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <iomanip>
#include <sstream>
#include <stdexcept>
namespace mas::leonardo {
boost::json::array procedural(std::string_view prompt,double w,double h) {
 std::array<unsigned char,32> digest{};
 unsigned length=0;
 if(!EVP_Digest(prompt.data(),prompt.size(),digest.data(),&length,EVP_sha256(),nullptr)||length!=32)
  throw std::runtime_error("sha256_failed");
 uint32_t state=uint32_t(digest[0])|(uint32_t(digest[1])<<8)|
  (uint32_t(digest[2])<<16)|(uint32_t(digest[3])<<24);
 const auto random=[&]() mutable -> double {
  state=1664525u*state+1013904223u;
  return static_cast<double>(state)/4294967296.0;
 };
 auto rand=random;
 const auto tint=[&](size_t n) {
  std::ostringstream s;s<<'#'<<std::hex<<std::setfill('0');
  for(size_t i=0;i<3;++i)s<<std::setw(2)<<(70u+digest[(n+i)%32]%150u);
  return s.str();
 };
 boost::json::array scene;
 scene.emplace_back(boost::json::object{{"type","rect"},{"x",0},{"y",0},
  {"width",w},{"height",h},{"fill",tint(0)}});
 for(size_t i=0;i<14;++i) {
  boost::json::object shape;
  shape["type"]=i%4==0?"rect":"circle";
  if(i%4==0) {
   shape["x"]=std::floor(rand()*w);shape["y"]=std::floor(rand()*h);
   shape["width"]=std::floor(10+rand()*w/3);
   shape["height"]=std::floor(10+rand()*h/3);
  } else {
   shape["cx"]=std::floor(rand()*w);shape["cy"]=std::floor(rand()*h);
   shape["r"]=std::floor(8+rand()*std::min(w,h)/4);
  }
  shape["fill"]=tint(i+1);
  shape["opacity"]=std::round((0.28+rand()*0.65)*1000.0)/1000.0;
  scene.emplace_back(std::move(shape));
 }
 return scene;
}
}
