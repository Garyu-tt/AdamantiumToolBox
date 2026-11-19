#include "mas/native_graph.hpp"
#include <atomic>
#include <iostream>
#include <thread>
#include <vector>

using namespace mas::native;
#define REQUIRE(expr) do { if (!(expr)) { \
  std::cerr << "FAIL " << __FILE__ << ':' << __LINE__ << ": " << #expr << '\n'; \
  return 1; } } while (0)

int main() {
  CapabilityGraph graph;
  AuthoritySnapshot first{1,
    {{"graph.read", "core", "mas.graph.read.v1"},
     {"motor.test", "dante", "dante.motor.test.v1"}},
    {{"alice", "graph.read"}, {"alice", "motor.test"},
     {"bob", "graph.read"}}};
  auto result = graph.reconcile(0, first);
  REQUIRE(result.status == ApplyStatus::Applied);
  REQUIRE(result.revision == 1 && result.changes.size() == 5);
  REQUIRE(graph.resolve("alice", "motor.test", 1).status == QueryStatus::Present);
  REQUIRE(graph.resolve("bob", "motor.test", 1).status == QueryStatus::Denied);
  REQUIRE(graph.resolve("", "graph.read", 1).status == QueryStatus::Denied);
  REQUIRE(graph.project("bob", 1).capabilities.size() == 1);
  REQUIRE(graph.project("missing", 1).capabilities.empty());

  AuthoritySnapshot empty_epoch{};
  REQUIRE(graph.reconcile(1, empty_epoch).status == ApplyStatus::Invalid);
  AuthoritySnapshot over_limit{2, std::vector<Capability>(4097), {}};
  REQUIRE(graph.reconcile(1, over_limit).status == ApplyStatus::ResourceLimit);
  REQUIRE(graph.revision() == 1);
  auto malformed = first;
  malformed.source_epoch = 2;
  malformed.capabilities.push_back(first.capabilities[0]);
  REQUIRE(graph.reconcile(1, malformed).status == ApplyStatus::Invalid);
  REQUIRE(graph.revision() == 1);
  malformed = first;
  malformed.source_epoch = 2;
  malformed.visible_to.push_back({"eve", "no-such-capability"});
  REQUIRE(graph.reconcile(1, malformed).status == ApplyStatus::Invalid);
  malformed = first;
  malformed.source_epoch = 2;
  malformed.visible_to.push_back({"alice", "motor.test"});
  REQUIRE(graph.reconcile(1, malformed).status == ApplyStatus::Invalid);
  malformed = first;
  malformed.source_epoch = 2;
  malformed.capabilities[0].id = "../bad";
  REQUIRE(graph.reconcile(1, malformed).status == ApplyStatus::Invalid);
  REQUIRE(graph.resolve("alice", "motor.test", 1).status == QueryStatus::Present);

  AuthoritySnapshot revoke{2, {{"graph.read", "core", "mas.graph.read.v1"}},
                            {{"bob", "graph.read"}}};
  auto removed = graph.reconcile(1, revoke);
  REQUIRE(removed.status == ApplyStatus::Applied && removed.revision == 2);
  REQUIRE(graph.resolve("alice", "motor.test", 1).status == QueryStatus::StaleRevision);
  REQUIRE(graph.resolve("alice", "motor.test", 2).status == QueryStatus::Denied);
  REQUIRE(graph.resolve("alice", "graph.read", 2).status == QueryStatus::Denied);
  REQUIRE(!graph.project("bob", 1).current);
  REQUIRE(graph.project("bob", 2).capabilities.size() == 1);
  REQUIRE(graph.reconcile(2, first).status == ApplyStatus::StaleSource);
  REQUIRE(graph.reconcile(1, revoke).status == ApplyStatus::StaleRevision);

  std::atomic<int> wins{0};
  std::vector<std::thread> threads;
  for (int i = 0; i < 12; ++i) {
    threads.emplace_back([&graph, &wins, i] {
      AuthoritySnapshot s{static_cast<std::uint64_t>(3 + i),
                          {{"graph.read", "core", "mas.graph.read.v1"}},
                          {{"bob", "graph.read"}}};
      if (graph.reconcile(2, s).status == ApplyStatus::Applied) ++wins;
    });
  }
  for (auto& t : threads) t.join();
  REQUIRE(wins.load() == 1);
  REQUIRE(graph.revision() == 3);
  REQUIRE(graph.resolve("bob", "graph.read", 3).status == QueryStatus::Present);
  REQUIRE(graph.resolve("bob", "graph.read", 2).status == QueryStatus::StaleRevision);
  const auto current_epoch = graph.revision();
  // A fresh authoritative snapshot fences pre-existing readers even if
  // the exact capability/grant set is unchanged.
  AuthoritySnapshot same{20, {{"graph.read", "core", "mas.graph.read.v1"}},
                         {{"bob", "graph.read"}}};
  auto newer = graph.reconcile(current_epoch, same);
  REQUIRE(newer.status == ApplyStatus::Applied && newer.changes.empty());
  REQUIRE(graph.resolve("bob", "graph.read", current_epoch).status == QueryStatus::StaleRevision);
  std::cout << "MAS_NATIVE_GRAPH_R01_OK: filtered visibility, CAS, revoke, replay, race\n";
  return 0;
}
