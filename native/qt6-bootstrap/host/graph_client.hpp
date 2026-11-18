#pragma once
#include "graph_events.hpp"
#include <QObject>
#include <QJsonObject>
#include <QNetworkAccessManager>
#include <QSet>
#include <QTimer>
#include <QUrl>
#include <cstdint>
class GraphClient final : public QObject {
 Q_OBJECT
public:
 explicit GraphClient(QObject* parent=nullptr);
 void start();
 void invoke(const QString& requestId,const QString& action,const QJsonObject& params);
signals:
 void graphChanged(const QJsonObject& graph);
 void availabilityChanged(bool available);
 void invocationCompleted(const QString& requestId,const QJsonObject& result,const QString& error);
private:
 void refresh();
 void requestRefresh();
 void setAvailable(bool yes);
 void revoke();
 QUrl origin_;
 QByteArray token_;
 QNetworkAccessManager network_;
 QTimer timer_;
 GraphEvents events_;
 QSet<QString> authorizedActions_;
 QJsonObject previous_;
 bool pending_=false,available_=false,dirty_=false;
 std::uint64_t revision_=0;
};
