#pragma once
#include <cstddef>
#include <string>
#include <string_view>
#include <vector>
namespace mas::wayfire {
constexpr std::size_t max_payload=1u<<20;
// Wayfire IPC protocol: 4-byte native-endian unsigned length + JSON body.
// Encoding alone NEVER authorizes compositor operations.
std::string frame(std::string_view json);
class Decoder final {
public:
 std::vector<std::string> feed(std::string_view bytes);
 void reset() noexcept {buffer_.clear();}
 std::size_t pending() const noexcept {return buffer_.size();}
private:
 std::string buffer_;
};
}
