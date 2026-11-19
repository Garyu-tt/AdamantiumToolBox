#include "registry.hpp"
#include <cppmicroservices/ServiceTracker.h>
#include <iostream>
#include <stdexcept>
void require(bool ok){if(!ok)throw std::logic_error("test_failed");}
int main() {
 mas::CppMsRegistry bridge;
 auto ctx=bridge.context();
 cppmicroservices::ServiceTracker<mas::NativeCapabilityService> tracker(ctx);
 tracker.Open();
 const mas::Capability a{"first.view","view","First","mas-view-1"};
 const mas::Capability b{"first.draw","action","Draw","mas-action-1"};
 require(tracker.GetServiceReferences().empty());
 bridge.reconcile({a});
 require(bridge.size()==1&&tracker.GetServiceReferences().size()==1);
 bridge.reconcile({a,b});
 require(tracker.GetServiceReferences().size()==2);
 bridge.reconcile({a,b});
 require(tracker.GetServiceReferences().size()==2);
 bool caught=false;
 try{bridge.reconcile({a,a});}catch(const std::invalid_argument&){caught=true;}
 require(caught&&bridge.size()==2);
 bridge.reconcile({b});
 require(tracker.GetServiceReferences().size()==1);
 bridge.reconcile({});
 require(tracker.GetServiceReferences().empty());
 tracker.Close();
 std::cout<<"CPPMS_REGISTRY_OK add/remove/revoke tracked services\n";
}
