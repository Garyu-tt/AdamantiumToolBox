#include <mas/leonardo_vector.hpp>
#include <cmath>
#include <cctype>
#include <cstdio>
#include <stdexcept>
#include <string>
#include <string_view>
namespace mas::leonardo {
namespace {
std::string escaped(std::string_view x) {
 std::string out;out.reserve(x.size());
 for(unsigned char c:x) {
  if(c<32||c==127){out+=' ';continue;}
  switch(c){case '&':out+="&amp;";break;case '<':out+="&lt;";break;
   case '>':out+="&gt;";break;case '"':out+="&quot;";break;
   case '\'':out+="&apos;";break;default:out+=char(c);}
 }
 return out;
}
double number(const boost::json::value& value,double min,double max,const char* field) {
 double n=0;
 if(value.is_double())n=value.as_double();
 else if(value.is_int64())n=static_cast<double>(value.as_int64());
 else if(value.is_uint64())n=static_cast<double>(value.as_uint64());
 else throw std::invalid_argument(std::string("invalid_")+field);
 if(!std::isfinite(n)||n<min||n>max)throw std::invalid_argument(std::string("invalid_")+field);
 return std::round(n*10000.0)/10000.0;
}
std::string fmt(double n) {
 if(n==0)return "0";
 char buf[80];std::snprintf(buf,sizeof(buf),"%.4f",n);
 std::string s=buf;
 if(s.find('.')!=std::string::npos){while(s.back()=='0')s.pop_back();if(s.back()=='.')s.pop_back();}
 return s;
}
double field(const boost::json::object& s,const char* key,double low,double high) {
 const auto* value=s.if_contains(key);
 if(!value)throw std::invalid_argument(std::string("invalid_")+key);
 return number(*value,low,high,key);
}
std::string paint(const boost::json::object& s,const char* key,std::string fallback) {
 const auto* p=s.if_contains(key);
 if(!p)return fallback;
 if(!p->is_string())throw std::invalid_argument(std::string("invalid_")+key);
 const std::string v=p->as_string().c_str();
 if(v=="none")return v;
 if(v.size()!=7||v[0]!='#')throw std::invalid_argument(std::string("invalid_")+key);
 for(size_t i=1;i<7;++i)if(!std::isxdigit(static_cast<unsigned char>(v[i])))
  throw std::invalid_argument(std::string("invalid_")+key);
 return v;
}
std::string element(const boost::json::value& item) {
 if(!item.is_object())throw std::invalid_argument("invalid_shape");
 const auto& s=item.as_object();
 const auto* t=s.if_contains("type");
 if(!t||!t->is_string())throw std::invalid_argument("unsupported_shape");
 std::string type=t->as_string().c_str();
 const auto* opacity=s.if_contains("opacity");
 const std::string fill=paint(s,"fill","#597bb8");
 const std::string alpha=fmt(opacity?number(*opacity,0,1,"opacity"):1);
 const std::string common=" fill=\""+fill+"\" opacity=\""+alpha+"\"";
 auto attr=[&](const char* key,double min,double max) {
  return std::string(" ")+key+"=\""+fmt(field(s,key,min,max))+"\"";
 };
 if(type=="rect")return "<rect"+attr("x",-8192,8192)+attr("y",-8192,8192)+
   attr("width",0,8192)+attr("height",0,8192)+common+"/>";
 if(type=="circle")return "<circle"+attr("cx",-8192,8192)+attr("cy",-8192,8192)+
   attr("r",0,8192)+common+"/>";
 if(type=="ellipse")return "<ellipse"+attr("cx",-8192,8192)+attr("cy",-8192,8192)+
   attr("rx",0,8192)+attr("ry",0,8192)+common+"/>";
 if(type=="line")return "<line"+attr("x1",-8192,8192)+attr("y1",-8192,8192)+
   attr("x2",-8192,8192)+attr("y2",-8192,8192)+
   " stroke=\""+paint(s,"stroke","#597bb8")+"\" stroke-width=\""+
   fmt(s.contains("strokeWidth")?number(s.at("strokeWidth"),0,128,"strokeWidth"):2)+
   "\" opacity=\""+alpha+"\"/>";
 if(type=="text") {
  const auto* text=s.if_contains("text");
  if(!text||!text->is_string()||text->as_string().size()>160)
   throw std::invalid_argument("invalid_text");
  const auto font=s.contains("fontSize")?number(s.at("fontSize"),4,256,"fontSize"):20;
  return "<text"+attr("x",-8192,8192)+attr("y",-8192,8192)+
   " font-size=\""+fmt(font)+"\" font-family=\"sans-serif\""+common+">"+
   escaped(text->as_string())+"</text>";
 }
 throw std::invalid_argument("unsupported_shape");
}
}
std::string svg(std::string_view prompt,const boost::json::object& options) {
 if(prompt.size()>4000)throw std::invalid_argument("invalid_vector_request");
 const auto size=[&](const char* key) {return options.contains(key)?number(options.at(key),16,2048,key):512;};
 const double w=size("width"),h=size("height");
 boost::json::array automatic;
 const boost::json::array* shapes=nullptr;
 if(auto* value=options.if_contains("scene")) {
  if(!value->is_array())throw std::invalid_argument("invalid_scene");
  shapes=&value->as_array();
 }else{automatic=procedural(prompt,w,h);shapes=&automatic;}
 if(shapes->size()>96)throw std::invalid_argument("invalid_scene");
 std::string result="<svg xmlns=\"http://www.w3.org/2000/svg\" width=\""+fmt(w)+
  "\" height=\""+fmt(h)+"\" viewBox=\"0 0 "+fmt(w)+" "+fmt(h)+"\"><title>"+
  escaped(prompt.substr(0,120))+"</title>";
 for(const auto& s:*shapes)result+=element(s);
 result+="</svg>";
 if(result.size()>110000)throw std::invalid_argument("svg_too_large");
 return result;
}
}
