#include "graph_ir.hpp"
#include <algorithm>
#include <regex>
#include <unordered_map>
#include <unordered_set>

namespace mas::ugraph {
namespace {
const std::regex kId{"^[A-Za-z][A-Za-z0-9_.:-]{0,79}$"};
const std::regex kContract{"^[a-z][a-z0-9_.-]{2,95}$"};
const std::regex kVersion{"^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$"};
bool match(const std::string& s, const std::regex& r) {
  return std::regex_match(s,r);
}
bool any(const std::string& value,
         std::initializer_list<const char*> values) {
  for(const char* s:values) if(value==s)return true;
  return false;
}
Result bad(const char* reason){return {false,reason,{}};}
bool dag(const std::string& kind){
  return any(kind,{"data","control","dependency"});
}
bool timed(const std::string& kind){
  return any(kind,{"event","neural"});
}
} // namespace

Result validate(const Graph& graph,std::size_t max_nodes,std::size_t max_edges){
  if(graph.schema!="mas.universal-graph.v1"||!match(graph.id,kId))
    return bad("invalid_graph_header");
  if(max_nodes<1||max_nodes>100000||max_edges<1||max_edges>1000000)
    return bad("invalid_budgets");
  if(graph.nodes.size()>max_nodes||graph.edges.size()>max_edges)
    return bad("graph_budget_exceeded");
  std::unordered_map<std::string,const Node*> nodes;
  std::unordered_map<std::string,std::unordered_map<std::string,const Port*>> ports;
  for(const auto& n:graph.nodes){
    if(!match(n.id,kId)||
       !any(n.kind,{"capability","composite","neural_region","resource","device","ui","policy"})||
       nodes.count(n.id)||n.ports.size()>128)return bad("invalid_node");
    if(n.has_binding&&(n.kind!="capability"||
       !match(n.binding.contract,kContract)||!match(n.binding.version,kVersion)))
      return bad("invalid_capability_binding");
    if(n.has_subgraph&&(n.kind!="composite"||!match(n.subgraph.id,kId)))
      return bad("invalid_subgraph_ref");
    std::unordered_map<std::string,const Port*> entries;
    for(const auto& p:n.ports){
      if(!match(p.id,kId)||entries.count(p.id)||
         !any(p.direction,{"in","out"})||
         !any(p.role,{"data","control","event","neural","authority","dependency"})||
         !match(p.datatype,kContract))return bad("invalid_port");
      entries[p.id]=&p;
    }
    nodes[n.id]=&n;ports.emplace(n.id,std::move(entries));
  }
  std::unordered_set<std::string> edge_ids;
  std::unordered_map<std::string,std::vector<std::string>> outgoing;
  std::unordered_map<std::string,std::size_t> degree;
  for(const auto& n:graph.nodes)degree[n.id]=0;
  for(const auto& e:graph.edges){
    if(!match(e.id,kId)||!edge_ids.insert(e.id).second||
       !any(e.kind,{"data","control","event","neural","authority","dependency"}))
      return bad("invalid_edge");
    auto f=ports.find(e.from_node),t=ports.find(e.to_node);
    if(f==ports.end()||t==ports.end())return bad("incompatible_typed_ports");
    auto fp=f->second.find(e.from_port),tp=t->second.find(e.to_port);
    if(fp==f->second.end()||tp==t->second.end()||
       fp->second->direction!="out"||tp->second->direction!="in"||
       fp->second->role!=e.kind||tp->second->role!=e.kind||
       fp->second->datatype!=tp->second->datatype)
      return bad("incompatible_typed_ports");
    if(e.feedback&&!timed(e.kind))return bad("invalid_feedback");
    if(e.from_node==e.to_node&&(dag(e.kind)||!e.feedback))
      return bad("self_cycle_forbidden");
    if(dag(e.kind)||(timed(e.kind)&&!e.feedback)){
      outgoing[e.from_node].push_back(e.to_node);
      ++degree[e.to_node];
    }
  }
  std::vector<std::string> queue;
  for(const auto& n:graph.nodes)
    if(degree.at(n.id)==0)queue.push_back(n.id);
  for(std::size_t i=0;i<queue.size();++i){
    for(const auto& next:outgoing[queue[i]])
      if(--degree[next]==0)queue.push_back(next);
  }
  if(queue.size()!=graph.nodes.size())return bad("directed_execution_cycle");
  return {true,"",std::move(queue)};
}
} // namespace mas::ugraph
