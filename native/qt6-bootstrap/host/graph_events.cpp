#include "graph_events.hpp"
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QTimer>
GraphEvents::GraphEvents(QObject* parent):QObject(parent) {
 retry_.setSingleShot(true);
 watchdog_.setSingleShot(true);
 watchdog_.setInterval(45000);
 connect(&retry_,&QTimer::timeout,this,&GraphEvents::connectStream);
 connect(&watchdog_,&QTimer::timeout,this,[this]{if(stream_)stream_->abort();});
}
void GraphEvents::start(const QUrl& origin,const QByteArray& token) {
 origin_=origin;token_=token;stopped_=false;connectStream();
}
void GraphEvents::connectStream() {
 if(stopped_||stream_)return;
 parser_.reset();
 QNetworkRequest request(origin_.resolved(QUrl("/api/events")));
 request.setRawHeader("Authorization","Bearer "+token_);
 request.setRawHeader("Accept","text/event-stream");
 request.setAttribute(QNetworkRequest::RedirectPolicyAttribute,QNetworkRequest::ManualRedirectPolicy);
 auto* reply=net_.get(request);stream_=reply;
 connect(reply,&QNetworkReply::readyRead,this,[this,reply]{receive(reply);});
 connect(reply,&QNetworkReply::finished,this,[this,reply]{disconnected(reply);});
 watchdog_.start();
}
void GraphEvents::receive(QNetworkReply* reply) {
 if(stream_!=reply)return;
 if(reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt()!=200)return;
 const auto chunk=reply->readAll();if(chunk.isEmpty())return;
 watchdog_.start();
 try {
  for(const auto& event:parser_.feed(std::string_view(chunk.constData(),chunk.size()))) {
   if(event.type=="ready"||event.type=="invalidate") {
    backoffMs_=1500;
    if(!healthy_){healthy_=true;emit streamAvailable(true);}
    emit invalidated();
   }
  }
 }catch(const std::exception&) {reply->abort();}
}
void GraphEvents::disconnected(QNetworkReply* reply) {
 if(stream_!=reply){reply->deleteLater();return;}
 watchdog_.stop();stream_=nullptr;
 const auto status=reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
 reply->deleteLater();
 if(healthy_){healthy_=false;emit streamAvailable(false);}
 if(status==401||status==403){stopped_=true;emit denied();return;}
 if(!stopped_){retry_.start(backoffMs_);backoffMs_=qMin(backoffMs_*2,30000);}
}
