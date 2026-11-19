#include "mas/native_dispatch.hpp"
#include <atomic>
#include <cstring>
#include <iostream>
#include <stdexcept>
#include <string>
using namespace mas::native;

#define REQUIRE(expr) do { if (!(expr)) { \
  std::cerr << "FAIL " << __FILE__ << ':' << __LINE__ << ": " << #expr << '\n'; \
  return 1; } } while (0)

int main() {
  CapabilityGraph graph;
  AuthoritySnapshot first{1, {{"echo", "host.echo", "mas.echo.v1"}},
                          {{"alice", "echo"}, {"bob", "echo"}}};
  REQUIRE(graph.reconcile(0, first).status == ApplyStatus::Applied);
  std::atomic<int> handled{0}, authorized{0};
  std::atomic_bool cancelled{false};
  bool policy_allows = true;
  NativeDispatcher dispatcher(graph, [&](std::string_view principal,
                                          std::string_view action,
                                          std::uint64_t revision) {
    ++authorized;
    return policy_allows && principal == "alice" &&
           action == "echo" && revision == 1;
  });
  auto echo = [&](std::string_view request, char* out, std::size_t cap,
                  std::size_t& written, const std::atomic_bool& cancel) {
    ++handled;
    if (cancel.load() || request.size() > cap) return false;
    if (!request.empty()) std::memcpy(out, request.data(), request.size());
    written = request.size();
    return true;
  };
  REQUIRE(dispatcher.bind("echo", "host.echo", echo));
  REQUIRE(!dispatcher.bind("echo", "host.echo", echo)); // duplicate binding
  char output[32] = {};
  auto call = [&](std::string_view who, std::uint64_t revision,
                  std::string_view payload) {
    return dispatcher.invoke(who, "echo", revision, payload,
                             output, sizeof(output), cancelled);
  };

  auto ok = call("alice", 1, "hello");
  REQUIRE(ok.status == InvokeStatus::Ok && ok.bytes == 5);
  REQUIRE(std::string(output, ok.bytes) == "hello");
  REQUIRE(handled == 1 && authorized == 1);
  REQUIRE(call("bob", 1, "private").status == InvokeStatus::Denied);
  REQUIRE(handled == 1 && authorized == 2); // graph visibility != invoke authority
  REQUIRE(call("eve", 1, "private").status == InvokeStatus::Denied);
  REQUIRE(handled == 1 && authorized == 2); // unauthorized view never reaches policy
  policy_allows = false;
  REQUIRE(call("alice", 1, "private").status == InvokeStatus::Denied);
  REQUIRE(handled == 1);
  policy_allows = true;
  REQUIRE(call("alice", 0, "bad").status == InvokeStatus::Invalid);
  REQUIRE(call("alice", 999, "bad").status == InvokeStatus::Stale);
  REQUIRE(dispatcher.invoke("alice", "echo", 1, "a", nullptr, 1,
                            cancelled).status == InvokeStatus::Invalid);
  REQUIRE(dispatcher.invoke("alice", "echo", 1,
      std::string(NativeDispatcher::kMaxBytes + 1, 'x'),
      output, sizeof(output), cancelled).status == InvokeStatus::Invalid);
  REQUIRE(dispatcher.invoke("alice", "echo", 1, "x", output,
      NativeDispatcher::kMaxBytes + 1, cancelled).status == InvokeStatus::Invalid);

  cancelled = true;
  REQUIRE(call("alice", 1, "private").status == InvokeStatus::Cancelled);
  REQUIRE(handled == 1);
  cancelled = false;

  // Denied and failed calls do not publish partial provider output.
  NativeDispatcher throwing(graph, [](auto, auto, auto) { return true; });
  REQUIRE(throwing.bind("echo", "host.echo", [](auto, char* dest,
                   std::size_t, std::size_t&, const auto&) -> bool {
    dest[0] = 'X';
    throw std::runtime_error("plugin_failure");
  }));
  output[0] = 'S';
  REQUIRE(throwing.invoke("alice", "echo", 1, "x", output, sizeof(output),
                          cancelled).status == InvokeStatus::HandlerFailed);
  REQUIRE(output[0] == 'S');
  NativeDispatcher overflowing(graph, [](auto, auto, auto) { return true; });
  REQUIRE(overflowing.bind("echo", "host.echo", [](auto, char* dest,
                      std::size_t size, std::size_t& written, const auto&) {
    dest[0] = 'X';
    written = size + 1;
    return true;
  }));
  output[0] = 'S';
  REQUIRE(overflowing.invoke("alice", "echo", 1, "x", output, sizeof(output),
                             cancelled).status == InvokeStatus::OutputLimit);
  REQUIRE(output[0] == 'S');

  // A host owner mismatch fails even if graph/policy visibility is granted.
  NativeDispatcher wrong_owner(graph, [](auto, auto, auto) { return true; });
  REQUIRE(wrong_owner.bind("echo", "forged.owner", echo));
  REQUIRE(wrong_owner.invoke("alice", "echo", 1, "x", output, sizeof(output),
                             cancelled).status == InvokeStatus::Denied);

  // Revoke between the initial graph lookup and point-of-use policy check.
  NativeDispatcher races(graph, [&](auto, auto, auto) {
    AuthoritySnapshot revoked{2, first.capabilities, {{"bob", "echo"}}};
    if (graph.reconcile(1, revoked).status != ApplyStatus::Applied)
      throw std::runtime_error("revocation_reconcile_failed");
    return true;
  });
  REQUIRE(races.bind("echo", "host.echo", echo));
  const auto before = handled.load();
  REQUIRE(races.invoke("alice", "echo", 1, "x", output, sizeof(output),
                       cancelled).status == InvokeStatus::Stale);
  REQUIRE(handled == before);
  REQUIRE(dispatcher.invoke("alice", "echo", 1, "x", output, sizeof(output),
                            cancelled).status == InvokeStatus::Stale);

  // Unbind while policy is consulting the authority must deny that copy.
  NativeDispatcher* current = nullptr;
  NativeDispatcher self_unbind(graph, [&](auto, auto, auto) {
    if (!current->unbind("echo"))
      throw std::runtime_error("unbind_failed");
    return true;
  });
  current = &self_unbind;
  REQUIRE(self_unbind.bind("echo", "host.echo", echo));
  REQUIRE(self_unbind.invoke("bob", "echo", 2, "x", output, sizeof(output),
                             cancelled).status == InvokeStatus::Unbound);
  REQUIRE(handled == before);

  // An in-flight physical side effect cannot be undone by this software API.
  // It requires an external fenced lease/transaction + idempotent outbox.
  std::cout << "MAS_NATIVE_DISPATCH_R01_OK: identity gate, CAS, no leak, cancel, revoke\n";
  return 0;
}
