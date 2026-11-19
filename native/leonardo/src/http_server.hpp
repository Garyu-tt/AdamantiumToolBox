#pragma once
#include <boost/asio/ip/tcp.hpp>
#include <string>
namespace mas::leonardo::httpserver {
void serve(boost::asio::ip::tcp::socket socket,const std::string& secret,
 const std::string& caps);
}
