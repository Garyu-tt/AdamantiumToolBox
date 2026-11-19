#include "mas/universal_graph.hpp"
#include <chrono>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

using namespace mas::graph;
#define CHECK(expr) do { if (!(expr)) { \
  std::cerr << "FAIL " << __FILE__ << ':' << __LINE__ << " " << #expr << '\n'; \
  return 1; } } while (0)
Port in(std::string id, std::string type, Semantics sem = Semantics::Data) {
  return {std::move(id), std::move(type), Direction::Input, sem};
}
Port out(std::string id, std::string type, Semantics sem = Semantics::Data) {
  return {std::move(id), std::move(type), Direction::Output, sem};
}
Node cap(std::string id, std::string type, std::vector<Port> ports,
         NodeKind kind = NodeKind::Capability) {
  return {std::move(id), kind, std::move(type), "", std::move(ports)};
}
Node module(std::string id, std::string ref, std::vector<Port> ports = {}) {
  return {std::move(id), NodeKind::Composite, "", std::move(ref), std::move(ports)};
}
Edge edge(std::string id, std::string from, std::string fp,
          std::string to, std::string tp,
          Semantics semantics = Semantics::Data, std::uint32_t delay = 0) {
  return {std::move(id), std::move(from), std::move(fp),
          std::move(to), std::move(tp), semantics, delay};
}
bool fails(const Catalog& c, const std::string& root, ErrorCode why) {
  auto r = compile(c, root);
  return !r.ok && r.diagnostics.size() == 1 && r.diagnostics[0].code == why;
}

