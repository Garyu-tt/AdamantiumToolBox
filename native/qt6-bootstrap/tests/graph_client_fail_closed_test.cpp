#include "graph_client.hpp"
#include <QJsonArray>
#include <QJsonObject>
#include <QPointer>
#include <QSignalSpy>
#include <QTcpServer>
#include <QTcpSocket>
#include <QTest>
class GraphFailClosed final:public QObject {
 Q_OBJECT
private slots:
 void malformedGraphAndHttpFailureRevokeViews() {
  const QByteArray token="test_local_bearer_long_enough_123456789";
  QTcpServer server;QVERIFY(server.listen(QHostAddress::LocalHost,0));
  QPointer<QTcpSocket> events;
  int mode=0;
  QObject::connect(&server,&QTcpServer::newConnection,&server,[&]{
   auto* socket=server.nextPendingConnection();
   QObject::connect(socket,&QTcpSocket::readyRead,&server,[&,socket]{
    const auto req=socket->readAll();
    if(!req.contains("Authorization: Bearer "+token))return;
    if(req.startsWith("GET /api/events")){
     events=socket;socket->write("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\n"
      "Connection: keep-alive\r\n\r\nevent: ready\ndata: {}\n\n");socket->flush();return;
    }
    if(req.startsWith("GET /api/graph")){
     const QByteArray valid=R"({"nodes":[{"type":"view","id":"v"},{"type":"action","id":"a"}],"edges":[]})";
     const QByteArray malformed=R"({"nodes":)";
     const QByteArray unavailable=R"({"error":"unavailable"})";
     const auto body=mode==1?malformed:mode==2?unavailable:valid;
     const auto status=mode==2?"503 Service Unavailable":"200 OK";
     socket->write("HTTP/1.1 "+QByteArray(status)+"\r\nContent-Type: application/json\r\n"
      "Content-Length: "+QByteArray::number(body.size())+"\r\nConnection: close\r\n\r\n"+body);
     socket->flush();socket->disconnectFromHost();
    }
   });
  });
  qputenv("ADA_CORE_URL",QString("http://127.0.0.1:%1").arg(server.serverPort()).toUtf8());
  qputenv("ADA_TOKEN",token);
  {
   GraphClient client;
   QSignalSpy graphs(&client,&GraphClient::graphChanged);
   QSignalSpy available(&client,&GraphClient::availabilityChanged);
   QSignalSpy invoked(&client,&GraphClient::invocationCompleted);
   client.start();
   QTRY_COMPARE_WITH_TIMEOUT(graphs.size(),1,4000);
   QTRY_VERIFY_WITH_TIMEOUT(events,4000);
   QCOMPARE(graphs.last().at(0).value<QJsonObject>().value("nodes").toArray().size(),2);
   for(int failure:{1,2}){
    mode=failure;
    events->write("event: invalidate\ndata: {}\n\n");events->flush();
    QTRY_VERIFY_WITH_TIMEOUT(graphs.size()>=failure*2,4000);
    QVERIFY(graphs.last().at(0).value<QJsonObject>().isEmpty());
    QVERIFY(!available.last().at(0).toBool());
    client.invoke("reject"+QString::number(failure),"a",{});
    QCOMPARE(invoked.last().at(2).toString(),QString("action_unavailable_or_denied"));
    mode=0;
    events->write("event: invalidate\ndata: {}\n\n");events->flush();
    QTRY_VERIFY_WITH_TIMEOUT(graphs.size()>=failure*2+1,4000);
    QCOMPARE(graphs.last().at(0).value<QJsonObject>().value("nodes").toArray().size(),2);
    QVERIFY(available.last().at(0).toBool());
   }
  }
  qunsetenv("ADA_CORE_URL");qunsetenv("ADA_TOKEN");
 }
};
QTEST_GUILESS_MAIN(GraphFailClosed)
#include "graph_client_fail_closed_test.moc"
