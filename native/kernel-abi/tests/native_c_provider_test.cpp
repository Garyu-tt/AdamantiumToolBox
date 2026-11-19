#include "mas/native_c_provider.hpp"
#include <atomic>
#include <cstring>
#include <iostream>
#include <string>
using namespace mas::native;
#define REQUIRE(x) do{if(!(x)){std::cerr<<"FAIL "<<__LINE__<<": "<<#x<<"\n";return 1;}}while(0)
extern "C" {struct mas_probe_state {unsigned int invoked;};
mas_read_provider_status_v1 mas_probe_c_read(void*,const mas_read_provider_request_v1*,mas_read_provider_reply_v1*);}
extern "C" mas_read_provider_status_v1 bad_reply(void*,const mas_read_provider_request_v1*,mas_read_provider_reply_v1* r){r->written=r->capacity+1;return MAS_READ_PROVIDER_OK;}
int main(){
 CapabilityGraph graph;
 AuthoritySnapshot s{1,{{"alpha.read","core","mas.read.v1"},{"beta.read","core","mas.read.v1"}},{{"alice","alpha.read"},{"bob","alpha.read"},{"alice","beta.read"}}};
 REQUIRE(graph.reconcile(0,s).status==ApplyStatus::Applied);
 std::atomic_bool canceled{false};mas_probe_state probe{0};
 // Factory binds exact action and ABI callback together, never independently.
 NativeDispatcher reject(graph,[](auto,auto,auto){return true;});
 REQUIRE(!bind_c_read_provider(reject,"../bad","core","mas.read.v1",mas_probe_c_read,&probe));
 REQUIRE(!bind_c_read_provider(reject,"alpha.read","core","mas.read.v1",nullptr,&probe));
 NativeDispatcher dispatch(graph,[](auto principal,auto action,auto revision){return principal=="alice"&&action=="alpha.read"&&revision==1;});
 REQUIRE(bind_c_read_provider(dispatch,"alpha.read","core","mas.read.v1",mas_probe_c_read,&probe));
 char out[32]={};auto first=dispatch.invoke("alice","alpha.read",1,"echo",out,sizeof(out),canceled);
 REQUIRE(first.status==InvokeStatus::Ok&&first.bytes==4&&std::string(out,first.bytes)=="echo"&&probe.invoked==1);
 REQUIRE(dispatch.invoke("bob","alpha.read",1,"secret",out,sizeof(out),canceled).status==InvokeStatus::Denied);
 REQUIRE(dispatch.invoke("alice","alpha.read",99,"secret",out,sizeof(out),canceled).status==InvokeStatus::Stale);
 REQUIRE(probe.invoked==1);
 canceled=true;REQUIRE(dispatch.invoke("alice","alpha.read",1,"x",out,sizeof(out),canceled).status==InvokeStatus::Cancelled);canceled=false;
 REQUIRE(dispatch.invoke("alice","alpha.read",1,std::string(8193,'x'),out,sizeof(out),canceled).status==InvokeStatus::HandlerFailed);
 REQUIRE(probe.invoked==1);
 // Rejected reply cannot mutate the caller output.
 NativeDispatcher malformed(graph,[](auto,auto,auto){return true;});
 REQUIRE(bind_c_read_provider(malformed,"beta.read","core","mas.read.v1",bad_reply,nullptr));
 out[0]='S'; auto invalid=malformed.invoke("alice","beta.read",1,"a",out,sizeof(out),canceled);
 REQUIRE(invalid.status==InvokeStatus::HandlerFailed&&invalid.bytes==0&&out[0]=='S');
 s.source_epoch=2;s.visible_to={{"bob","alpha.read"}};
 REQUIRE(graph.reconcile(1,s).status==ApplyStatus::Applied);
 REQUIRE(dispatch.invoke("alice","alpha.read",1,"echo",out,sizeof(out),canceled).status==InvokeStatus::Stale);
 REQUIRE(dispatch.invoke("alice","alpha.read",2,"echo",out,sizeof(out),canceled).status==InvokeStatus::Denied);
 REQUIRE(dispatch.unbind("alpha.read"));
 std::cout<<"MAS_C_READ_PROVIDER_ADAPTER_OK: C11 callback, host policy, revoke, bounds, denial\n";
}
