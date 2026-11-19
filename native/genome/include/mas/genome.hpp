#pragma once
#include "mas/universal_graph.hpp"
#include <cstdint>
#include <string>
#include <variant>
#include <vector>

namespace mas::genome {
inline constexpr std::uint32_t kGenomeVersion = 1;

// Lane describes provenance/intended governance, not runtime authority.
enum class Lane : std::uint8_t { Baseline, Acquired, Experimental };
enum class GeneKind : std::uint8_t { Header, InterfacePort, Node, NodePort, Edge };
struct HeaderGene {
  graph::Domain domain = graph::Domain::General;
  std::uint32_t schema_version = graph::kSchemaVersion;
  std::uint64_t revision = 1;
};
struct NodeGene {
  std::string id;
  graph::NodeKind kind = graph::NodeKind::Capability;
  std::string type_ref, graph_ref;
  std::uint64_t graph_ref_revision = 0;
};
struct PortGene {
  // Empty owner -> graph interface port; otherwise node-local port.
  std::string owner;
  graph::Port port;
};
struct EdgeGene { graph::Edge edge; };
using GeneBody = std::variant<HeaderGene, PortGene, NodeGene, EdgeGene>;

struct Gene {
  GeneKind kind = GeneKind::Header;
  std::uint32_t ordinal = 0;  // stable order within its owner/type
  GeneBody body;
};
struct Chromosome {
  std::string graph_id;  // the Graph IR identity, not an OS path
  std::vector<Gene> genes;  // linked by owner, node/port endpoints, graphRef
};
struct Genome {
  std::uint32_t version = kGenomeVersion;
  std::string genome_id;  // logical identity only; NOT a cryptographic digest
  std::string root_graph;
  Lane lane = Lane::Baseline;
  std::vector<Chromosome> chromosomes;
};

struct Validation {
  bool ok = false;
  std::string reason; // stable bounded error code, never source content
};
Validation encode_graphs(const graph::Catalog& graphs,
                         const std::string& root,
                         const std::string& genome_id,
                         Lane lane, Genome& out,
                         const graph::Limits& limits = {});
Validation decode_genome(const Genome& genome, graph::Catalog& out,
                         const graph::Limits& limits = {});

// Success guarantees exact typed structural roundtrip, not runtime equivalence.
// No expression may execute services, issue rights, decrypt keys, fetch binaries,
// install plugins or mutate the source graph. That belongs to separate plugins.
} // namespace mas::genome
