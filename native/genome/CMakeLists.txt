cmake_minimum_required(VERSION 3.21)
project(AdamantiumGenomeGA0 LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Graph IR is the only dependency. No mandatory Node.js, Rete, GPU or network.
add_library(mas_universal_graph STATIC ../universal-graph/src/universal_graph.cpp)
target_include_directories(mas_universal_graph PUBLIC
  "${CMAKE_CURRENT_SOURCE_DIR}/../universal-graph/include")

add_library(mas_genome STATIC src/genome.cpp)
target_include_directories(mas_genome PUBLIC
  "${CMAKE_CURRENT_SOURCE_DIR}/include")
target_link_libraries(mas_genome PUBLIC mas_universal_graph)

foreach(tgt IN ITEMS mas_universal_graph mas_genome)
  if(MSVC)
    target_compile_options(${tgt} PRIVATE /W4 /WX /utf-8)
  else()
    target_compile_options(${tgt} PRIVATE -Wall -Wextra -Wpedantic -Werror)
  endif()
endforeach()

add_executable(mas_genome_ga0_test tests/genome_test.cpp)
target_link_libraries(mas_genome_ga0_test PRIVATE mas_genome)
enable_testing()
add_test(NAME genome_graph_exact_roundtrip COMMAND mas_genome_ga0_test)

# GA1a: independent canonical binary genome contract. Node is OPTIONAL;
# native codec and C++ tests compile without Node.js or network.
add_library(mas_genome_wire STATIC src/genome_wire.cpp)
target_include_directories(mas_genome_wire PUBLIC
  "${CMAKE_CURRENT_SOURCE_DIR}/include")
target_link_libraries(mas_genome_wire PUBLIC mas_genome)
if(MSVC)
  target_compile_options(mas_genome_wire PRIVATE /W4 /WX /utf-8)
else()
  target_compile_options(mas_genome_wire PRIVATE -Wall -Wextra -Wpedantic -Werror)
endif()
add_executable(mas_genome_wire_test tests/genome_wire_test.cpp)
target_link_libraries(mas_genome_wire_test PRIVATE mas_genome_wire)
add_test(NAME genome_wire_ga1a_native COMMAND mas_genome_wire_test)
option(MAS_GENOME_NODE_INTEROP "Enable optional Node GA1a wire interop test" ON)
if(MAS_GENOME_NODE_INTEROP)
  find_program(MAS_GENOME_NODE_EXECUTABLE NAMES node node.exe)
  if(MAS_GENOME_NODE_EXECUTABLE)
    add_test(NAME genome_wire_ga1a_cpp_node
      COMMAND "${MAS_GENOME_NODE_EXECUTABLE}"
        "${CMAKE_CURRENT_SOURCE_DIR}/js/wire_interop.test.mjs"
        "$<TARGET_FILE:mas_genome_wire_test>")
    set_tests_properties(genome_wire_ga1a_cpp_node PROPERTIES TIMEOUT 20)
  endif()
endif()
