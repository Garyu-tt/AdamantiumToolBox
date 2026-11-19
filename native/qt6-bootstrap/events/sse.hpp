#pragma once
#include <cstddef>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>
namespace mas::events {
struct Event { std::string type="message",id,data; };
class Parser {
public:
 explicit Parser(std::size_t limit=65536):limit_(limit) {}
 std::vector<Event> feed(std::string_view bytes);
 void reset() noexcept;
private:
 void line(std::string_view text,std::vector<Event>& out);
 std::size_t limit_;
 std::string buffer_,type_,id_,data_;
 bool hasData_=false;
};
}
