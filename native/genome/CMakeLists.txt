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
