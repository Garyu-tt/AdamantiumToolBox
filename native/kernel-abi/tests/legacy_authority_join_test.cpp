#include "mas/legacy_authority_join.hpp"
#include <iostream>
#include <string>
#include <vector>
using namespace mas::native;
using namespace mas::native::legacy;
#define REQUIRE(x) do {if(!(x)){std::cerr<<"FAIL "<<__FILE__<<":"<<__LINE__<<" "<<#x<<"\n";return 1;}}while(0)

Frame observation(uint64_t id, const std::string& json) {
  return {Opcode::GraphResult,id,
          std::vector<uint8_t>(json.begin(),json.end())};
}
std::string json(const std::string& ids) {
  return "{\"schema\":\"mas-legacy-discovery-1\",\"version\":1,\"nodes\":["+
         ids+"],\"edges\":[]}";
}
int main() {
  const std::string node_a="{\"id\":\"alpha.read\",\"type\":\"resource\"}";
  const std::string node_b="{\"id\":\"beta.view\",\"type\":\"view\"}";
  const std::string ab="{\"schema\":\"mas-legacy-discovery-1\",\"version\":1,"
       "\"nodes\":["+node_a+","+node_b+"],\"edges\":["
       "{\"from\":\"alpha.read\",\"to\":\"beta.view\",\"type\":\"uses\"}]}";
  Frame source=observation(42,ab);
  DiscoveryView decoded;
  REQUIRE(decode_discovery_v1(source,decoded));
  REQUIRE(decoded.nodes.size()==2 && decoded.edges.size()==1);
  REQUIRE(decoded.nodes[0].id=="alpha.read");
  auto malformed=source;
  malformed.payload.push_back(' ');
  REQUIRE(!decode_discovery_v1(malformed,decoded));
  REQUIRE(decoded.nodes.size()==2); // invalid JSON leaves output untouched
  malformed=observation(43,json(node_a+","+node_a));
  REQUIRE(!decode_discovery_v1(malformed,decoded)); // duplicate observation
  malformed=observation(43,
    "{\"schema\":\"mas-legacy-discovery-1\",\"version\":1,"
    "\"nodes\":["+node_a+"],\"edges\":["
    "{\"from\":\"alpha.read\",\"to\":\"missing.read\",\"type\":\"uses\"}]}");
  REQUIRE(!decode_discovery_v1(malformed,decoded));
  malformed=observation(43,json("{\"id\":\"alpha.read\",\"type\":\"invoke\"}"));
  REQUIRE(!decode_discovery_v1(malformed,decoded));
  malformed=observation(43,
     "{\"schema\":\"mas-legacy-discovery-1\",\"version\":1,"
     "\"nodes\":[{\"id\":\"alpha.read\",\"type\":\"resource\","
     "\"requires\":[\"admin\"]}],\"edges\":[]}");
  REQUIRE(!decode_discovery_v1(malformed,decoded)); // extra fields cannot act as policy

  LegacyAuthorityJoin bridge;
  REQUIRE(bridge.revision()==0);
  AuthoritySnapshot host{1,{
    {"alpha.read","legacy.core","legacy.read.v1"},
    {"beta.view","legacy.ui","legacy.view.v1"},
    {"hidden.admin","privileged","admin.priv.v1"}},
    {{"alice","alpha.read"},{"alice","beta.view"},
     {"bob","beta.view"},{"eve","hidden.admin"}}};
  auto applied=bridge.ingest(0,source,host);
  REQUIRE(applied.state==ImportState::Applied && applied.revision==1);
  const auto alice=bridge.project("alice",1);
  REQUIRE(alice.online && alice.current && alice.nodes.size()==2);
  REQUIRE(alice.edges.size()==1);
  REQUIRE(alice.nodes[0].owner=="legacy.core");
  const auto bob=bridge.project("bob",1);
  REQUIRE(bob.current && bob.nodes.size()==1 && bob.edges.empty());
  REQUIRE(bob.nodes[0].id=="beta.view");
  const auto eve=bridge.project("eve",1);
  REQUIRE(eve.current && eve.nodes.empty()); // observation cannot expose unobserved authority
  REQUIRE(!bridge.project("alice",0).current);
  REQUIRE(!bridge.project("attacker",1).nodes.size());
  REQUIRE(bridge.ingest(0,source,host).state==ImportState::StaleRevision);

  // Sidecar *discovery* cannot add privilege just by announcing a new node.
  AuthoritySnapshot host2=host;host2.source_epoch=2;
  auto new_data=observation(43,json(node_a+
      ",{\"id\":\"attacker.root\",\"type\":\"action\"}"));
  REQUIRE(bridge.ingest(1,new_data,host2).state==ImportState::Applied);
  const auto a2=bridge.project("alice",2);
  REQUIRE(a2.nodes.size()==1 && a2.nodes[0].id=="alpha.read");
  REQUIRE(a2.edges.empty()); // beta vanished; no stale dependency edge
  REQUIRE(bridge.project("bob",2).nodes.empty());
  REQUIRE(bridge.project("eve",2).nodes.empty());
  REQUIRE(!bridge.project("alice",1).current);

  // Valid actor changes on host authority, no graph change, must revoke.
  AuthoritySnapshot host3=host;host3.source_epoch=3;
  host3.visible_to={{"bob","beta.view"}};
  REQUIRE(bridge.ingest(2,observation(44,ab),host3).state==ImportState::Applied);
  REQUIRE(bridge.project("alice",3).nodes.empty());
  REQUIRE(bridge.project("bob",3).nodes.size()==1);

  // Replayed request or malformed observation quarantines all visibility.
  auto replay=bridge.ingest(3,observation(44,ab),AuthoritySnapshot{
    4,host3.capabilities,host3.visible_to});
  REQUIRE(replay.state==ImportState::Quarantined && replay.revision==4);
  REQUIRE(!bridge.project("bob",4).current && !bridge.project("bob",4).online);
  REQUIRE(bridge.project("bob",4).nodes.empty());
  AuthoritySnapshot host5=host3;host5.source_epoch=5;
  REQUIRE(bridge.ingest(4,observation(45,ab),host5).state==ImportState::Applied);
  REQUIRE(bridge.project("bob",5).nodes.size()==1);

  // Upstream ERROR frame is never interpreted as a capability document.
  Frame upstream_error{Opcode::Error,46,{'d','e','n','i','e','d'}};
  AuthoritySnapshot host6=host5;host6.source_epoch=6;
  REQUIRE(bridge.ingest(5,upstream_error,host6).state==ImportState::Quarantined);
  REQUIRE(!bridge.project("bob",6).online);
  AuthoritySnapshot host7=host5;host7.source_epoch=7;
  REQUIRE(bridge.ingest(6,observation(47,ab),host7).state==ImportState::Applied);
  REQUIRE(bridge.disconnect(7,8).state==ImportState::Applied);
  REQUIRE(!bridge.project("bob",8).online);

  // Invalid host input never becomes an authorization snapshot.
  AuthoritySnapshot bad=host7;bad.source_epoch=9;
  bad.visible_to.push_back({"bob","missing"});
  REQUIRE(bridge.ingest(8,observation(48,ab),bad).state==ImportState::InvalidAuthority);
  REQUIRE(!bridge.project("bob",8).online);
  AuthoritySnapshot host10=host7;host10.source_epoch=10;
  REQUIRE(bridge.ingest(8,observation(49,ab),host10).state==ImportState::Applied);
  REQUIRE(bridge.project("bob",9).nodes.size()==1);
  REQUIRE(bridge.disconnect(9,10).state==ImportState::StaleSource);
  REQUIRE(!bridge.project("bob",9).online); // even failed disconnect fails closed
  AuthoritySnapshot host11=host7;host11.source_epoch=11;
  REQUIRE(bridge.ingest(9,observation(50,ab),host11).state==ImportState::Applied);
  REQUIRE(bridge.project("bob",10).nodes.size()==1);
  std::cout<<"MAS_LEGACY_AUTHORITY_JOIN_OK: no auto grants, filtered edges, replay, revocation, disconnect\n";
  return 0;
}
