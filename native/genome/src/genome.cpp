#include "mas/genome.hpp"
#include <algorithm>
#include <cstddef>
#include <limits>
#include <map>
#include <string>
#include <utility>

namespace mas::genome {
namespace {
Validation pass() { return {true,{}}; }
Validation reject(const char* code) { return {false,code}; }
bool identifier(const std::string& id) {
  if (id.empty() || id.size() > 128 || id[0] < 'a' || id[0] > 'z')
    return false;
  for (unsigned char c : id)
    if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ||
          c == '.' || c == '-' || c == '_')) return false;
  return true;
}
bool known_lane(Lane lane) {
  return lane == Lane::Baseline || lane == Lane::Acquired ||
         lane == Lane::Experimental;
}
bool fits(std::size_t used, std::size_t add, std::size_t max) {
  return used <= max && add <= max - used;
}
Validation validate_all(const graph::Catalog& catalog,
                        const std::string& root,
                        const graph::Limits& limits) {
  if (!identifier(root) || catalog.empty() ||
      catalog.size() > limits.max_graphs) return reject("catalog_limit");
  if (catalog.find(root) == catalog.end()) return reject("root_missing");
  std::size_t nodes=0, edges=0;
  for (const auto& entry : catalog) {
    const auto& g=entry.second;
    if (!fits(nodes,g.nodes.size(),limits.max_nodes) ||
        !fits(edges,g.edges.size(),limits.max_edges))
      return reject("graph_resource_limit");
    nodes+=g.nodes.size();
    edges+=g.edges.size();
    // Validate EACH chromosome, including unreachable/orphan definitions.
    const auto checked=graph::compile(catalog,entry.first,limits);
    if (!checked.ok) return reject("graph_ir_invalid");
  }
  return pass();
}
Gene header(const graph::Graph& g) {
  return {GeneKind::Header,0,HeaderGene{g.domain,g.schema_version,g.revision}};
}
} // namespace

Validation encode_graphs(const graph::Catalog& catalog,
                         const std::string& root,
                         const std::string& genome_id,
                         Lane lane, Genome& out,
                         const graph::Limits& limits) {
  if (!identifier(genome_id) || !known_lane(lane))
    return reject("genome_header_invalid");
  const auto valid=validate_all(catalog,root,limits);
  if (!valid.ok) return valid;
  Genome next;
  next.genome_id=genome_id;
  next.root_graph=root;
  next.lane=lane;
  next.chromosomes.reserve(catalog.size());
  for (const auto& [id,g] : catalog) {
    Chromosome chrom;
    chrom.graph_id=id;
    chrom.genes.push_back(header(g));
    for (std::size_t i=0;i<g.interface_ports.size();++i)
      chrom.genes.push_back({GeneKind::InterfacePort,
          static_cast<std::uint32_t>(i),PortGene{"",g.interface_ports[i]}});
    for (std::size_t i=0;i<g.nodes.size();++i) {
      const auto& n=g.nodes[i];
      chrom.genes.push_back({GeneKind::Node,static_cast<std::uint32_t>(i),
          NodeGene{n.id,n.kind,n.type_ref,n.graph_ref,n.graph_ref_revision}});
      for (std::size_t j=0;j<n.ports.size();++j)
        chrom.genes.push_back({GeneKind::NodePort,static_cast<std::uint32_t>(j),
            PortGene{n.id,n.ports[j]}});
    }
    for (std::size_t i=0;i<g.edges.size();++i)
      chrom.genes.push_back({GeneKind::Edge,static_cast<std::uint32_t>(i),
          EdgeGene{g.edges[i]}});
    next.chromosomes.push_back(std::move(chrom));
  }
  out=std::move(next);
  return pass();
}

Validation decode_genome(const Genome& genome, graph::Catalog& out,
                         const graph::Limits& limits) {
  if (genome.version != kGenomeVersion ||
      !identifier(genome.genome_id) || !identifier(genome.root_graph) ||
      !known_lane(genome.lane) || genome.chromosomes.empty() ||
      genome.chromosomes.size() > limits.max_graphs)
    return reject("genome_header_invalid");
  graph::Catalog next;
  std::size_t nodes=0,edges=0;
  for (const auto& chromosome : genome.chromosomes) {
    if (!identifier(chromosome.graph_id) || chromosome.genes.empty())
      return reject("chromosome_invalid");
    // Prevent unbounded decoding of malformed descriptions before Graph IR.
    if (chromosome.genes.size() >
        limits.max_nodes + limits.max_edges + 1) {
      // Port genes add extra entries, so this check is only a soft sanity cap;
      // valid graphs with many ports are handled by the stricter guard below.
      if (chromosome.genes.size() > 1000000)
        return reject("gene_resource_limit");
    }
    graph::Graph g;
    g.id=chromosome.graph_id;
    bool has_header=false,started_nodes=false,started_edges=false;
    std::size_t current_node=0;
    for (const auto& gene : chromosome.genes) {
      switch (gene.kind) {
        case GeneKind::Header: {
          const auto* data=std::get_if<HeaderGene>(&gene.body);
          if (!data || has_header || gene.ordinal!=0 ||
              started_nodes || started_edges)
            return reject("gene_header_invalid");
          g.domain=data->domain;
          g.schema_version=data->schema_version;
          g.revision=data->revision;
          has_header=true;
          break;
        }
        case GeneKind::InterfacePort: {
          const auto* data=std::get_if<PortGene>(&gene.body);
          if (!has_header || !data || !data->owner.empty() ||
              started_nodes || started_edges ||
              gene.ordinal!=g.interface_ports.size())
            return reject("gene_interface_invalid");
          g.interface_ports.push_back(data->port);
          break;
        }
        case GeneKind::Node: {
          const auto* data=std::get_if<NodeGene>(&gene.body);
          if (!has_header || !data || started_edges ||
              gene.ordinal!=g.nodes.size() ||
              !fits(nodes,1,limits.max_nodes))
            return reject("gene_node_invalid");
          started_nodes=true;
          current_node=g.nodes.size();
          ++nodes;
          g.nodes.push_back(graph::Node{
            data->id,data->kind,data->type_ref,data->graph_ref,{},
            data->graph_ref_revision});
          break;
        }
        case GeneKind::NodePort: {
          const auto* data=std::get_if<PortGene>(&gene.body);
          if (!has_header || !data || !started_nodes || started_edges ||
              g.nodes.empty() || current_node!=g.nodes.size()-1 ||
              data->owner!=g.nodes.back().id ||
              gene.ordinal!=g.nodes.back().ports.size())
            return reject("gene_node_port_invalid");
          g.nodes.back().ports.push_back(data->port);
          break;
        }
        case GeneKind::Edge: {
          const auto* data=std::get_if<EdgeGene>(&gene.body);
          if (!has_header || !data || gene.ordinal!=g.edges.size() ||
              !fits(edges,1,limits.max_edges))
            return reject("gene_edge_invalid");
          started_edges=true;
          ++edges;
          g.edges.push_back(data->edge);
          break;
        }
        default:
          return reject("unknown_gene_kind");
      }
    }
    if (!has_header || !next.emplace(g.id,std::move(g)).second)
      return reject("duplicate_or_missing_chromosome");
  }
  const auto valid=validate_all(next,genome.root_graph,limits);
  if (!valid.ok) return valid;
  out=std::move(next); // transactional publication on full success only
  return pass();
}
} // namespace mas::genome
