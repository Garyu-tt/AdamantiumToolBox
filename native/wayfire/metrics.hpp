#pragma once
#include <cstddef>
#include <functional>
#include <string>
#include <string_view>
namespace mas::wayfire::diagnostics {
// Read-only, explicitly registered Wayfire IPC method. No mutation entrypoint.
constexpr std::size_t maxResponseBytes=1u<<20;
std::string renderMetricsRequest();
std::string readMetrics(const std::function<std::string(std::string_view)>& exchange);
}
