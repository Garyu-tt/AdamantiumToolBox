#pragma once
#include "sse.hpp"
#include <QObject>
#include <QNetworkAccessManager>
#include <QPointer>
#include <QTimer>
#include <QUrl>
class QNetworkReply;
class GraphEvents final : public QObject {
 Q_OBJECT
public:
 explicit GraphEvents(QObject* parent=nullptr);
 void start(const QUrl& origin,const QByteArray& token);
signals:
 void invalidated();
 void streamAvailable(bool available);
 void denied();
private:
 void connectStream();
 void receive(QNetworkReply* reply);
 void disconnected(QNetworkReply* reply);
 QUrl origin_;
 QByteArray token_;
 QNetworkAccessManager net_;
 QPointer<QNetworkReply> stream_;
 QTimer retry_,watchdog_;
 mas::events::Parser parser_;
 int backoffMs_=1500;
 bool stopped_=false,healthy_=false;
};
