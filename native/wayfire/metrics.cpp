#include "metrics.hpp"
#include <stdexcept>
namespace mas::wayfire::diagnostics {
std::string renderMetricsRequest(){
 return R"({"method":"wayfire/render-metrics","data":{}})";
}
std::string readMetrics(const std::function<std::string(std::string_view)>& exchange){
 const auto response=exchange(renderMetricsRequest());
 if(response.empty()||response.size()>maxResponseBytes)
  throw std::runtime_error("wayfire_metrics_invalid_response");
 return response;
}
}
