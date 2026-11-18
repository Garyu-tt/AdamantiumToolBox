#include "registry.hpp"
#include <cppmicroservices/FrameworkFactory.h>
#include <chrono>
#include <memory>
#include <set>
#include <stdexcept>
namespace mas {
CppMsRegistry::CppMsRegistry():framework_(cppmicroservices::FrameworkFactory().NewFramework()) {
 framework_.Init();framework_.Start();
 context_=framework_.GetBundleContext();
 if(!context_)throw std::runtime_error("cppms_context_unavailable");
}
CppMsRegistry::~CppMsRegistry() {
 for(auto& [id,entry]:services_)entry.registration.Unregister();
 services_.clear();
 framework_.Stop();
 framework_.WaitForStop(std::chrono::milliseconds(2000));
}
void CppMsRegistry::reconcile(const std::vector<Capability>& authorized) {
 std::map<std::string,Capability> next;
 for(const auto& c:authorized) {
  if(c.id.empty()||c.kind.empty()||c.contract.empty()||!next.emplace(c.id,c).second)
   throw std::invalid_argument("invalid_or_duplicate_capability");
 }
 for(auto it=services_.begin();it!=services_.end();) {
  const auto fresh=next.find(it->first);
  if(fresh!=next.end()&&fresh->second==it->second.capability){++it;continue;}
  it->second.registration.Unregister();it=services_.erase(it);
 }
 for(const auto& [id,cap]:next) {
  if(services_.count(id))continue;
  auto object=std::make_shared<NativeCapabilityService>();
  object->id=id;object->kind=cap.kind;object->title=cap.title;object->contract=cap.contract;
  auto registration=context_.RegisterService<NativeCapabilityService>(object);
  services_.emplace(id,Entry{cap,registration});
 }
}
}
