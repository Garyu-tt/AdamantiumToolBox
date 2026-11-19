#pragma once
// Universal Graph IR R01: C++17 editor-free and CPU-first typed structural layer.
// No process, network, editor, JSON runtime or authorization dependency.
#include <cstdint>
#include <cstddef>
#include <string>
#include <vector>

namespace mas::ugraph {
struct Port {
  std::string id, direction, role, datatype;
};
struct Binding {
  std::string contract, version;
};
struct SubgraphRef {
  std::string id;
  std::uint64_t revision = 0;
};
struct Node {
  std::string id, kind;
  std::vector<Port> ports;
  bool has_binding = false;
  Binding binding;
  bool has_subgraph = false;
  SubgraphRef subgraph;
};
struct Edge {
  std::string id, kind, from_node, from_port, to_node, to_port;
  bool feedback = false;
};
struct Graph {
  std::string schema, id;
  std::uint64_t revision = 0;
  std::vector<Node> nodes;
  std::vector<Edge> edges;
};
struct Result {
  bool valid = false;
  std::string error;
  std::vector<std::string> topological_order;
};
Result validate(const Graph& graph,
                std::size_t max_nodes = 512,
                std::size_t max_edges = 4096);
} // namespace mas::ugraph
