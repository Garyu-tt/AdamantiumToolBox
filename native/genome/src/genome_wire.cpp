#include "mas/genome_wire.hpp"
#include <algorithm>
#include <array>
#include <cstddef>
#include <limits>
#include <utility>
namespace mas::genome::wire {
namespace {
constexpr std::size_t kMaxGenes=1000000;
struct Writer {
  std::vector<std::uint8_t> bytes;
  bool good=true;
  void number(std::uint64_t x, unsigned width) {
    if (!good || width>8 || bytes.size()>kMaxWireBytes ||
        width>kMaxWireBytes-bytes.size()) {good=false;return;}
    for(unsigned i=width;i>0;--i)
      bytes.push_back(static_cast<std::uint8_t>(x>>(8*(i-1))));
  }
  void text(const std::string& s) {
    if(s.size()>256) {good=false;return;}
    for(unsigned char c:s)
      if(c<0x20 || c>0x7e) {good=false;return;}
    number(s.size(),2);
    if(!good || s.size()>kMaxWireBytes-bytes.size()) {
      good=false;return;
    }
    bytes.insert(bytes.end(),s.begin(),s.end());
  }
  void port(const graph::Port& p) {
    text(p.id);text(p.data_type);
    number(static_cast<std::uint8_t>(p.direction),1);
    number(static_cast<std::uint8_t>(p.semantics),1);
  }
};
struct Reader {
  const std::uint8_t* ptr=nullptr;
  std::size_t length=0,pos=0;
  Status error=Status::Ok;
  bool number(std::uint64_t& x,unsigned width) {
    if(error!=Status::Ok)return false;
    if(width>8 || pos>length || width>length-pos){
      error=Status::Truncated;return false;
    }
    x=0;
    for(unsigned i=0;i<width;++i)x=(x<<8)|ptr[pos++];
    return true;
  }
  bool text(std::string& s) {
    std::uint64_t n=0;
    if(!number(n,2))return false;
    if(n>256){error=Status::ResourceLimit;return false;}
    if(pos>length || n>length-pos) {
      error=Status::Truncated;return false;
    }
    for(std::size_t i=0;i<n;++i)
      if(ptr[pos+i]<0x20 || ptr[pos+i]>0x7e) {
        error=Status::Malformed;return false;
      }
    s.assign(reinterpret_cast<const char*>(ptr+pos),
             static_cast<std::size_t>(n));
    pos+=static_cast<std::size_t>(n);
    return true;
  }
  bool port(graph::Port& p) {
    std::uint64_t d=0,s=0;
    if(!text(p.id)||!text(p.data_type)||!number(d,1)||!number(s,1))
      return false;
    p.direction=static_cast<graph::Direction>(d);
    p.semantics=static_cast<graph::Semantics>(s);
    return true;
  }
};
bool valid_structure(const Genome& genome) {
  graph::Catalog verify;
  if(!decode_genome(genome,verify).ok)return false;
  std::string previous;
  for(const auto& c:genome.chromosomes) {
    if(!previous.empty() && c.graph_id<=previous)return false;
    previous=c.graph_id;
  }
  return true;
}
void write_gene(Writer& w,const Gene& g) {
  w.number(static_cast<std::uint8_t>(g.kind),1);
  w.number(g.ordinal,4);
  switch(g.kind) {
    case GeneKind::Header: {
      const auto* b=std::get_if<HeaderGene>(&g.body);
      if(!b) {w.good=false;return;}
      w.number(static_cast<std::uint8_t>(b->domain),1);
      w.number(b->schema_version,4);
      w.number(b->revision,8);
      break;
    }
    case GeneKind::InterfacePort:
    case GeneKind::NodePort: {
      const auto* b=std::get_if<PortGene>(&g.body);
      if(!b) {w.good=false;return;}
      w.text(b->owner);w.port(b->port);break;
    }
    case GeneKind::Node: {
      const auto* b=std::get_if<NodeGene>(&g.body);
      if(!b) {w.good=false;return;}
      w.text(b->id);
      w.number(static_cast<std::uint8_t>(b->kind),1);
      w.text(b->type_ref);w.text(b->graph_ref);
      w.number(b->graph_ref_revision,8);
      break;
    }
    case GeneKind::Edge: {
      const auto* b=std::get_if<EdgeGene>(&g.body);
      if(!b) {w.good=false;return;}
      const auto& e=b->edge;
      w.text(e.id);w.text(e.from_node);w.text(e.from_port);
      w.text(e.to_node);w.text(e.to_port);
      w.number(static_cast<std::uint8_t>(e.semantics),1);
      w.number(e.delay_ticks,4);
      break;
    }
    default:w.good=false;
  }
}
bool read_gene(Reader& r,Gene& g) {
  std::uint64_t kind=0,ordinal=0;
  if(!r.number(kind,1)||!r.number(ordinal,4))return false;
  g.kind=static_cast<GeneKind>(kind);
  g.ordinal=static_cast<std::uint32_t>(ordinal);
  switch(g.kind) {
    case GeneKind::Header: {
      std::uint64_t d=0,v=0,rev=0;
      if(!r.number(d,1)||!r.number(v,4)||!r.number(rev,8))
        return false;
      g.body=HeaderGene{static_cast<graph::Domain>(d),
                        static_cast<std::uint32_t>(v),rev};
      return true;
    }
    case GeneKind::InterfacePort:
    case GeneKind::NodePort: {
      PortGene b;
      if(!r.text(b.owner)||!r.port(b.port))return false;
      g.body=std::move(b);
      return true;
    }
    case GeneKind::Node: {
      NodeGene b;std::uint64_t k=0;
      if(!r.text(b.id)||!r.number(k,1)||!r.text(b.type_ref)||
         !r.text(b.graph_ref)||!r.number(b.graph_ref_revision,8))
        return false;
      b.kind=static_cast<graph::NodeKind>(k);
      g.body=std::move(b);
      return true;
    }
    case GeneKind::Edge: {
      EdgeGene b;std::uint64_t semantics=0,delay=0;
      auto& e=b.edge;
      if(!r.text(e.id)||!r.text(e.from_node)||!r.text(e.from_port)||
         !r.text(e.to_node)||!r.text(e.to_port)||
         !r.number(semantics,1)||!r.number(delay,4))
        return false;
      e.semantics=static_cast<graph::Semantics>(semantics);
      e.delay_ticks=static_cast<std::uint32_t>(delay);
      g.body=std::move(b);
      return true;
    }
    default:r.error=Status::Malformed;return false;
  }
}
} // namespace

Status encode(const Genome& genome,std::vector<std::uint8_t>& out) {
  if(genome.version!=kGenomeVersion)return Status::UnsupportedVersion;
  if(!valid_structure(genome))return Status::InvalidGenome;
  Writer w;
  w.bytes.insert(w.bytes.end(),{'A','G','M','1'});
  w.number(kWireVersion,2);
  w.number(genome.version,2);
  w.number(static_cast<std::uint8_t>(genome.lane),1);
  w.number(0,1); // reserved; decoder rejects nonzero
  w.text(genome.genome_id);
  w.text(genome.root_graph);
  w.number(genome.chromosomes.size(),4);
  for(const auto& c:genome.chromosomes) {
    w.text(c.graph_id);
    w.number(c.genes.size(),4);
    for(const auto& g:c.genes)write_gene(w,g);
    if(!w.good)break;
  }
  if(!w.good)return Status::ResourceLimit;
  out.swap(w.bytes);
  return Status::Ok;
}
Status decode(const std::uint8_t* data,std::size_t size,Genome& out) {
  if(!data || size<10)return Status::Truncated;
  if(size>kMaxWireBytes)return Status::ResourceLimit;
  if(!std::equal(data,data+4,"AGM1"))return Status::Malformed;
  Reader r{data,size};
  r.pos=4;
  std::uint64_t wire=0,genome_version=0,lane=0,reserved=0;
  if(!r.number(wire,2)||!r.number(genome_version,2)||
     !r.number(lane,1)||!r.number(reserved,1))return r.error;
  if(wire!=kWireVersion || genome_version!=kGenomeVersion)
    return Status::UnsupportedVersion;
  if(reserved || lane>2)return Status::Malformed;
  Genome next;
  next.version=static_cast<std::uint32_t>(genome_version);
  next.lane=static_cast<Lane>(lane);
  if(!r.text(next.genome_id)||!r.text(next.root_graph))return r.error;
  std::uint64_t count=0;
  if(!r.number(count,4))return r.error;
  if(!count || count>2048)return Status::ResourceLimit;
  std::size_t genes_total=0;
  std::string previous;
  for(std::size_t ci=0;ci<count;++ci) {
    Chromosome c;
    if(!r.text(c.graph_id))return r.error;
    if(!previous.empty() && c.graph_id<=previous)return Status::NonCanonical;
    previous=c.graph_id;
    std::uint64_t n=0;
    if(!r.number(n,4))return r.error;
    if(!n || n>1000000 || n>kMaxGenes-genes_total)
      return Status::ResourceLimit;
    genes_total+=static_cast<std::size_t>(n);
    // No allocation proportional to arbitrary count until byte bounds pass.
    if(n> (size-r.pos)/5)return Status::Truncated;
    c.genes.reserve(static_cast<std::size_t>(n));
    for(std::size_t i=0;i<n;++i) {
      Gene g;
      if(!read_gene(r,g))return r.error;
      c.genes.push_back(std::move(g));
    }
    next.chromosomes.push_back(std::move(c));
  }
  if(r.pos!=size)return Status::NonCanonical;
  if(!valid_structure(next))return Status::InvalidGenome;
  std::vector<std::uint8_t> canonical;
  if(encode(next,canonical)!=Status::Ok)return Status::Malformed;
  if(canonical.size()!=size || !std::equal(canonical.begin(),canonical.end(),data))
    return Status::NonCanonical;
  out=std::move(next);
  return Status::Ok;
}
} // namespace mas::genome::wire
