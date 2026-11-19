#pragma once
#include <cstdint>
#include <functional>
#include <map>
#include <stdexcept>
#include <string>
#include <vector>
namespace mas {
struct Capability {
 std::string id, kind, title, contract;
 bool operator==(const Capability& x) const noexcept {
  return id==x.id&&kind==x.kind&&title==x.title&&contract==x.contract;
 }
};
struct Change {
 enum class Type {Added,Modified,Revoked};
 Type type;Capability capability;
};
class CapabilityGraph final {
public:
 using Observer=std::function<void(std::uint64_t,const std::vector<Change>&)>;
 void subscribe(Observer observer);
 std::vector<Change> reconcile(const std::vector<Capability>& authorized);
 bool permitted(const std::string& id) const;
 std::uint64_t revision() const noexcept {return revision_;}
 std::size_t size() const noexcept {return nodes_.size();}
private:
 std::map<std::string,Capability> nodes_;
 std::vector<Observer> observers_;
 std::uint64_t revision_=0;
};
}
