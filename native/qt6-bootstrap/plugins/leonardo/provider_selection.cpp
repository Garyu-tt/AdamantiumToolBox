#include "provider_selection.hpp"
#include <QHash>
#include <QJsonArray>
#include <QJsonValue>
#include <QSet>
#include <cmath>
namespace mas::graphics {
SelectedProvider selectSvg(const QJsonObject& graph) {
 QSet<QString> actions;
 QHash<QString,QSet<QString>> provides;
 for(const auto& entry:graph.value("nodes").toArray()) {
  if(!entry.isObject())continue;
  const auto node=entry.toObject();
  const auto id=node.value("id").toString();
  if(!id.isEmpty()&&node.value("type").toString()=="action")actions.insert(id);
 }
 for(const auto& entry:graph.value("edges").toArray()) {
  if(!entry.isObject())continue;
  const auto edge=entry.toObject();
  if(edge.value("type").toString()!="provides")continue;
  const auto from=edge.value("from").toString(),to=edge.value("to").toString();
  if(!from.isEmpty()&&!to.isEmpty())provides[from].insert(to);
 }
 SelectedProvider best;
 for(const auto& entry:graph.value("nodes").toArray()) {
  if(!entry.isObject())continue;
  const auto node=entry.toObject();
  if(node.value("type").toString()!="resource")continue;
  const auto id=node.value("id").toString();
  const auto provider=node.value("provider").toObject();
  if(id.isEmpty()||provider.value("schema").toString()!="mas-graphics-provider-1")continue;
  for(const auto& opValue:provider.value("operations").toArray()) {
   if(!opValue.isObject())continue;
   const auto op=opValue.toObject();
   const auto action=op.value("action").toString();
   if(op.value("kind").toString()!="image"||
      !op.value("formats").toArray().contains("image/svg+xml")||
      !actions.contains(action)||!provides.value(id).contains(action))continue;
   const auto value=op.value("priority");
   if(!value.isDouble())continue;
   const double numeric=value.toDouble();
   if(!std::isfinite(numeric)||numeric<-1000||numeric>1000)continue;
   const int priority=static_cast<int>(numeric);
   if(!best.valid()||priority>best.priority||
      (priority==best.priority&&(id<best.providerId||
       (id==best.providerId&&action<best.action)))) {
    best={action,id,priority};
   }
  }
 }
 return best;
}
}
