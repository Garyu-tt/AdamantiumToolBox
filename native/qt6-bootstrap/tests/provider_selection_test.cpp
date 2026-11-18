#include "provider_selection.hpp"
#include <QCoreApplication>
#include <QJsonArray>
#include <QJsonObject>
#include <iostream>
using namespace mas::graphics;
static QJsonObject resource(QString id,QString action,int rank) {
 return {{"id",id},{"type","resource"},{"provider",QJsonObject{
  {"schema","mas-graphics-provider-1"},{"operations",QJsonArray{
   QJsonObject{{"kind","image"},{"action",action},{"formats",QJsonArray{"image/svg+xml"}},{"priority",rank}}
  }}}}};
}
static QJsonObject act(QString id) {
 return {{"id",id},{"type","action"}};
}
static QJsonObject edge(QString provider,QString action) {
 return {{"from",provider},{"to",action},{"type","provides"}};
}
int main(int argc,char** argv) {
 QCoreApplication app(argc,argv);
 QJsonArray nodes{resource("a.provider","a.draw",5),resource("b.provider","b.draw",15),
  act("a.draw"),act("b.draw")};
 QJsonArray edges{edge("a.provider","a.draw"),edge("b.provider","b.draw")};
 QJsonObject graph{{"nodes",nodes},{"edges",edges}};
 auto selected=selectSvg(graph);
 if(selected.action!="b.draw"||selected.priority!=15)return 1;
 nodes.removeAt(3);
 graph["nodes"]=nodes;
 selected=selectSvg(graph);
 if(selected.action!="a.draw")return 2;
 nodes.removeAt(2);
 graph["nodes"]=nodes;
 if(selectSvg(graph).valid())return 3;
 nodes.append(act("b.draw"));graph["nodes"]=nodes;
 selected=selectSvg(graph);
 if(selected.action!="b.draw")return 4;
 graph["edges"]=QJsonArray{};
 if(selectSvg(graph).valid())return 5;
 nodes.append(act("unrelated.view"));graph["nodes"]=nodes;
 if(selectSvg(graph).valid())return 6;
 nodes.append(resource("fake.provider","ghost.draw",100));graph["nodes"]=nodes;
 if(selectSvg(graph).valid())return 7;
 graph["edges"]=edges;
 nodes.append(act("a.draw"));graph["nodes"]=nodes;
 selected=selectSvg(graph);
 if(selected.action!="b.draw")return 8;
 std::cout<<"MAS_GRAPHICS_DISCOVERY_OK priority, graph edges, revoke, forged providers\n";
}
