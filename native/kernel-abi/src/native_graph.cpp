#include "mas/native_graph.hpp"
#include <algorithm>
#include <cctype>
#include <limits>
namespace mas::native {
namespace {
constexpr std::size_t kMaxCapabilities = 4096;
constexpr std::size_t kMaxGrants = 65536;
constexpr std::size_t kMaxIdBytes = 128;
constexpr std::size_t kMaxContractBytes = 256;
bool valid_id(const std::string& id) {
  if (id.empty() || id.size() > kMaxIdBytes) return false;
  const auto first = static_cast<unsigned char>(id[0]);
  if (!((first >= 'a' && first <= 'z') || (first >= 'A' && first <= 'Z'))) return false;
  for (unsigned char c : id) {
    if (!((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
          (c >= '0' && c <= '9') || c == '.' || c == '_' || c == '-')) return false;
  }
  return true;
}
bool valid_contract(const std::string& s) {
  if (s.empty() || s.size() > kMaxContractBytes) return false;
  return std::all_of(s.begin(), s.end(), [](unsigned char c) {
    return c >= 0x21 && c <= 0x7e;
  });
}
}
ApplyResult CapabilityGraph::reconcile(
    std::uint64_t expected_revision, const AuthoritySnapshot& snapshot) {
  if (!snapshot.source_epoch || snapshot.capabilities.size() > kMaxCapabilities ||
      snapshot.visible_to.size() > kMaxGrants)
    return {snapshot.capabilities.size() > kMaxCapabilities ||
                    snapshot.visible_to.size() > kMaxGrants
                ? ApplyStatus::ResourceLimit : ApplyStatus::Invalid, revision(), {}};
  std::map<std::string, Capability> next;
  std::set<std::pair<std::string, std::string>> next_grants;
  for (const auto& cap : snapshot.capabilities) {
    if (!valid_id(cap.id) || !valid_id(cap.owner) || !valid_contract(cap.contract) ||
        !next.emplace(cap.id, cap).second)
      return {ApplyStatus::Invalid, revision(), {}};
  }
  for (const auto& g : snapshot.visible_to) {
    if (!valid_id(g.principal) || next.find(g.capability) == next.end() ||
        !next_grants.emplace(g.principal, g.capability).second)
      return {ApplyStatus::Invalid, revision(), {}};
  }
  std::lock_guard<std::mutex> lock(mutex_);
  if (expected_revision != revision_)
    return {ApplyStatus::StaleRevision, revision_, {}};
  if (snapshot.source_epoch <= source_epoch_)
    return {ApplyStatus::StaleSource, revision_, {}};
  if (revision_ == std::numeric_limits<std::uint64_t>::max())
    return {ApplyStatus::ResourceLimit, revision_, {}};

  std::vector<Change> changes;
  for (const auto& [id, cap] : capabilities_) {
    if (next.find(id) == next.end())
      changes.push_back({ChangeType::Removed, "", id});
  }
  for (const auto& [id, cap] : next) {
    const auto old = capabilities_.find(id);
    if (old == capabilities_.end()) changes.push_back({ChangeType::Added, "", id});
    else if (old->second != cap) changes.push_back({ChangeType::Modified, "", id});
  }
  for (const auto& g : visible_to_) {
    if (next_grants.count(g) == 0)
      changes.push_back({ChangeType::GrantRevoked, g.first, g.second});
  }
  for (const auto& g : next_grants) {
    if (visible_to_.count(g) == 0)
      changes.push_back({ChangeType::GrantAdded, g.first, g.second});
  }
  std::sort(changes.begin(), changes.end(), [](const Change& a, const Change& b) {
    if (a.capability != b.capability) return a.capability < b.capability;
    if (a.principal != b.principal) return a.principal < b.principal;
    return static_cast<int>(a.type) < static_cast<int>(b.type);
  });
  // All validation and diff allocation complete; mutation is a single commit.
  capabilities_.swap(next);
  visible_to_.swap(next_grants);
  source_epoch_ = snapshot.source_epoch;
  ++revision_;
  return {ApplyStatus::Applied, revision_, std::move(changes)};
}

QueryResult CapabilityGraph::resolve(
    const std::string& principal, const std::string& id,
    std::uint64_t expected_revision) const {
  std::lock_guard<std::mutex> lock(mutex_);
  if (expected_revision != revision_)
    return {QueryStatus::StaleRevision, revision_, std::nullopt};
  if (!valid_id(principal) || !valid_id(id) ||
      visible_to_.count({principal, id}) == 0)
    return {QueryStatus::Denied, revision_, std::nullopt};
  const auto it = capabilities_.find(id);
  if (it == capabilities_.end()) return {QueryStatus::Denied, revision_, std::nullopt};
  return {QueryStatus::Present, revision_, it->second};
}

Projection CapabilityGraph::project(
    const std::string& principal, std::uint64_t expected_revision) const {
  std::lock_guard<std::mutex> lock(mutex_);
  if (expected_revision != revision_) return {false, revision_, {}};
  Projection projection{true, revision_, {}};
  if (!valid_id(principal)) return projection;
  auto it = visible_to_.lower_bound({principal, ""});
  while (it != visible_to_.end() && it->first == principal) {
    const auto cap = capabilities_.find(it->second);
    if (cap != capabilities_.end()) projection.capabilities.push_back(cap->second);
    ++it;
  }
  return projection;
}

std::uint64_t CapabilityGraph::revision() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return revision_;
}
}  // namespace mas::native
