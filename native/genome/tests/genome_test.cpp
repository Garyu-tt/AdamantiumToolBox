#include "mas/genome.hpp"
#include <iostream>
#include <string>
#include <utility>
#include <vector>

using namespace mas::genome;
using namespace mas::graph;
#define CHECK(c) do { if (!(c)) { \
  std::cerr << "FAIL line " << __LINE__ << ": " << #c << "\n"; \
  return 1; } } while(0)

Port in(std::string id,std::string type,Semantics semantics=Semantics::Data) {
  return {std::move(id),std::move(type),Direction::Input,semantics};
}
Port out(std::string id,std::string type,Semantics semantics=Semantics::Data) {
  return {std::move(id),std::move(type),Direction::Output,semantics};
}
Node node(std::string id,std::string binding,std::vector<Port> ports,
          NodeKind kind=NodeKind::Capability) {
  return {std::move(id),kind,std::move(binding),"",std::move(ports),0};
}
Edge edge(std::string id,std::string a,std::string ap,std::string b,
          std::string bp,Semantics kind=Semantics::Data,std::uint32_t delay=0) {
  return {std::move(id),std::move(a),std::move(ap),
          std::move(b),std::move(bp),kind,delay};
}
bool equal_ports(const std::vector<Port>& a,const std::vector<Port>& b) {
  if (a.size()!=b.size()) return false;
  for (std::size_t i=0;i<a.size();++i)
    if (a[i].id!=b[i].id || a[i].data_type!=b[i].data_type ||
        a[i].direction!=b[i].direction ||
        a[i].semantics!=b[i].semantics) return false;
  return true;
}
bool equivalent(const Catalog& a,const Catalog& b) {
  if (a.size()!=b.size()) return false;
  for (const auto& [id,g]:a) {
    const auto it=b.find(id);
    if(it==b.end()) return false;
    const auto& h=it->second;
    if(g.id!=h.id || g.schema_version!=h.schema_version ||
       g.revision!=h.revision || g.domain!=h.domain ||
       !equal_ports(g.interface_ports,h.interface_ports) ||
       g.nodes.size()!=h.nodes.size() || g.edges.size()!=h.edges.size())
      return false;
    for(std::size_t i=0;i<g.nodes.size();++i) {
      const auto& x=g.nodes[i];const auto& y=h.nodes[i];
      if(x.id!=y.id || x.kind!=y.kind || x.type_ref!=y.type_ref ||
         x.graph_ref!=y.graph_ref ||
         x.graph_ref_revision!=y.graph_ref_revision ||
         !equal_ports(x.ports,y.ports)) return false;
    }
    for(std::size_t i=0;i<g.edges.size();++i) {
      const auto& x=g.edges[i];const auto& y=h.edges[i];
      if(x.id!=y.id || x.from_node!=y.from_node ||
         x.from_port!=y.from_port || x.to_node!=y.to_node ||
         x.to_port!=y.to_port || x.semantics!=y.semantics ||
         x.delay_ticks!=y.delay_ticks) return false;
    }
  }
  return true;
}
Catalog fixtures() {
  const std::string val="mas.value@1";
  Graph transform{"mas.transform",1,Domain::Program,
    {in("request",val),out("result",val)},
    {node("decode","mas.codec.decode@1",{in("data",val),out("value",val)}),
     node("encode","mas.codec.encode@1",{in("value",val),out("data",val)})},
    {edge("transform.flow","decode","value","encode","value")},1};
  Graph program{"mas.program",1,Domain::Program,{},
    {node("source","mas.source.read@1",{out("data",val)}),
     Node{"subflow",NodeKind::Composite,"","mas.transform",
          transform.interface_ports,1},
     node("sink","mas.output.write@1",{in("data",val)})},
    {edge("input","source","data","subflow","request"),
     edge("output","subflow","result","sink","data")},2};
  Graph genesis{"genesis.pipeline",1,Domain::Genesis,{},
    {node("genome","genesis.genome.lookup@1",
          {out("genome","genome.ref@1")},NodeKind::Resource),
     node("restore","genesis.weight.restore@1",
          {in("genome","genome.ref@1"),out("tensor","tensor.handle@1"),
           in("host","runtime.device@1",Semantics::Route)}),
     node("consumer","genesis.tensor.consume@1",
          {in("tensor","tensor.handle@1")}),
     node("cpu","hardware.cpu@1",
          {out("host","runtime.device@1",Semantics::Route)},NodeKind::Device)},
    {edge("genome.ref","genome","genome","restore","genome"),
     edge("tensor.handle","restore","tensor","consumer","tensor"),
     edge("cpu.route","cpu","host","restore","host",Semantics::Route)},4};
  Graph brain{"dante.brain",1,Domain::Neural,{},
    {node("region.left","neural.region@1",
          {in("signal","neural.spike@1",Semantics::Signal),
           out("signal_out","neural.spike@1",Semantics::Signal)},
          NodeKind::BrainRegion),
     node("region.right","neural.region@1",
          {in("signal","neural.spike@1",Semantics::Signal),
           out("signal_out","neural.spike@1",Semantics::Signal)},
          NodeKind::BrainRegion)},
    {edge("forward","region.left","signal_out",
          "region.right","signal",Semantics::Signal),
     edge("feedback","region.right","signal_out",
          "region.left","signal",Semantics::Signal,2)},7};
  Graph policy{"infra.security",1,Domain::Infrastructure,{},
    {node("issuer","policy.issuer@1",
          {out("rule","policy.rule@1",Semantics::Permission)},
          NodeKind::Policy),
     node("router","network.router@1",
          {in("rule","policy.rule@1",Semantics::Permission)},
          NodeKind::Device)},
    {edge("describes","issuer","rule","router","rule",
          Semantics::Permission)},8};
  return {{program.id,program},{transform.id,transform},{genesis.id,genesis},
          {brain.id,brain},{policy.id,policy}};
}
int main() {
  const Catalog origin=fixtures();
  Genome base;
  CHECK(encode_graphs(origin,"mas.program","adamantium.genome",
                      Lane::Baseline,base).ok);
  CHECK(base.version==1 && base.root_graph=="mas.program");
  CHECK(base.chromosomes.size()==5);
  Catalog restored;
  CHECK(decode_genome(base,restored).ok);
  CHECK(equivalent(origin,restored));

  // Content order and typed loci are deterministic for the same catalog.
  Genome replay;
  CHECK(encode_graphs(restored,"mas.program","adamantium.genome",
                      Lane::Baseline,replay).ok);
  CHECK(replay.chromosomes.size()==base.chromosomes.size());
  for(std::size_t i=0;i<base.chromosomes.size();++i) {
    CHECK(replay.chromosomes[i].graph_id==base.chromosomes[i].graph_id);
    CHECK(replay.chromosomes[i].genes.size()==base.chromosomes[i].genes.size());
    for(std::size_t j=0;j<base.chromosomes[i].genes.size();++j)
      CHECK(replay.chromosomes[i].genes[j].kind==
            base.chromosomes[i].genes[j].kind &&
            replay.chromosomes[i].genes[j].ordinal==
            base.chromosomes[i].genes[j].ordinal);
  }

  // The three lanes do not imply trusted promotion or a right to execute.
  for(Lane lane:{Lane::Baseline,Lane::Acquired,Lane::Experimental}) {
    Genome variant;
    CHECK(encode_graphs(origin,"dante.brain","adamantium.genome",
                        lane,variant).ok);
    Catalog decoded;
    CHECK(decode_genome(variant,decoded).ok);
    CHECK(equivalent(decoded,origin));
  }

  auto invalid=base;
  invalid.chromosomes[0].genes.erase(invalid.chromosomes[0].genes.begin());
  Catalog unchanged{{"sentinel",Graph{}}};
  CHECK(!decode_genome(invalid,unchanged).ok);
  CHECK(unchanged.size()==1 && unchanged.count("sentinel")==1);
  invalid=base;
  invalid.chromosomes.push_back(invalid.chromosomes.front());
  CHECK(!decode_genome(invalid,unchanged).ok);
  invalid=base;
  invalid.version=99;
  CHECK(!decode_genome(invalid,unchanged).ok);
  invalid=base;
  invalid.chromosomes[0].genes[0].kind=GeneKind::Edge;
  CHECK(!decode_genome(invalid,unchanged).ok);
  invalid=base;
  invalid.chromosomes[0].genes[0].body=NodeGene{"evil",NodeKind::Device,
                                               "host.root@1","",0};
  CHECK(!decode_genome(invalid,unchanged).ok);
  invalid=base;
  invalid.chromosomes[0].genes[1].ordinal=300;
  CHECK(!decode_genome(invalid,unchanged).ok);
  invalid=base;
  invalid.lane=static_cast<Lane>(255);
  CHECK(!decode_genome(invalid,unchanged).ok);
  invalid=base;
  if (auto* h=std::get_if<HeaderGene>(&invalid.chromosomes[0].genes[0].body))
    h->domain=static_cast<Domain>(255);
  CHECK(!decode_genome(invalid,unchanged).ok);
  invalid=base;
  bool corrupted_port=false;
  for(auto& chrom:invalid.chromosomes)
    for(auto& gene:chrom.genes)
      if(gene.kind==GeneKind::NodePort && !corrupted_port) {
        auto* item=std::get_if<PortGene>(&gene.body);
        if(item) { item->port.semantics=static_cast<Semantics>(255);
                    corrupted_port=true; }
      }
  CHECK(corrupted_port && !decode_genome(invalid,unchanged).ok);
  invalid=base;
  for(auto& chrom:invalid.chromosomes)
    if(chrom.graph_id=="mas.program")
      for(auto& gene:chrom.genes)
        if(gene.kind==GeneKind::Node) {
          auto* item=std::get_if<NodeGene>(&gene.body);
          if(item && item->id=="source")
            item->kind=static_cast<NodeKind>(255);
        }
  CHECK(!decode_genome(invalid,unchanged).ok);

  // A genome cannot gain authority by changing edge metadata to dataflow.
  invalid=base;
  for(auto& chrom:invalid.chromosomes)
    if(chrom.graph_id=="infra.security")
      for(auto& gene:chrom.genes)
        if(gene.kind==GeneKind::Edge) {
          auto* e=std::get_if<EdgeGene>(&gene.body);
          if(e) e->edge.semantics=Semantics::Data;
        }
  CHECK(!decode_genome(invalid,unchanged).ok);
  invalid=base;
  for(auto& chrom:invalid.chromosomes)
    if(chrom.graph_id=="dante.brain")
      for(auto& gene:chrom.genes)
        if(gene.kind==GeneKind::Edge) {
          auto* e=std::get_if<EdgeGene>(&gene.body);
          if(e && e->edge.id=="feedback") e->edge.delay_ticks=0;
        }
  CHECK(!decode_genome(invalid,unchanged).ok);
  invalid=base;
  for(auto& chrom:invalid.chromosomes)
    if(chrom.graph_id=="mas.program")
      for(auto& gene:chrom.genes)
        if(gene.kind==GeneKind::Node) {
          auto* n=std::get_if<NodeGene>(&gene.body);
          if(n && n->id=="subflow") n->graph_ref_revision=77;
        }
  CHECK(!decode_genome(invalid,unchanged).ok);

  Genome not_written;
  CHECK(!encode_graphs(origin,"mas.program","INVALID-ID",
                       Lane::Baseline,not_written).ok);
  CHECK(not_written.chromosomes.empty());
  Catalog huge=origin;
  Graph big{"graph.big",1,Domain::General,{},{},{},1};
  for(int i=0;i<10000;++i)
    big.nodes.push_back(node("unit."+std::to_string(i),"runtime.noop@1",{}));
  huge.emplace(big.id,big);
  Genome bulk;
  CHECK(encode_graphs(huge,"graph.big","adamantium.genome",
                      Lane::Baseline,bulk).ok);
  Catalog large_roundtrip;
  CHECK(decode_genome(bulk,large_roundtrip).ok);
  CHECK(equivalent(large_roundtrip,huge));
  CHECK(!encode_graphs(huge,"graph.big","adamantium.genome",
        Lane::Baseline,not_written,Limits{2048,9999,200000,16}).ok);

  std::cout<<"ADAMANTIUM_GENOME_GA0_OK: 5 graphs, 3 lanes, typed "
             "bijection, no grant, corrupt genes, 10000 nodes\n";
}
