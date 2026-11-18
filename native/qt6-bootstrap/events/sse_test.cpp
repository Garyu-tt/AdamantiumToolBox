#include "sse.hpp"
#include <cassert>
#include <iostream>
int main() {
 mas::events::Parser parser(128);
 assert(parser.feed(":keepalive\r\n\r\n").empty());
 assert(parser.feed("id: 4\r\nevent: inv").empty());
 auto events=parser.feed("alidate\r\ndata: {}\r\n\r\n");
 assert(events.size()==1&&events[0].id=="4"&&events[0].type=="invalidate");
 assert(events[0].data=="{}");
 auto multi=parser.feed("data: one\ndata: two\n\n");
 assert(multi.size()==1&&multi[0].data=="one\ntwo");
 bool blocked=false;
 try{parser.feed(std::string(129,'x'));}catch(const std::length_error&){blocked=true;}
 assert(blocked);
 assert(parser.feed("event: ready\ndata: {}\n\n").size()==1);
 std::cout<<"MAS_SSE_PARSER_OK\n";
}