int main() {
  // Scenario A: a composite MAS program reusing a typed subgraph.
  Graph transform{"mas.transform", 1, Domain::Program,
      {in("request", "mas.value@1"), out("result", "mas.value@1")},
      {cap("decode", "mas.codec.decode@1",
           {in("data","mas.value@1"),out("value","mas.value@1")}),
       cap("encode", "mas.codec.encode@1",
           {in("value","mas.value@1"),out("data","mas.value@1")})},
      {edge("transform.flow","decode","value","encode","value")}};
  Graph program{"mas.program", 1, Domain::Program, {},
      {cap("source", "mas.source.read@1",{out("data","mas.value@1")}),
       module("subflow", "mas.transform", transform.interface_ports),
       cap("sink", "mas.output.write@1",{in("data","mas.value@1")})},
      {edge("input","source","data","subflow","request"),
       edge("output","subflow","result","sink","data")}};
  Catalog mas{{transform.id,transform},{program.id,program}};
  auto a=compile(mas,"mas.program");
  CHECK(a.ok && a.reachable_graphs==2 && a.nodes==5 && a.edges==3);
  CHECK(a.delayed_feedback==0);
  auto wrong_interface=mas;
  wrong_interface["mas.program"].nodes[1].ports[1].data_type="mas.bad@1";
  CHECK(fails(wrong_interface,"mas.program",ErrorCode::CompositeInterface));
  auto recursive=mas;
  recursive["mas.transform"].nodes.push_back(module("self","mas.program"));
  CHECK(fails(recursive,"mas.program",ErrorCode::CompositeCycle));

  // Scenario B: distributed GENESIS stages; hardware is a typed descriptor,
  // not automatically an execution right or GPU requirement.
  Graph genesis{"genesis.pipeline",1,Domain::Genesis,{},
      {cap("genome", "genesis.genome.lookup@1",
           {out("genome","genome.ref@1")}),
       cap("restore", "genesis.weight.restore@1",
           {in("genome","genome.ref@1"),out("tensor","tensor.handle@1"),
            in("device","runtime.device@1",Semantics::Route)}),
       cap("tensor", "genesis.tensor.consume@1",
           {in("tensor","tensor.handle@1")}),
       cap("cpu", "hardware.cpu@1",
           {out("device","runtime.device@1",Semantics::Route)},NodeKind::Device)},
      {edge("genome.ref","genome","genome","restore","genome"),
       edge("tensor.handle","restore","tensor","tensor","tensor"),
       edge("cpu.route","cpu","device","restore","device",Semantics::Route)}};
  Catalog genc{{genesis.id,genesis}};
  auto b=compile(genc,"genesis.pipeline");
  CHECK(b.ok && b.nodes==4 && b.edges==3);
  auto mismatched=genc;
  mismatched["genesis.pipeline"].nodes[2].ports[0].data_type="tensor.bytes@1";
  CHECK(fails(mismatched,"genesis.pipeline",ErrorCode::TypeMismatch));
  auto illegal_route=genc;
  illegal_route["genesis.pipeline"].edges[2].semantics=Semantics::Data;
  CHECK(fails(illegal_route,"genesis.pipeline",ErrorCode::PortMismatch));
  auto illegal_delay=genc;
  illegal_delay["genesis.pipeline"].edges[0].delay_ticks=1;
  CHECK(fails(illegal_delay,"genesis.pipeline",ErrorCode::IllegalDelay));

  // Scenario C: neural signal feedback with explicit delay: a cycle is
  // valid only because at least one signal edge crosses a time-step boundary.
  Graph neural{"dante.brain",1,Domain::Neural,{},
      {cap("left","neural.region@1",
            {in("signal","neural.spike@1",Semantics::Signal),
             out("signal_out","neural.spike@1",Semantics::Signal)},NodeKind::BrainRegion),
       cap("right","neural.region@1",
            {in("signal","neural.spike@1",Semantics::Signal),
             out("signal_out","neural.spike@1",Semantics::Signal)},NodeKind::BrainRegion)},
      {edge("forward","left","signal_out","right","signal",Semantics::Signal),
       edge("feedback","right","signal_out","left","signal",Semantics::Signal,1)}};
  Catalog brains{{neural.id,neural}};
  auto c=compile(brains,"dante.brain");
  CHECK(c.ok && c.delayed_feedback==1);
  auto immediate=brains;
  immediate["dante.brain"].edges[1].delay_ticks=0;
  CHECK(fails(immediate,"dante.brain",ErrorCode::InstantCycle));
  auto out_of_range=brains;
  out_of_range["dante.brain"].edges[1].to_port="missing";
  CHECK(fails(out_of_range,"dante.brain",ErrorCode::PortMismatch));

  // Policy edges are metadata, not executable data/control connections.
  Graph policy{"infra.trust",1,Domain::Infrastructure,{},
      {cap("issuer","policy.issuer@1",
           {out("rule","policy.rule@1",Semantics::Permission)},NodeKind::Policy),
       cap("router","network.router@1",
           {in("rule","policy.rule@1",Semantics::Permission)},NodeKind::Device)},
      {edge("policy.describes","issuer","rule","router","rule",Semantics::Permission)}};
  CHECK(compile({{policy.id,policy}},"infra.trust").ok);
  auto fake_authority=policy;
  fake_authority.edges[0].semantics=Semantics::Data;
  CHECK(fails({{policy.id,fake_authority}},"infra.trust",ErrorCode::PortMismatch));

  // Bounded validation and deterministic malformed-source rejection.
  CHECK(fails({},"none",ErrorCode::MissingGraph));
  auto old_version=mas;
  old_version["mas.program"].schema_version=2;
  CHECK(fails(old_version,"mas.program",ErrorCode::Version));
  auto dup=mas;
  dup["mas.program"].nodes.push_back(dup["mas.program"].nodes[0]);
  CHECK(fails(dup,"mas.program",ErrorCode::DuplicateId));
  auto bad_ref=mas;
  bad_ref["mas.program"].nodes[0].type_ref="some/secret/path";
  CHECK(fails(bad_ref,"mas.program",ErrorCode::TypeRef));
  auto resource=compile(mas,"mas.program",Limits{1,100000,200000,16});
  CHECK(!resource.ok && resource.diagnostics[0].code==ErrorCode::ResourceLimit);
  auto depth=compile(mas,"mas.program",Limits{2048,100000,200000,1});
  CHECK(!depth.ok && depth.diagnostics[0].code==ErrorCode::DepthLimit);

  // CPU-first large graph validation with no editor or Node.js runtime.
  Graph many{"graph.large",1,Domain::General,{},{},{}};
  constexpr int count=10000;
  many.nodes.reserve(count);
  for(int i=0;i<count;++i)
    many.nodes.push_back(cap("op."+std::to_string(i),"runtime.noop@1",{}));
  const auto start=std::chrono::steady_clock::now();
  const auto big=compile({{many.id,many}},"graph.large");
  const auto elapsed=std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::steady_clock::now()-start).count();
  CHECK(big.ok && big.nodes==count);
  CHECK(fails({{many.id,many}},"graph.large",ErrorCode::ResourceLimit)==false);
  const auto limited=compile({{many.id,many}},"graph.large",Limits{2048,9999,200000,16});
  CHECK(!limited.ok && limited.diagnostics[0].code==ErrorCode::ResourceLimit);
  std::cout<<"UGRAPH_G0_OK: MAS composite, GENESIS CPU, Dante feedback, "
             "typed domain policy, recursion, "<<count<<" nodes in "
           <<elapsed<<"ms\n";
  return 0;
}
