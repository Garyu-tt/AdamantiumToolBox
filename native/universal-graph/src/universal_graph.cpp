#include "mas/universal_graph.hpp"
#include <algorithm>
#include <map>
#include <queue>
#include <set>
#include <string>
#include <utility>
#include <vector>

namespace mas::graph {
namespace {

bool id_ok(const std::string& s) {
  if (s.empty() || s.size() > 128 ||
      !((s[0] >= 'a' && s[0] <= 'z'))) return false;
  for (unsigned char ch : s) {
    if (!((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') ||
          ch == '.' || ch == '_' || ch == '-')) return false;
  }
  return true;
}
bool ref_ok(const std::string& s) {
  const auto at = s.rfind('@');
  if (at == std::string::npos || at == 0 || at + 1 >= s.size())
    return false;
  if (!id_ok(s.substr(0, at))) return false;
  if (s[at + 1] == '0') return false;
  return std::all_of(s.begin() + static_cast<std::ptrdiff_t>(at + 1),
                     s.end(), [](unsigned char c) {
    return c >= '0' && c <= '9';
  });
}
bool port_equals(const Port& a, const Port& b) {
  return a.id == b.id && a.data_type == b.data_type &&
         a.direction == b.direction && a.semantics == b.semantics;
}
bool validate_ports(const std::vector<Port>& ports) {
  std::set<std::string> seen;
  for (const auto& p : ports) {
    if (!id_ok(p.id) || !ref_ok(p.data_type) ||
        !seen.insert(p.id).second) return false;
  }
  return true;
}
bool live_edge(const Edge& e) {
  if (e.semantics == Semantics::Permission ||
      e.semantics == Semantics::Route) return false;
  if ((e.semantics == Semantics::Event ||
       e.semantics == Semantics::Signal) && e.delay_ticks > 0)
    return false;
  return true;
}
class Compiler {
 public:
  Compiler(const Catalog& src, const Limits& lim)
      : catalog_(src), limits_(lim) {}
  CompileResult run(const std::string& root) {
    if (visit(root, 1) && result_.diagnostics.empty()) {
      // Validation is memoized per graph, but depth is a property of a PATH.
      // Revisit shared subgraphs only when reached at a greater depth.
      std::map<std::string, std::size_t> deepest;
      check_path_depth(root, 1, deepest);
    }
    result_.ok = result_.diagnostics.empty();
    return result_;
  }
 private:
  bool check_path_depth(const std::string& id, std::size_t depth,
                        std::map<std::string, std::size_t>& deepest) {
    if (depth > limits_.max_depth) {
      failure(ErrorCode::DepthLimit, id, "module_depth");
      return false;
    }
    const auto prior = deepest.find(id);
    if (prior != deepest.end() && prior->second >= depth) return true;
    deepest[id] = depth;
    const auto& graph = catalog_.at(id);  // Already validated by visit().
    for (const auto& node : graph.nodes) {
      if (node.kind == NodeKind::Composite &&
          !check_path_depth(node.graph_ref, depth + 1, deepest)) return false;
    }
    return true;
  }
  void failure(ErrorCode code, const std::string& graph,
               const std::string& subject) {
    if (result_.diagnostics.empty())
      result_.diagnostics.push_back({code, graph, subject});
  }
  bool visit(const std::string& id, std::size_t depth) {
    if (depth > limits_.max_depth) {
      failure(ErrorCode::DepthLimit, id, "module_depth");
      return false;
    }
    if (visiting_.count(id)) {
      failure(ErrorCode::CompositeCycle, id, "recursive_module");
      return false;
    }
    if (visited_.count(id)) return true;
    auto found = catalog_.find(id);
    if (found == catalog_.end()) {
      failure(ErrorCode::MissingGraph, id, "module_reference");
      return false;
    }
    if (result_.reachable_graphs >= limits_.max_graphs) {
      failure(ErrorCode::ResourceLimit, id, "max_graphs");
      return false;
    }
    const Graph& graph = found->second;
    if (graph.schema_version != kSchemaVersion || graph.revision == 0) {
      failure(ErrorCode::Version, id, "schema_version");
      return false;
    }
    if (!id_ok(id) || graph.id != id) {
      failure(ErrorCode::InvalidId, id, "graph_id");
      return false;
    }
    if (!validate_ports(graph.interface_ports)) {
      failure(ErrorCode::PortMismatch, id, "graph_interface");
      return false;
    }
    if (graph.nodes.size() > limits_.max_nodes - result_.nodes ||
        graph.edges.size() > limits_.max_edges - result_.edges) {
      failure(ErrorCode::ResourceLimit, id, "graph_size");
      return false;
    }
    result_.reachable_graphs++;
    result_.nodes += graph.nodes.size();
    result_.edges += graph.edges.size();
    visiting_.insert(id);
    std::map<std::string, const Node*> nodes;
    for (const auto& node : graph.nodes) {
      if (!id_ok(node.id)) {
        failure(ErrorCode::InvalidId, id, node.id);
        return false;
      }
      if (!nodes.emplace(node.id, &node).second) {
        failure(ErrorCode::DuplicateId, id, node.id);
        return false;
      }
      if (!validate_ports(node.ports)) {
        failure(ErrorCode::PortMismatch, id, node.id);
        return false;
      }
      if (node.kind == NodeKind::Composite) {
        if (!node.type_ref.empty() || !id_ok(node.graph_ref) ||
            node.graph_ref_revision == 0) {
          failure(ErrorCode::TypeRef, id, node.id);
          return false;
        }
        const auto child = catalog_.find(node.graph_ref);
        if (child == catalog_.end()) {
          failure(ErrorCode::MissingGraph, id, node.graph_ref);
          return false;
        }
        if (child->second.revision != node.graph_ref_revision) {
          failure(ErrorCode::CompositeRevision, id, node.id);
          return false;
        }
        // Exposed ports are an exact, order-independent contract. The UI
        // cannot silently expand a module's declared authority surface.
        const auto& interface = child->second.interface_ports;
        if (node.ports.size() != interface.size()) {
          failure(ErrorCode::CompositeInterface, id, node.id);
          return false;
        }
        std::map<std::string, const Port*> declared;
        for (const auto& port : node.ports) declared.emplace(port.id, &port);
        for (const auto& port : interface) {
          const auto match = declared.find(port.id);
          if (match == declared.end() || !port_equals(*match->second, port)) {
            failure(ErrorCode::CompositeInterface, id, node.id);
            return false;
          }
        }
      } else if (!ref_ok(node.type_ref) || !node.graph_ref.empty() ||
                 node.graph_ref_revision != 0) {
        failure(ErrorCode::TypeRef, id, node.id);
        return false;
      }
    }

    std::set<std::string> ids;
    std::map<std::string, std::size_t> indegree;
    std::map<std::string, std::vector<std::string>> outgoing;
    for (const auto& entry : nodes) indegree.emplace(entry.first, 0);
    for (const auto& edge : graph.edges) {
      if (!id_ok(edge.id)) {
        failure(ErrorCode::InvalidId, id, edge.id);
        return false;
      }
      if (!ids.insert(edge.id).second) {
        failure(ErrorCode::DuplicateId, id, edge.id);
        return false;
      }
      const auto from = nodes.find(edge.from_node);
      const auto to = nodes.find(edge.to_node);
      if (from == nodes.end() || to == nodes.end()) {
        failure(ErrorCode::Endpoint, id, edge.id);
        return false;
      }
      const Port* src = nullptr;
      const Port* dst = nullptr;
      for (const auto& p : from->second->ports) {
        if (p.id == edge.from_port) { src = &p; break; }
      }
      for (const auto& p : to->second->ports) {
        if (p.id == edge.to_port) { dst = &p; break; }
      }
      if (!src || !dst || src->direction != Direction::Output ||
          dst->direction != Direction::Input ||
          src->semantics != edge.semantics ||
          dst->semantics != edge.semantics) {
        failure(ErrorCode::PortMismatch, id, edge.id);
        return false;
      }
      if (src->data_type != dst->data_type) {
        failure(ErrorCode::TypeMismatch, id, edge.id);
        return false;
      }
      if (edge.delay_ticks &&
          edge.semantics != Semantics::Event &&
          edge.semantics != Semantics::Signal) {
        failure(ErrorCode::IllegalDelay, id, edge.id);
        return false;
      }
      if (edge.delay_ticks) result_.delayed_feedback++;
      if (live_edge(edge)) {
        outgoing[edge.from_node].push_back(edge.to_node);
        indegree[edge.to_node]++;
      }
    }
    std::queue<std::string> ready;
    for (const auto& entry : indegree)
      if (entry.second == 0) ready.push(entry.first);
    std::size_t sorted = 0;
    while (!ready.empty()) {
      const auto current = ready.front();
      ready.pop();
      ++sorted;
      for (const auto& next : outgoing[current]) {
        auto& counter = indegree[next];
        if (--counter == 0) ready.push(next);
      }
    }
    if (sorted != nodes.size()) {
      failure(ErrorCode::InstantCycle, id, "zero_delay_cycle");
      return false;
    }
    for (const auto& node : graph.nodes) {
      if (node.kind == NodeKind::Composite) {
        if (!visit(node.graph_ref, depth + 1)) return false;
      }
    }
    visiting_.erase(id);
    visited_.insert(id);
    return true;
  }
  const Catalog& catalog_;
  const Limits& limits_;
  CompileResult result_;
  std::set<std::string> visiting_;
  std::set<std::string> visited_;
};
}  // namespace

CompileResult compile(const Catalog& catalog, const std::string& root,
                      const Limits& limits) {
  return Compiler(catalog, limits).run(root);
}
}  // namespace mas::graph
