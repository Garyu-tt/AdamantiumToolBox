#pragma once
#include <QHash>
#include <QJsonArray>
#include <QListWidget>
#include <QSet>
#include <QSignalBlocker>
inline void patchWorkspaceRows(QListWidget* list,const QJsonArray& updated,const QJsonArray& removed) {
 if(!list)return;
 QSignalBlocker lock(list);
 QHash<QString,QListWidgetItem*> existing;
 for(int i=0;i<list->count();++i)
  existing.insert(list->item(i)->data(Qt::UserRole).toString(),list->item(i));
 for(const auto& id:removed) {
  if(auto* item=existing.take(id.toString()))delete list->takeItem(list->row(item));
 }
 QSet<QString> seen;
 for(const auto& value:updated) {
  const auto n=value.toObject();
  const auto id=n.value("id").toString();
  if(id.isEmpty()||seen.contains(id)||n.value("type").toString()!="view")continue;
  seen.insert(id);
  auto* item=existing.value(id,nullptr);
  if(!item){item=new QListWidgetItem(list);item->setData(Qt::UserRole,id);}
  const auto title=n.value("title").toString(id);
  if(item->text()!=title)item->setText(title);
 }
}
