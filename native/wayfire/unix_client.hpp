#pragma once
#include <chrono>
#include <string>
#include <string_view>
namespace mas::wayfire {
// Optional Linux-only socket client; execute from worker thread, never Qt event loop.
// Caller MUST check live MAS capability and local operator policy first.
std::string exchange(const std::string& configuredSocket,
 std::string_view requestJson,
 std::chrono::milliseconds timeout=std::chrono::milliseconds(1500));
}
