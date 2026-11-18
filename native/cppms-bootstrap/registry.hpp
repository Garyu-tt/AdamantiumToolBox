#pragma once
#include "mas/capability_graph.hpp"
#include <cppmicroservices/Framework.h>
#include <cppmicroservices/BundleContext.h>
#include <cppmicroservices/ServiceInterface.h>
#include <cppmicroservices/ServiceRegistration.h>
#include <map>
#include <string>
#include <vector>
namespace mas {
struct NativeCapabilityService {
 std::string id,kind,title,contract;
};
}
CPPMICROSERVICES_DECLARE_SERVICE_INTERFACE(mas::NativeCapabilityService,
 "org.mechanicus.capability.metadata/1.0")
namespace mas {
class CppMsRegistry final {
public:
 CppMsRegistry();
 ~CppMsRegistry();
 void reconcile(const std::vector<Capability>& authorized);
 std::size_t size() const noexcept {return services_.size();}
 cppmicroservices::BundleContext context() const {return context_;}
private:
 struct Entry {
  Capability capability;
  cppmicroservices::ServiceRegistration<NativeCapabilityService> registration;
 };
 cppmicroservices::Framework framework_;
 cppmicroservices::BundleContext context_;
 std::map<std::string,Entry> services_;
};
}
