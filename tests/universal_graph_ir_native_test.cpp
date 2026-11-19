#include "../apps/universal_graph/native/graph_ir.hpp"
#include <cstdlib>
#include <iostream>
using namespace mas::ugraph;
static void require(bool condition,const char* reason){
  if(!condition){std::cerr<<reason<<'\n';std::exit(1);}
}
static Port port(const char* name,const char* direction,
                 const char* role,const char* type){
  return {name,direction,role,type};
}
static Node capability(const char* id,std::vector<Port> ports){
  Node n;
  n.id=id;n.kind="capability";n.ports=std::move(ports);
  n.has_binding=true;n.binding={"mas.feature.run.v1","1.0.0"};
  return n;
}
static Edge edge(const char* id,const char* kind,
                 const char* from,const char* out,
                 const char* to,const char* in,bool feedback=false){
  return {id,kind,from,out,to,in,feedback};
}
static Graph blank(const char* id){
  Graph g;g.schema="mas.universal-graph.v1";g.id=id;g.revision=1;
  return g;
}
int main(){
  auto pipeline=blank("mas.pipeline");
  pipeline.nodes={
    capability("load",{port("out","out","data","genesis.tensor.ref.v1")}),
    capability("restore",{port("in","in","data","genesis.tensor.ref.v1"),
      port("out","out","data","genesis.tensor.ref.v1")}),
    capability("consumer",{port("in","in","data","genesis.tensor.ref.v1")})
  };
  pipeline.edges={edge("e1","data","load","out","restore","in"),
                  edge("e2","data","restore","out","consumer","in")};
  require(validate(pipeline).valid,"MAS pipeline should validate");
  auto malformed=pipeline;
  malformed.edges[0].to_port="unknown";
  require(!validate(malformed).valid,"orphan port must fail");
  malformed=pipeline;
  malformed.edges.push_back(edge("e3","data","restore","out","restore","in"));
  require(!validate(malformed).valid,"data self cycle must fail");
  auto brain=blank("genesis.brain");
  Node visual;visual.id="visual";visual.kind="neural_region";
  visual.ports={port("in","in","neural","genesis.signal.v1"),
                port("out","out","neural","genesis.signal.v1")};
  Node association=visual;association.id="association";
  brain.nodes={visual,association};
  brain.edges={edge("n1","neural","visual","out","association","in"),
               edge("n2","neural","association","out","visual","in",true)};
  require(validate(brain).valid,"explicit neural feedback should validate");
  brain.edges[1].feedback=false;
  require(!validate(brain).valid,"implicit neural feedback must fail");
  auto infrastructure=blank("infra.policy");
  Node policy;policy.id="policy";policy.kind="policy";
  policy.ports={port("claim","out","authority","mas.policy.claim.v1")};
  Node machine;machine.id="server";machine.kind="device";
  machine.ports={port("claim","in","authority","mas.policy.claim.v1")};
  infrastructure.nodes={policy,machine};
  infrastructure.edges={edge("grant","authority","policy","claim","server","claim")};
  require(validate(infrastructure).valid,"authority description should validate");
  infrastructure.edges[0].kind="control";
  require(!validate(infrastructure).valid,"permission must not become control flow");
  auto composite=blank("mas.root");
  Node child;child.id="child";child.kind="composite";child.has_subgraph=true;
  child.subgraph={"mas.child",2};
  composite.nodes={child};
  require(validate(composite).valid,"pinned composite reference should validate");
  require(!validate(pipeline,1).valid,"node budget exceeded must fail");
  std::cout<<"Universal Graph IR native scenarios: PASS\n";
}
