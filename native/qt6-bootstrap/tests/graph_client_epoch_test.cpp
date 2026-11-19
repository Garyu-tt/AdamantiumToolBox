#include "graph_client.hpp"
#include <QJsonObject>
#include <QJsonArray>
#include <QPointer>
#include <QSignalSpy>
#include <QTcpServer>
#include <QTcpSocket>
#include <QTest>
class PermissionRace final:public QObject {
 Q_OBJECT
private slots:
 void staleReplyNotAcceptedAfterRevokeAndRestore() {
  const QByteArray token="test_bearer_token_long_enough_for_authorization";
  QTcpServer server;QVERIFY(server.listen(QHostAddress::LocalHost,0));
  QPointer<QTcpSocket> eventSocket,heldReply;
  bool delayFirst=true;
  QByteArray graph=R"({"nodes":[{"type":"action","id":"draw"},{"type":"view","id":"ui"}],"edges":[]})";
  QObject::connect(&server,&QTcpServer::newConnection,&server,[&] {
   auto* sock=server.nextPendingConnection();
   QObject::connect(sock,&QTcpSocket::readyRead,&server,[&,sock] {
    const QByteArray req=sock->readAll();
    if(!req.contains("Authorization: Bearer "+token))return;
    if(req.startsWith("GET /api/events")) {
     eventSocket=sock;
     sock->write("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\n"
      "Connection: keep-alive\r\n\r\nevent: ready\ndata: {}\n\n");
     sock->flush();return;
    }
    if(req.startsWith("GET /api/graph")) {
     const auto response=QByteArray("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n")
      +"Content-Length: "+QByteArray::number(graph.size())+"\r\nConnection: close\r\n\r\n"+graph;
     sock->write(response);sock->flush();sock->disconnectFromHost();return;
    }
    if(req.startsWith("POST /api/invoke")) {
     if(delayFirst) {heldReply=sock;delayFirst=false;return;}
     const QByteArray response=R"({"result":{"status":"completed"}})";
     sock->write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "+
      QByteArray::number(response.size())+"\r\nConnection: close\r\n\r\n"+response);
     sock->flush();sock->disconnectFromHost();
    }
   });
  });
  qputenv("ADA_CORE_URL",QString("http://127.0.0.1:%1/").arg(server.serverPort()).toUtf8());
  qputenv("ADA_TOKEN",token);
  GraphClient client;
  QSignalSpy changed(&client,&GraphClient::graphChanged);
  QSignalSpy completed(&client,&GraphClient::invocationCompleted);
  client.start();
  QTRY_COMPARE_WITH_TIMEOUT(changed.size(),1,4000);
  QTRY_VERIFY_WITH_TIMEOUT(eventSocket,4000);
  client.invoke("old","draw",{});
  QTRY_VERIFY_WITH_TIMEOUT(heldReply,4000);
  graph=R"({"nodes":[{"type":"view","id":"ui"}],"edges":[]})";
  eventSocket->write("event: invalidate\ndata: {}\n\n");eventSocket->flush();
  QTRY_COMPARE_WITH_TIMEOUT(changed.size(),2,4000);
  graph=R"({"nodes":[{"type":"action","id":"draw"},{"type":"view","id":"ui"}],"edges":[]})";
  eventSocket->write("event: invalidate\ndata: {}\n\n");eventSocket->flush();
  QTRY_COMPARE_WITH_TIMEOUT(changed.size(),3,4000);
  const QByteArray response=R"({"result":{"status":"completed"}})";
  heldReply->write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "+
    QByteArray::number(response.size())+"\r\nConnection: close\r\n\r\n"+response);
  heldReply->flush();heldReply->disconnectFromHost();
  QTRY_COMPARE_WITH_TIMEOUT(completed.size(),1,4000);
  QCOMPARE(completed.at(0).at(0).toString(),QString("old"));
  QCOMPARE(completed.at(0).at(2).toString(),QString("permission_revoked"));
  client.invoke("fresh","draw",{});
  QTRY_COMPARE_WITH_TIMEOUT(completed.size(),2,4000);
  QCOMPARE(completed.at(1).at(2).toString(),QString());
  qunsetenv("ADA_CORE_URL");qunsetenv("ADA_TOKEN");
 }
};
QTEST_GUILESS_MAIN(PermissionRace)
#include "graph_client_epoch_test.moc"
