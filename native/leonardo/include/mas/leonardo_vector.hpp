#pragma once
#include <boost/json.hpp>
#include <string>
#include <string_view>
namespace mas::leonardo {
boost::json::array procedural(std::string_view prompt,double width,double height);
std::string svg(std::string_view prompt,const boost::json::object& options={});
boost::json::object artifact(std::string_view prompt,const boost::json::object& options={});
}
