#include "graph_client.hpp"
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonParseError>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QProcessEnvironment>
GraphClient::GraphClient(QObject* parent):QObject(parent) {
 const auto env=QProcessEnvironment::systemEnvironment();
 origin_=QUrl(env.value("ADA_CORE_URL"));token_=env.value("ADA_TOKEN").toUtf8();
 timer_.setInterval(45000);
 connect(&timer_,&QTimer::timeout,this,&GraphClient::requestRefresh);
 connect(&events_,&GraphEvents::invalidated,this,&GraphClient::requestRefresh);
 connect(&events_,&GraphEvents::denied,this,&GraphClient::revoke);
 connect(&events_,&GraphEvents::streamAvailable,this,[this](bool yes) {
  timer_.setInterval(yes?45000:10000);
 });
}
void GraphClient::setAvailable(bool yes) {
 if(available_==yes)return;available_=yes;emit availabilityChanged(yes);
}
void GraphClient::revoke() {
 ++revision_;setAvailable(false);authorizedActions_.clear();
 if(!previous_.isEmpty()){previous_={};emit graphChanged(previous_);}
}
void GraphClient::start() {
 const auto host=origin_.host();
 const bool loopback=(host=="localhost"||host=="127.0.0.1"||host=="::1");
 const bool secure=origin_.scheme()=="https"||(origin_.scheme()=="http"&&loopback);
 if(!secure||!origin_.isValid()||!origin_.userInfo().isEmpty()||!origin_.query().isEmpty()||
    !origin_.fragment().isEmpty()||(origin_.path()!=""&&origin_.path()!="/")||token_.size()<24)return;
 refresh();events_.start(origin_,token_);timer_.start();
}
void GraphClient::requestRefresh() {if(pending_)dirty_=true;else refresh();}
void GraphClient::refresh() {
 if(pending_){dirty_=true;return;}pending_=true;
 QNetworkRequest request(origin_.resolved(QUrl("/api/graph")));
 request.setRawHeader("Authorization","Bearer "+token_);
 request.setAttribute(QNetworkRequest::RedirectPolicyAttribute,QNetworkRequest::ManualRedirectPolicy);
 request.setTransferTimeout(2500);
 const auto revision=revision_;
 auto* reply=network_.get(request);
 connect(reply,&QNetworkReply::finished,this,[this,reply,revision] {
  pending_=false;
  const bool again=dirty_;dirty_=false;
  if(revision!=revision_){reply->deleteLater();return;}
  const auto status=reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
  if(status==401||status==403){revoke();reply->deleteLater();return;}
  if(again)QTimer::singleShot(0,this,&GraphClient::requestRefresh);
  if(reply->error()!=QNetworkReply::NoError||status!=200){setAvailable(false);reply->deleteLater();return;}
  QJsonParseError parse;
  const auto document=QJsonDocument::fromJson(reply->readAll(),&parse);
  reply->deleteLater();
  if(parse.error!=QJsonParseError::NoError||!document.isObject()){setAvailable(false);return;}
  const auto object=document.object();
  if(!object.value("nodes").isArray()||!object.value("edges").isArray()){setAvailable(false);return;}
  QSet<QString> seen,actions;
  for(const auto& value:object.value("nodes").toArray()) {
   if(!value.isObject()){setAvailable(false);return;}
   const auto node=value.toObject();
   const auto id=node.value("id").toString(),kind=node.value("type").toString();
   if(id.isEmpty()||seen.contains(id)||kind.isEmpty()){setAvailable(false);return;}
   seen.insert(id);
   if(kind=="action")actions.insert(id);
  }
  authorizedActions_=actions;
  const bool wasAvailable=available_;
  setAvailable(true);
  if(!wasAvailable||previous_!=object){previous_=object;emit graphChanged(object);}
 });
}
void GraphClient::invoke(const QString& requestId,const QString& action,const QJsonObject& params) {
 if(requestId.isEmpty()||!available_||!authorizedActions_.contains(action)) {
  emit invocationCompleted(requestId,{},"action_unavailable_or_denied");return;
 }
 QNetworkRequest request(origin_.resolved(QUrl("/api/invoke")));
 request.setRawHeader("Authorization","Bearer "+token_);
 request.setHeader(QNetworkRequest::ContentTypeHeader,"application/json");
 request.setAttribute(QNetworkRequest::RedirectPolicyAttribute,QNetworkRequest::ManualRedirectPolicy);
 request.setTransferTimeout(15000);
 const QJsonObject payload{{"action",action},{"params",params}};
 auto* reply=network_.post(request,QJsonDocument(payload).toJson(QJsonDocument::Compact));
 connect(reply,&QNetworkReply::finished,this,[this,reply,requestId,action] {
  const int code=reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
  if(code==401||code==403)revoke();
  const auto data=reply->readAll();
  QJsonParseError parse;
  const auto doc=QJsonDocument::fromJson(data,&parse);
  const auto value=doc.isObject()?doc.object():QJsonObject{};
  QString error;
  if(!available_||!authorizedActions_.contains(action))error="permission_revoked";
  else if(reply->error()!=QNetworkReply::NoError||code!=200)
   error=value.value("error").toString("invoke_http_error");
  else if(parse.error!=QJsonParseError::NoError||!value.contains("result"))
   error="invalid_action_response";
  QJsonObject result;
  if(error.isEmpty())result.insert("result",value.value("result"));
  emit invocationCompleted(requestId,result,error);
  reply->deleteLater();
 });
}
