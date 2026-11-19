#pragma once
#include "mas/native_dispatch.hpp"
#include "mas_read_provider_v1.h"
#include <string>
namespace mas::native {
/* Host-only factory: adapters MUST be registered through NativeDispatcher::bind
 * with host-verified owner/contract/action. No plugin-side registration. */
bool bind_c_read_provider(NativeDispatcher& dispatcher,
                          const std::string& capability_id,
                          const std::string& owner,
                          const std::string& contract,
                          mas_read_provider_invoke_v1 callback,
                          void* trusted_context);
}  // namespace mas::native
