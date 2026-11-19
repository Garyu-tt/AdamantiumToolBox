#include "mas/native_dispatch.hpp"
#include <atomic>
#include <condition_variable>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <mutex>
#include <thread>
#include <vector>

using namespace mas::native;
#define REQUIRE(expr) do {if (!(expr)) { \
  std::cerr << "FAIL " << __FILE__ << ':' << __LINE__ << " " << #expr << '\n'; \
  return 1; } } while (0)

extern "C" {
struct mas_test_probe_state { unsigned int calls; };
mas_read_provider_status_v1 mas_test_echo_c(
  void*, const mas_read_provider_request_v1*, mas_read_provider_reply_v1*);
}

extern "C" mas_read_provider_status_v1 malformed_reply(
  void*, const mas_read_provider_request_v1*, mas_read_provider_reply_v1* reply) {
  reply->written = reply->capacity + 1;
  return MAS_READ_PROVIDER_OK;
}

struct Barrier {
  std::mutex mutex;
  std::condition_variable cv;
  bool entered = false;
  bool released = false;
};
extern "C" mas_read_provider_status_v1 slow_probe(
  void* context, const mas_read_provider_request_v1* req,
  mas_read_provider_reply_v1* reply) {
  auto* b = static_cast<Barrier*>(context);
  std::unique_lock<std::mutex> lock(b->mutex);
  b->entered = true;
  b->cv.notify_all();
  b->cv.wait(lock, [&] { return b->released; });
  if (req->is_cancelled(req->cancel_context)) return MAS_READ_PROVIDER_CANCELLED;
  reply->payload[0] = 0x7a;
  reply->written = 1;
  return MAS_READ_PROVIDER_OK;
}

int main() {
  CapabilityGraph graph;
  ReadOnlyDispatcher dispatch(graph);
  mas_test_probe_state probe{0};
  std::atomic<bool> cancel{false};
  std::vector<uint8_t> data{'a', 'b', 'c'};
  REQUIRE(dispatch.register_readonly("", "core", mas_test_echo_c, &probe) == DispatchStatus::Invalid);
  REQUIRE(dispatch.register_readonly("alpha.read", "core", nullptr, &probe) == DispatchStatus::Invalid);
  REQUIRE(dispatch.register_readonly("alpha.read", "core", mas_test_echo_c, &probe) == DispatchStatus::Ok);
  REQUIRE(dispatch.register_readonly("alpha.read", "core", mas_test_echo_c, &probe) == DispatchStatus::Invalid);
  REQUIRE(dispatch.invoke_readonly("alice", "alpha.read", 0, data, cancel).status == DispatchStatus::Denied);
  REQUIRE(probe.calls == 0);

  AuthoritySnapshot first{1,
    {{"alpha.read", "core", "mas.provider.read.v1"}},
    {{"alice", "alpha.read"}}};
  REQUIRE(graph.reconcile(0, first).status == ApplyStatus::Applied);
  REQUIRE(dispatch.invoke_readonly("bob", "alpha.read", 1, data, cancel).status == DispatchStatus::Denied);
  REQUIRE(dispatch.invoke_readonly("alice", "alpha.read", 0, data, cancel).status == DispatchStatus::StaleRevision);
  REQUIRE(dispatch.invoke_readonly("alice", "alpha.read", 1, std::vector<uint8_t>(8193), cancel).status == DispatchStatus::Invalid);
  REQUIRE(probe.calls == 0);
  cancel.store(true);
  REQUIRE(dispatch.invoke_readonly("alice", "alpha.read", 1, data, cancel).status == DispatchStatus::Cancelled);
  cancel.store(false);
  auto ok = dispatch.invoke_readonly("alice", "alpha.read", 1, data, cancel);
  REQUIRE(ok.status == DispatchStatus::Ok && ok.output == data && ok.revision == 1);
  REQUIRE(probe.calls == 1);

  // Provider impersonation cannot bypass the graph owner binding.
  REQUIRE(dispatch.register_readonly("beta.read", "attacker", mas_test_echo_c, &probe) == DispatchStatus::Ok);
  auto updated = first;
  updated.source_epoch = 2;
  updated.capabilities.push_back({"beta.read", "core", "mas.provider.read.v1"});
  updated.visible_to.push_back({"alice", "beta.read"});
  REQUIRE(graph.reconcile(1, updated).status == ApplyStatus::Applied);
  REQUIRE(dispatch.invoke_readonly("alice", "beta.read", 2, data, cancel).status == DispatchStatus::Denied);
  REQUIRE(dispatch.unregister_readonly("beta.read") == DispatchStatus::Ok);
  REQUIRE(dispatch.register_readonly("beta.read", "core", malformed_reply, nullptr) == DispatchStatus::Ok);
  REQUIRE(dispatch.invoke_readonly("alice", "beta.read", 2, data, cancel).status == DispatchStatus::ProviderError);
  REQUIRE(dispatch.unregister_readonly("beta.read") == DispatchStatus::Ok);

  Barrier barrier;
  REQUIRE(dispatch.register_readonly("beta.read", "core", slow_probe, &barrier) == DispatchStatus::Ok);
  DispatchResult inflight;
  std::thread worker([&] {
    inflight = dispatch.invoke_readonly("alice", "beta.read", 2, data, cancel);
  });
  {
    std::unique_lock<std::mutex> lock(barrier.mutex);
    barrier.cv.wait(lock, [&] { return barrier.entered; });
  }
  const auto busy = dispatch.unregister_readonly("beta.read");
  AuthoritySnapshot revoked{3, {{"alpha.read", "core", "mas.provider.read.v1"}},
                            {{"alice", "alpha.read"}}};
  auto revised = graph.reconcile(2, revoked);
  {
    std::lock_guard<std::mutex> lock(barrier.mutex);
    barrier.released = true;
  }
  barrier.cv.notify_all();
  worker.join();
  REQUIRE(busy == DispatchStatus::Busy);
  REQUIRE(revised.status == ApplyStatus::Applied);
  REQUIRE(inflight.status == DispatchStatus::StaleRevision && inflight.output.empty());
  REQUIRE(dispatch.unregister_readonly("beta.read") == DispatchStatus::Ok);
  REQUIRE(dispatch.invoke_readonly("alice", "beta.read", 3, data, cancel).status == DispatchStatus::Denied);
  REQUIRE(dispatch.invoke_readonly("alice", "alpha.read", 3, data, cancel).status == DispatchStatus::Ok);
  REQUIRE(dispatch.unregister_readonly("alpha.read") == DispatchStatus::Ok);
  REQUIRE(dispatch.invoke_readonly("alice", "alpha.read", 3, data, cancel).status == DispatchStatus::ProviderUnavailable);
  std::cout << "MAS_NATIVE_DISPATCH_R01_OK: C ABI, unauthorized, owner, revoke race, busy, bounds, cancel\n";
  return 0;
}
