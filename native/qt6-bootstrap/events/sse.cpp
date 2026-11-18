#include "sse.hpp"
namespace mas::events {
void Parser::reset() noexcept {
 buffer_.clear();type_.clear();id_.clear();data_.clear();hasData_=false;
}
void Parser::line(std::string_view value,std::vector<Event>& out) {
 if(!value.size()) {
  if(hasData_) {
   if(!data_.empty()&&data_.back()=='\n')data_.pop_back();
   out.push_back({type_.empty()?"message":type_,id_,data_});
  }
  type_.clear();id_.clear();data_.clear();hasData_=false;return;
 }
 if(value.front()==':')return;
 const auto colon=value.find(':');
 auto name=value.substr(0,colon);
 auto field=colon==value.npos?std::string_view{}:value.substr(colon+1);
 if(!field.empty()&&field.front()==' ')field.remove_prefix(1);
 if(name=="event")type_=field;
 else if(name=="id"&&field.find('\0')==field.npos)id_=field;
 else if(name=="data") {
  if(data_.size()+field.size()+1>limit_)throw std::length_error("sse_event_too_large");
  data_.append(field);data_+='\n';hasData_=true;
 }
}
std::vector<Event> Parser::feed(std::string_view bytes) {
 if(buffer_.size()+bytes.size()>limit_) {reset();throw std::length_error("sse_buffer_too_large");}
 buffer_.append(bytes);
 std::vector<Event> result;
 while(true) {
  const auto end=buffer_.find('\n');
  if(end==buffer_.npos)break;
  auto len=end;
  if(len&&buffer_[len-1]=='\r')--len;
  const std::string value=buffer_.substr(0,len);
  buffer_.erase(0,end+1);
  line(value,result);
 }
 return result;
}
}
