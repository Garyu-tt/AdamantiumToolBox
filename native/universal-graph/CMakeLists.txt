cmake_minimum_required(VERSION 3.21)
project(MechanicusUniversalGraph LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# The universal graph must compile without Node, Rete, Qt, GPU drivers, CppMS
# or any existing MAS runtime. It only validates graph structure.
add_library(mas_universal_graph STATIC src/universal_graph.cpp)
target_include_directories(mas_universal_graph PUBLIC
  "${CMAKE_CURRENT_SOURCE_DIR}/include")
if(MSVC)
  target_compile_options(mas_universal_graph PRIVATE /W4 /WX /utf-8)
else()
  target_compile_options(mas_universal_graph PRIVATE
    -Wall -Wextra -Wpedantic -Werror)
endif()

add_executable(mas_universal_graph_test tests/universal_graph_test.cpp)
target_link_libraries(mas_universal_graph_test PRIVATE mas_universal_graph)
enable_testing()
add_test(NAME universal_graph_three_domains COMMAND mas_universal_graph_test)
