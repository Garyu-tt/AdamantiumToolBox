#include "mas/legacy_authority_join.hpp"
#include <algorithm>
#include <set>
#include <string_view>
#include <utility>

namespace mas::native::legacy {
namespace {
bool valid_name(std::string_view s, std::size_t max = 128) {
  if (s.empty() || s.size() > max) return false;
  if (!((s[0] >= 'a' && s[0] <= 'z') ||
        (s[0] >= 'A' && s[0] <= 'Z'))) return false;
  for (unsigned char ch : s) {
    if (!((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
          (ch >= '0' && ch <= '9') || ch == '.' || ch == '_' || ch == '-'))
      return false;
  }
  return true;
}
bool valid_type(const std::string& s) {
  return s == "view" || s == "action" || s == "resource" || s == "event";
}
bool valid_contract(const std::string& s) {
  if (s.empty() || s.size() > 256) return false;
  return std::all_of(s.begin(), s.end(), [](unsigned char c) {
    return c >= 0x21 && c <= 0x7e;
  });
}
bool valid_authority(const AuthoritySnapshot& a) {
  if (!a.source_epoch || a.capabilities.size() > 4096 ||
      a.visible_to.size() > 65536) return false;
  std::set<std::string> ids;
  for (const auto& c : a.capabilities) {
    if (!valid_name(c.id) || !valid_name(c.owner) ||
        !valid_contract(c.contract) || !ids.insert(c.id).second)
      return false;
  }
  std::set<std::pair<std::string, std::string>> grants;
  for (const auto& g : a.visible_to) {
    if (!valid_name(g.principal) || !ids.count(g.capability) ||
        !grants.insert({g.principal,g.capability}).second)
      return false;
  }
  return true;
}
class CanonicalParser {
 public:
  explicit CanonicalParser(std::string_view text) : text_(text) {}
  bool literal(std::string_view s) {
    if (text_.substr(pos_,s.size())!=s) return false;
    pos_+=s.size();return true;
  }
  bool quoted(std::string& result, std::size_t max=128) {
    if(!literal("\""))return false;
    const std::size_t start=pos_;
    while(pos_<text_.size() && text_[pos_]!='"') {
      const auto c=static_cast<unsigned char>(text_[pos_]);
      if(c<0x21 || c>0x7e || c=='\\' || pos_-start>=max)return false;
      ++pos_;
    }
    if(pos_==text_.size()||pos_==start)return false;
    result=std::string(text_.substr(start,pos_-start));
    ++pos_;return true;
  }
  bool done() const {return pos_==text_.size();}
 private:
  std::string_view text_;
  std::size_t pos_=0;
};
ImportState status(ApplyStatus state) {
  switch (state) {
    case ApplyStatus::Applied: return ImportState::Applied;
    case ApplyStatus::StaleRevision: return ImportState::StaleRevision;
    case ApplyStatus::StaleSource: return ImportState::StaleSource;
    case ApplyStatus::ResourceLimit: return ImportState::ResourceLimit;
    case ApplyStatus::Invalid: return ImportState::InvalidAuthority;
  }
  return ImportState::InvalidAuthority;
}
} // namespace

bool decode_discovery_v1(const Frame& message, DiscoveryView& out) {
  if (message.opcode != Opcode::GraphResult || !message.request_id ||
      message.payload.empty() || message.payload.size()>kMaxPayload)
    return false;
  CanonicalParser p(std::string_view(
      reinterpret_cast<const char*>(message.payload.data()),message.payload.size()));
  if(!p.literal("{\"schema\":\"mas-legacy-discovery-1\",\"version\":1,\"nodes\":["))
    return false;
  DiscoveryView next;
  std::set<std::string> names;
  if(!p.literal("]")) {
    for (;;) {
      ObservedNode n;
      if(!p.literal("{\"id\":") || !p.quoted(n.id) ||
          !valid_name(n.id) || !p.literal(",\"type\":") ||
          !p.quoted(n.type,16) || !valid_type(n.type) ||
          !p.literal("}") || !names.insert(n.id).second)
        return false;
      next.nodes.push_back(std::move(n));
      if(next.nodes.size()>2048) return false;
      if(p.literal("]")) break;
      if(!p.literal(",")) return false;
    }
  }
  if(!p.literal(",\"edges\":[")) return false;
  if(!p.literal("]")) {
    for (;;) {
      ObservedEdge edge;
      if(!p.literal("{\"from\":") || !p.quoted(edge.from) ||
          !p.literal(",\"to\":") || !p.quoted(edge.to) ||
          !p.literal(",\"type\":") || !p.quoted(edge.type,32) ||
          !valid_name(edge.type,32) || !p.literal("}") ||
          !names.count(edge.from) || !names.count(edge.to))
        return false;
      next.edges.push_back(std::move(edge));
      if(next.edges.size()>4096)return false;
      if(p.literal("]"))break;
      if(!p.literal(","))return false;
    }
  }
  if(!p.literal("}") || !p.done())return false;
  out=std::move(next);
  return true;
}

ImportResult LegacyAuthorityJoin::revoke_locked(
    std::uint64_t expected_revision, std::uint64_t source_epoch) {
  // Even if an invalid/stale empty snapshot cannot commit, reads fail closed.
  online_=false;
  types_.clear();
  edges_.clear();
  auto r=graph_.reconcile(expected_revision,AuthoritySnapshot{source_epoch,{},{}});
  return {status(r.status),r.revision};
}
ImportResult LegacyAuthorityJoin::disconnect(
    std::uint64_t expected_revision,std::uint64_t source_epoch) {
  std::lock_guard<std::mutex> guard(mutex_);
  return revoke_locked(expected_revision,source_epoch);
}
ImportResult LegacyAuthorityJoin::ingest(
    std::uint64_t expected_revision,const Frame& observation,
    const AuthoritySnapshot& host_authority) {
  std::lock_guard<std::mutex> guard(mutex_);
  if(expected_revision!=graph_.revision())
    return {ImportState::StaleRevision,graph_.revision()};
  if(!valid_authority(host_authority)) {
    online_=false; types_.clear();edges_.clear();
    return {ImportState::InvalidAuthority,graph_.revision()};
  }
  DiscoveryView discovery;
  if(observation.request_id <= last_request_id_ ||
     !decode_discovery_v1(observation,discovery)) {
    const auto r=revoke_locked(expected_revision,host_authority.source_epoch);
    return {r.state==ImportState::Applied ?
      ImportState::Quarantined : r.state,r.revision};
  }
  std::set<std::string> observed;
  std::map<std::string,std::string> types;
  for(const auto& n:discovery.nodes) {
    observed.insert(n.id);
    types.emplace(n.id,n.type);
  }
  // Host grants remain the only source of owner, contract, visibility and
  // source epoch. Observation may only narrow these grants by intersection.
  AuthoritySnapshot scoped;
  scoped.source_epoch=host_authority.source_epoch;
  std::set<std::string> allowed;
  for(const auto& c:host_authority.capabilities) {
    if(observed.count(c.id)) {
      scoped.capabilities.push_back(c);
      allowed.insert(c.id);
    }
  }
  for(const auto& g:host_authority.visible_to)
    if(allowed.count(g.capability)) scoped.visible_to.push_back(g);
  auto r=graph_.reconcile(expected_revision,scoped);
  if(r.status!=ApplyStatus::Applied)
    return {status(r.status),r.revision};
  online_=true;
  last_request_id_=observation.request_id;
  types_.swap(types);
  edges_.swap(discovery.edges);
  return {ImportState::Applied,r.revision};
}
VisibleDiscovery LegacyAuthorityJoin::project(
    const std::string& principal,std::uint64_t expected_revision) const {
  std::lock_guard<std::mutex> guard(mutex_);
  VisibleDiscovery out;
  out.revision=graph_.revision();
  out.online=online_;
  if(!online_) return out;
  const auto v=graph_.project(principal,expected_revision);
  out.revision=v.revision;
  if(!v.current) return out;
  out.current=true;
  std::set<std::string> visible;
  for(const auto& c:v.capabilities) {
    const auto found=types_.find(c.id);
    if(found==types_.end())continue; // invariant defense
    out.nodes.push_back({c.id,found->second,c.owner,c.contract});
    visible.insert(c.id);
  }
  for(const auto& e:edges_) {
    if(visible.count(e.from) && visible.count(e.to))
      out.edges.push_back(e);
  }
  return out;
}
std::uint64_t LegacyAuthorityJoin::revision() const {
  std::lock_guard<std::mutex> guard(mutex_);
  return graph_.revision();
}
} // namespace mas::native::legacy
