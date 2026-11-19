#pragma once
#include <QHash>
#include <QJsonArray>
#include <QJsonObject>
#include <QSet>
#include <QString>
#include <QVector>
// Only typed, authorized view -> resource -> action edges are traversed.
// No unrelated/depends/opens cross-links become executable commands.
inline QSet<QString> discoverViewActions(const QJsonObject& graph,const QString& view) {
 QHash<QString,QString> kinds;
 for(const auto& value:graph.value("nodes").toArray()) {
  if(!value.isObject())continue;
  const auto node=value.toObject();
  const auto id=node.value("id").toString();
  const auto type=node.value("type").toString();
  if(!id.isEmpty()&&(type=="view"||type=="resource"||type=="action"))
   kinds.insert(id,type);
 }
 QSet<QString> result;
 if(kinds.value(view)!="view")return result;
 QHash<QString,QSet<QString>> graphEdges;
 for(const auto& value:graph.value("edges").toArray()) {
  if(!value.isObject())continue;
  const auto e=value.toObject();
  const auto from=e.value("from").toString(),to=e.value("to").toString();
  const auto relation=e.value("type").toString();
  const auto fromKind=kinds.value(from),toKind=kinds.value(to);
  const bool uses=relation=="uses"&&(fromKind=="view"||fromKind=="resource")&&
   (toKind=="resource"||toKind=="action");
  const bool provides=relation=="provides"&&fromKind=="resource"&&toKind=="action";
  if(uses||provides)graphEdges[from].insert(to);
 }
 QSet<QString> visited;
 QVector<QString> queue{view};
 for(qsizetype i=0;i<queue.size();++i) {
  const auto id=queue.at(i);
  if(visited.contains(id))continue;
  visited.insert(id);
  if(kinds.value(id)=="action") {
   result.insert(id);continue;
  }
  for(const auto& next:graphEdges.value(id))
   if(!visited.contains(next))queue.append(next);
 }
 return result;
}
