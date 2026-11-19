#pragma once
#include <QObject>
#include <QJsonArray>
#include <QJsonObject>
#include <QMap>
class HostBridge final:public QObject {
 Q_OBJECT
public:
 using QObject::QObject;
 Q_INVOKABLE QJsonArray views() const {return views_;}
 Q_INVOKABLE QJsonObject graph() const {return graph_;}
 Q_INVOKABLE bool available() const {return available_;}
 void setAvailable(bool yes) {
  if(available_!=yes){available_=yes;emit availabilityChanged(yes);}
 }
 void publish(const QJsonObject& next) {
  if(graph_==next)return;
  graph_=next;
  QMap<QString,QJsonObject> old,incoming;
  for(const auto& val:views_) {
   const auto obj=val.toObject();old.insert(obj.value("id").toString(),obj);
  }
  for(const auto& val:next.value("nodes").toArray()) {
   const auto obj=val.toObject();
   const auto id=obj.value("id").toString();
   if(obj.value("type").toString()=="view"&&!id.isEmpty())incoming.insert(id,obj);
  }
  QJsonArray sorted,changed,revoked;
  for(auto it=incoming.cbegin();it!=incoming.cend();++it) {
   sorted.append(it.value());
   if(!old.contains(it.key())||old.value(it.key())!=it.value())changed.append(it.value());
  }
  for(auto it=old.cbegin();it!=old.cend();++it)if(!incoming.contains(it.key()))revoked.append(it.key());
  if(views_!=sorted) {
   views_=sorted;
   if(!changed.isEmpty()||!revoked.isEmpty())emit viewsDelta(changed,revoked);
  }
  emit graphChanged(graph_);
 }
 Q_INVOKABLE void openView(const QString& id) {emit openRequested(id);}
 Q_INVOKABLE void invoke(const QString& requestId,const QString& action,const QJsonObject& params) {
  emit invokeRequested(requestId,action,params);
 }
 void complete(const QString& id,const QJsonObject& result,const QString& error) {
  emit invocationCompleted(id,result,error);
 }
signals:
 void viewsDelta(const QJsonArray& changed,const QJsonArray& revoked);
 void graphChanged(const QJsonObject& graph);
 void availabilityChanged(bool yes);
 void openRequested(const QString& id);
 void invokeRequested(const QString& requestId,const QString& action,const QJsonObject& params);
 void invocationCompleted(const QString& requestId,const QJsonObject& result,const QString& error);
private:
 bool available_=false;
 QJsonObject graph_;
 QJsonArray views_;
};
