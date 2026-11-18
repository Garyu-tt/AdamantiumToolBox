#include <mas/leonardo_vector.hpp>
#include <openssl/evp.h>
#include <limits>
#include <stdexcept>
#include <vector>
namespace mas::leonardo {
boost::json::object artifact(std::string_view prompt,const boost::json::object& options) {
 const auto body=svg(prompt,options);
 if(body.size()>static_cast<size_t>(std::numeric_limits<int>::max()))
  throw std::length_error("svg_too_large");
 std::vector<unsigned char> b64(4*((body.size()+2)/3)+1);
 const int written=EVP_EncodeBlock(b64.data(),reinterpret_cast<const unsigned char*>(body.data()),
  static_cast<int>(body.size()));
 if(written<0)throw std::runtime_error("base64_failed");
 return {{"mime","image/svg+xml"},{"encoding","base64"},
  {"data",std::string(reinterpret_cast<const char*>(b64.data()),written)}};
}
}
