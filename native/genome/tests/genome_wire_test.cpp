#include "mas/genome_wire.hpp"
#include <cstdint>
#include <iostream>
#include <iterator>
#include <string>
#include <vector>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif

using namespace mas::genome;
using namespace mas::genome::wire;
namespace g = mas::graph;
#define CHECK(c) do {if(!(c)){std::cerr<<"FAIL:"<<__LINE__<<" "<<#c<<"\n";return 1;}}while(0)

g::Port in(std::string id,std::string type,
           g::Semantics sem=g::Semantics::Data) {
  return {std::move(id),std::move(type),g::Direction::Input,sem};
}
g::Port out(std::string id,std::string type,
            g::Semantics sem=g::Semantics::Data) {
  return {std::move(id),std::move(type),g::Direction::Output,sem};
}
g::Node node(std::string id,std::string type,std::vector<g::Port> ports,
             g::NodeKind kind=g::NodeKind::Capability) {
  return {std::move(id),kind,std::move(type),"",std::move(ports),0};
}
g::Edge edge(std::string id,std::string from,std::string src,
             std::string to,std::string dst,
             g::Semantics sem=g::Semantics::Data,std::uint32_t delay=0) {
  return {std::move(id),std::move(from),std::move(src),
          std::move(to),std::move(dst),sem,delay};
}
g::Catalog sample() {
  const std::string val="mas.value@1";
  g::Graph module{"mas.transform",1,g::Domain::Program,
    {in("input",val),out("result",val)},
    {node("decode","mas.decode@1",{in("value",val),out("value_out",val)}),
     node("encode","mas.encode@1",{in("value",val),out("value_out",val)})},
    {edge("transform.edge","decode","value_out","encode","value")},3};
  g::Node child{"sub",g::NodeKind::Composite,"","mas.transform",
                 module.interface_ports,3};
  g::Graph program{"mas.program",1,g::Domain::Program,{},
    {node("load","mas.source@1",{out("result",val)}),
     child,
     node("send","mas.sink@1",{in("value",val)})},
    {edge("in","load","result","sub","input"),
     edge("out","sub","result","send","value")},4};
  const std::string spike="neural.spike@1";
  g::Graph brain{"dante.brain",1,g::Domain::Neural,{},
    {node("cortex","neural.region@1",
      {in("signal",spike,g::Semantics::Signal),
       out("result",spike,g::Semantics::Signal)},
       g::NodeKind::BrainRegion)},
    {edge("feedback","cortex","result","cortex","signal",
          g::Semantics::Signal,2)},8};
  const std::string rule="policy.rule@1";
  g::Graph network{"infra.policy",1,g::Domain::Infrastructure,{},
    {node("admin","policy.issuer@1",
       {out("grant",rule,g::Semantics::Permission)},g::NodeKind::Policy),
     node("router","network.router@1",
       {in("grant",rule,g::Semantics::Permission)},g::NodeKind::Device)},
    {edge("declares","admin","grant","router","grant",
          g::Semantics::Permission)},1};
  return {{module.id,module},{program.id,program},
          {brain.id,brain},{network.id,network}};
}
Genome fixture() {
  Genome genome;
  const auto result=encode_graphs(sample(),"mas.program","adamantium.genome",
                                  Lane::Baseline,genome);
  if(!result.ok)throw std::runtime_error(result.reason);
  return genome;
}
int selftest() {
  Genome genome=fixture();
  std::vector<std::uint8_t> bytes;
  CHECK(encode(genome,bytes)==Status::Ok);
  CHECK(bytes.size()>100 && bytes[0]=='A' && bytes[3]=='1');
  CHECK(bytes[4]==0 && bytes[5]==1 && bytes[8]==0 && bytes[9]==0);
  Genome decoded;
  CHECK(decode(bytes.data(),bytes.size(),decoded)==Status::Ok);
  CHECK(decoded.chromosomes.size()==4 &&
        decoded.genome_id=="adamantium.genome" &&
        decoded.root_graph=="mas.program");
  g::Catalog catalog;
  CHECK(decode_genome(decoded,catalog).ok);
  CHECK(catalog.at("dante.brain").edges[0].delay_ticks==2);
  CHECK(catalog.at("infra.policy").edges[0].semantics==
        g::Semantics::Permission);
  CHECK(catalog.at("mas.program").nodes[1].graph_ref_revision==3);
  std::vector<std::uint8_t> stable;
  CHECK(encode(decoded,stable)==Status::Ok && stable==bytes);
  const auto before=decoded;
  const auto original=bytes;
  bytes[5]=2;CHECK(decode(bytes.data(),bytes.size(),decoded)==
                   Status::UnsupportedVersion);
  CHECK(decoded.genome_id==before.genome_id);
  bytes=original;bytes[9]=1;
  CHECK(decode(bytes.data(),bytes.size(),decoded)==Status::Malformed);
  bytes=original;bytes.push_back(0);
  CHECK(decode(bytes.data(),bytes.size(),decoded)==Status::NonCanonical);
  bytes=original;bytes.resize(15);
  CHECK(decode(bytes.data(),bytes.size(),decoded)==Status::Truncated);
  bytes=original;
  CHECK(decode(bytes.data(),0,decoded)==Status::Truncated);
  CHECK(decode(nullptr,bytes.size(),decoded)==Status::Truncated);
  std::vector<std::uint8_t> untouched{'S'};
  Genome bad=genome;
  bad.chromosomes[0].graph_id="broken.name";
  CHECK(encode(bad,untouched)==Status::InvalidGenome);
  CHECK(untouched.size()==1 && untouched[0]=='S');
  bad=genome;bad.lane=static_cast<Lane>(255);
  CHECK(encode(bad,untouched)==Status::InvalidGenome);
  CHECK(untouched.size()==1);
  bad=genome;bad.chromosomes[0].genes[0].ordinal=10;
  CHECK(encode(bad,untouched)==Status::InvalidGenome);
  bad=genome;bad.chromosomes[0].genes[0].body=
     NodeGene{"root",g::NodeKind::Device,"host.admin@1","",0};
  CHECK(encode(bad,untouched)==Status::InvalidGenome);
  CHECK(bytes.size()<=kMaxWireBytes);
  std::cout<<"GENOME_WIRE_GA1A_OK: canonical network endian, "
              "4 typed graphs, invalid/truncated/no-write checks\n";
  return 0;
}
int main(int argc,char** argv) {
  if(argc==1)return selftest();
#ifdef _WIN32
  _setmode(_fileno(stdout),_O_BINARY);
  _setmode(_fileno(stdin),_O_BINARY);
#endif
  const std::string mode=argv[1];
  if(mode=="emit") {
    const Genome g=fixture();
    std::vector<std::uint8_t> bytes;
    if(encode(g,bytes)!=Status::Ok)return 3;
    std::cout.write(reinterpret_cast<const char*>(bytes.data()),bytes.size());
    return std::cout ? 0 : 4;
  }
  if(mode=="read") {
    std::vector<std::uint8_t> bytes;
    for(int ch;(ch=std::cin.get())!=EOF;) {
      if(bytes.size()>=kMaxWireBytes)return 6;
      bytes.push_back(static_cast<std::uint8_t>(ch));
    }
    Genome g;
    if(decode(bytes.data(),bytes.size(),g)!=Status::Ok)return 7;
    std::vector<std::uint8_t> canonical;
    if(encode(g,canonical)!=Status::Ok)return 8;
    std::cout.write(reinterpret_cast<const char*>(canonical.data()),
                    canonical.size());
    return std::cout?0:9;
  }
  return 2;
}
