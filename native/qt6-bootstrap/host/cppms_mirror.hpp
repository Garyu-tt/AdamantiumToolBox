#pragma once
#ifdef MAS_WITH_CPPMS
#include "registry.hpp"
#include <QJsonArray>
#include <QJsonObject>
#include <QDebug>
class CppMsMirror final {
public:
 void reconcile(const QJsonObject& snapshot) noexcept {
  try {
   std::vector<mas::Capability> allowed;
   for(const auto& value:snapshot.value("nodes").toArray()) {
    const auto node=value.toObject();
    allowed.push_back({node.value("id").toString().toStdString(),
      node.value("type").toString().toStdString(),
      node.value("title").toString().toStdString(),"mas-graph-1"});
   }
   registry_.reconcile(allowed);
  }catch(const std::exception& e){qWarning()<<"Native registry sync rejected:"<<e.what();}
 }
private:
 mas::CppMsRegistry registry_;
};
#endif
