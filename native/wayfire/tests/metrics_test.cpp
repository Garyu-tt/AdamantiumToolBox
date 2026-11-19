#include "metrics.hpp"
#include <iostream>
#include <stdexcept>
#include <string>
#define CHECK(x) do {if(!(x))throw std::logic_error("diagnostics_test_failed");}while(false)
int main(){
 const auto request=mas::wayfire::diagnostics::renderMetricsRequest();
 CHECK(request==R"({"method":"wayfire/render-metrics","data":{}})");
 int invoked=0;
 const auto response=mas::wayfire::diagnostics::readMetrics(
  [&](std::string_view message){
   ++invoked;CHECK(message==request);
   return R"([{"refresh-ns":16666666,"predicted-path":"composed"}])";
  });
 CHECK(invoked==1&&response.find("16666666")!=std::string::npos);
 bool denied=false;
 try{mas::wayfire::diagnostics::readMetrics([](auto){return std::string{};});}
 catch(const std::runtime_error&){denied=true;}
 CHECK(denied);
 std::cout<<"MAS_WAYFIRE_METRICS_OK only read-only method, bounded responses\n";
}
