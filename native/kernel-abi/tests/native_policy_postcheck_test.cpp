#include "mas/native_dispatch.hpp"
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <thread>
using namespace mas::native;
#define REQUIRE(x) do { if (!(x)) { std::cerr << "FAIL " << __LINE__ << ": " << #x << '\n'; return 1; } } while (0)
int main() {
  CapabilityGraph graph;
  AuthoritySnapshot snapshot{1, {{"test.read", "owner", "read.v1"}},
                             {{"alice", "test.read"}}};
  REQUIRE(graph.reconcile(0, snapshot).status == ApplyStatus::Applied);
  std::atomic_bool allow{true}, cancelled{false};
  std::mutex mutex;
  std::condition_variable signal;
  bool entered = false, release = false;
  std::atomic_int policy_queries{0};
  NativeDispatcher dispatcher(graph, [&](auto principal, auto action, auto revision) {
    ++policy_queries;
    return principal == "alice" && action == "test.read" &&
           revision == 1 && allow.load();
  });
  REQUIRE(dispatcher.bind("test.read", "owner", "read.v1",
      [&](auto, char* out, std::size_t size, std::size_t& written, const auto&) {
        std::unique_lock<std::mutex> lock(mutex);
        entered = true;
        signal.notify_all();
        if (!signal.wait_for(lock, std::chrono::seconds(3), [&] {return release;}))
          return false;
        if (size != 0) {out[0] = 'X'; written = 1;}
        return true;
      }));
  char output[8] = {'S'};
  InvokeResult outcome;
  std::thread worker([&] {
    outcome = dispatcher.invoke("alice", "test.read", 1, "", output,
                                sizeof(output), cancelled);
  });
  {
    std::unique_lock<std::mutex> lock(mutex);
    if (!signal.wait_for(lock, std::chrono::seconds(3), [&]{return entered;})) {
      release = true;
      signal.notify_all();
      lock.unlock(); worker.join(); return 2;
    }
  }
  // The graph is intentionally unchanged: policy can revoke independently.
  allow.store(false);
  {
    std::lock_guard<std::mutex> lock(mutex);
    release = true;
  }
  signal.notify_all();
  worker.join();
  REQUIRE(outcome.status == InvokeStatus::Denied);
  REQUIRE(outcome.bytes == 0);
  REQUIRE(output[0] == 'S');
  REQUIRE(policy_queries >= 2);
  std::cout << "NATIVE_POLICY_POSTCHECK_OK: revoked policy cannot publish buffered data\n";
  return 0;
}
