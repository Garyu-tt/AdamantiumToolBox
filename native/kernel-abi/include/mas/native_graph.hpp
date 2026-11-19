#pragma once
#include <cstdint>
#include <map>
#include <mutex>
#include <optional>
#include <set>
#include <string>
#include <utility>
#include <vector>

namespace mas::native {
// The host, never an untrusted plugin, supplies policy-filtered snapshots.
// This local graph is NOT an authentication or invocation-authority boundary.
struct Capability {
  std::string id;
  std::string owner;
  std::string contract;
  bool operator==(const Capability& rhs) const noexcept {
    return id == rhs.id && owner == rhs.owner && contract == rhs.contract;
  }
  bool operator!=(const Capability& rhs) const noexcept { return !(*this == rhs); }
};
struct VisibilityGrant {
  std::string principal;
  std::string capability;
};
struct AuthoritySnapshot {
  std::uint64_t source_epoch = 0;
  std::vector<Capability> capabilities;
  std::vector<VisibilityGrant> visible_to;
};
enum class ApplyStatus { Applied, StaleRevision, StaleSource, Invalid, ResourceLimit };
enum class ChangeType { Added, Modified, Removed, GrantAdded, GrantRevoked };
struct Change {
  ChangeType type;
  std::string principal;
  std::string capability;
};
struct ApplyResult {
  ApplyStatus status = ApplyStatus::Invalid;
  std::uint64_t revision = 0;
  std::vector<Change> changes;
};
enum class QueryStatus { Present, Denied, StaleRevision };
struct QueryResult {
  QueryStatus status = QueryStatus::Denied;
  std::uint64_t revision = 0;
  std::optional<Capability> capability;
};
struct Projection {
  bool current = false;
  std::uint64_t revision = 0;
  std::vector<Capability> capabilities;
};

class CapabilityGraph final {
 public:
  // Compare-and-swap a COMPLETE, already verified host-side snapshot.
  // A source_epoch is a monotonic local token, not a signature or durable clock.
  ApplyResult reconcile(std::uint64_t expected_revision,
                        const AuthoritySnapshot& snapshot);
  QueryResult resolve(const std::string& principal, const std::string& id,
                      std::uint64_t expected_revision) const;
  Projection project(const std::string& principal,
                     std::uint64_t expected_revision) const;
  std::uint64_t revision() const;

 private:
  mutable std::mutex mutex_;
  std::uint64_t revision_ = 0;
  std::uint64_t source_epoch_ = 0;
  std::map<std::string, Capability> capabilities_;
  std::set<std::pair<std::string, std::string>> visible_to_;
};
}  // namespace mas::native
