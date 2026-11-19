add_library(mas_graphics_discovery STATIC
  ${CMAKE_CURRENT_LIST_DIR}/provider_selection.cpp
  ${CMAKE_CURRENT_LIST_DIR}/provider_selection.hpp)
target_link_libraries(mas_graphics_discovery PUBLIC Qt6::Core)
set_target_properties(mas_graphics_discovery PROPERTIES POSITION_INDEPENDENT_CODE ON)
target_include_directories(mas_graphics_discovery PUBLIC ${CMAKE_CURRENT_LIST_DIR})
target_link_libraries(mas_native_leonardo_view PRIVATE mas_graphics_discovery)
add_executable(mas_graphics_discovery_test
 ${CMAKE_CURRENT_LIST_DIR}/../../tests/provider_selection_test.cpp)
target_link_libraries(mas_graphics_discovery_test PRIVATE mas_graphics_discovery)
add_test(NAME native_graphics_discovery COMMAND mas_graphics_discovery_test)
