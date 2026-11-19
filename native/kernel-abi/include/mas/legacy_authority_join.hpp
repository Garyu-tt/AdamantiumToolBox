#pragma once
#include "mas/legacy_frame.hpp"
#include "mas/native_graph.hpp"
#include <cstdint>
#include <map>
#include <mutex>
#include <string>
#include <vector>

namespace mas::native::legacy {
// An untrusted observation can only REMOVE authority, never create it.
// This is a private read-only graph for LEGACY visibility, NOT an invoke API.
struct ObservedNode {
  std::string id;
  std::string type;
};
struct ObservedEdge {
  std::string from;
  std::string to;
  std::string type;
};
struct DiscoveryView {
  std::vector<ObservedNode> nodes;
  std::vector<ObservedEdge> edges;
};
// Accepts ONLY the strict canonical, filtered JSON emitted by N3a sidecar.
// No general JSON parser or alternate field order. Never infers grants/owners.
bool decode_discovery_v1(const Frame& message, DiscoveryView& out);

enum class ImportState {
  Applied, Quarantined, InvalidAuthority, StaleRevision, StaleSource,
  ResourceLimit
};
struct ImportResult {
  ImportState state = ImportState::Quarantined;
  std::uint64_t revision = 0;
};
struct VisibleNode {
  std::string id;
  std::string type;
  std::string owner;
  std::string contract;
};
struct VisibleDiscovery {
  bool current = false;
  bool online = false;
  std::uint64_t revision = 0;
  std::vector<VisibleNode> nodes;
  std::vector<ObservedEdge> edges;
};

class LegacyAuthorityJoin final {
 public:
  // Caller MUST first authenticate the host authority. The discovery sidecar
  // cannot provide AuthoritySnapshot, grants, signed identity or source_epoch.
  ImportResult ingest(std::uint64_t expected_revision,
                      const Frame& untrusted_observation,
                      const AuthoritySnapshot& host_authority);
  // Host must explicitly call this on EOF/timeout/sidecar death. A larger
  // source_epoch is required for the empty-snapshot revoke to commit.
  ImportResult disconnect(std::uint64_t expected_revision,
                          std::uint64_t source_epoch);
  VisibleDiscovery project(const std::string& principal,
                           std::uint64_t expected_revision) const;
  std::uint64_t revision() const;

 private:
  ImportResult revoke_locked(std::uint64_t expected_revision,
                             std::uint64_t source_epoch);
  mutable std::mutex mutex_;
  CapabilityGraph graph_;  // dedicated LEGACY graph; never overwrites native
  bool online_ = false;
  std::uint64_t last_request_id_ = 0;
  std::map<std::string, std::string> types_;
  std::vector<ObservedEdge> edges_;
};
}  // namespace mas::native::legacy
