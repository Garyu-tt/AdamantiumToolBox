#pragma once
#include <cstddef>
#include <cstdint>
#include <map>
#include <string>
#include <vector>

namespace mas::graph {
inline constexpr std::uint32_t kSchemaVersion = 1;

enum class Domain {
  General, Program, Genesis, Neural, Infrastructure, Interface
};
enum class NodeKind {
  Capability, Composite, Service, Device, Sensor, Effector,
  BrainRegion, Resource, View, Policy
};
enum class Direction { Input, Output };
enum class Semantics {
  Data, Control, Event, Signal, Dependency, Permission, Route
};

// Types and semantics are symbolic, versioned contract identifiers.
// No source code, model weights, credentials or native pointers live in IR.
struct Port {
  std::string id;
  std::string data_type;
  Direction direction = Direction::Input;
  Semantics semantics = Semantics::Data;
};
struct Node {
  std::string id;
  NodeKind kind = NodeKind::Capability;
  // A capability / type contract such as genesis.weight.restore@1.
  // Empty for Composite: graph_ref is the only implementation reference.
  std::string type_ref;
  std::string graph_ref;
  std::vector<Port> ports;
  // 0 for ordinary nodes; composite pins a specific child graph revision.
  std::uint64_t graph_ref_revision = 0;
};
struct Edge {
  std::string id;
  std::string from_node;
  std::string from_port;
  std::string to_node;
  std::string to_port;
  Semantics semantics = Semantics::Data;
  // Delay is valid only for Event/Signal. A cycle requires >=1 delayed edge.
  std::uint32_t delay_ticks = 0;
};
struct Graph {
  std::string id;
  std::uint32_t schema_version = kSchemaVersion;
  Domain domain = Domain::General;
  // Composite nodes expose exactly the referenced graph's interface.
  std::vector<Port> interface_ports;
  std::vector<Node> nodes;
  std::vector<Edge> edges;
  std::uint64_t revision = 1;  // content revision, not an auth token
};
using Catalog = std::map<std::string, Graph>;

enum class ErrorCode {
  MissingGraph, Version, InvalidId, DuplicateId,
  TypeRef, PortMismatch, Endpoint, TypeMismatch,
  IllegalDelay, InstantCycle, CompositeCycle,
  CompositeInterface, CompositeRevision, DepthLimit, ResourceLimit
};
struct Diagnostic {
  ErrorCode code;
  std::string graph;
  std::string subject;
};
struct Limits {
  std::size_t max_graphs = 2048;
  std::size_t max_nodes = 100000;
  std::size_t max_edges = 200000;
  std::size_t max_depth = 16;
};
struct CompileResult {
  bool ok = false;
  std::size_t reachable_graphs = 0;
  std::size_t nodes = 0;
  std::size_t edges = 0;
  std::size_t delayed_feedback = 0;
  std::vector<Diagnostic> diagnostics;
};

// Structural compiler/validator only. No plugin loading, execution,
// hardware probing, authorization, persistence or editor dependency.
CompileResult compile(const Catalog& catalog, const std::string& root,
                      const Limits& limits = {});
}  // namespace mas::graph
