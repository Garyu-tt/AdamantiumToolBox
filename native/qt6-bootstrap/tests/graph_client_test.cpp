#include "graph_client.hpp"
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSignalSpy>
#include <QTcpServer>
#include <QTcpSocket>
#include <QTest>
class GraphTest final:public QObject {
 Q_OBJECT
private slots:
 void authorizedHotPlugAndRevocation() {
  const QByteArray token="local_graph_test_token_more_than_24_chars";
  QTcpServer server;QVERIFY(server.listen(QHostAddress::LocalHost,0));
  QPointer<QTcpSocket> stream;bool denied=false;
  QByteArray graph=R"({"version":1,"nodes":[{"id":"alpha.view","type":"view"}],"edges":[]})";
  QObject::connect(&server,&QTcpServer::newConnection,&server,[&] {
   auto* socket=server.nextPendingConnection();
   QObject::connect(socket,&QTcpSocket::readyRead,&server,[&,socket] {
    const QByteArray request=socket->readAll();
    if(!request.contains("Authorization: Bearer "+token))return;
    if(request.startsWith("GET /api/events")) {
     stream=socket;
     socket->write("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\n"
      "Connection: keep-alive\r\nCache-Control: no-store\r\n\r\n"
      "event: ready\ndata: {}\n\n");socket->flush();return;
    }
    if(request.startsWith("GET /api/graph")) {
     const QByteArray body=denied?QByteArray(R"({"error":"unauthorized"})"):graph;
     socket->write(QByteArray("HTTP/1.1 ")+(denied?"401 Unauthorized":"200 OK")+
      "\r\nContent-Type: application/json\r\nContent-Length: "+
      QByteArray::number(body.size())+"\r\nConnection: close\r\n\r\n"+body);
     socket->flush();socket->disconnectFromHost();
    }
   });
  });
  qputenv("ADA_CORE_URL",QString("http://127.0.0.1:%1/").arg(server.serverPort()).toUtf8());
  qputenv("ADA_TOKEN",token);
  GraphClient client;
  QSignalSpy changed(&client,&GraphClient::graphChanged);
  QSignalSpy availability(&client,&GraphClient::availabilityChanged);
  client.start();
  QTRY_COMPARE_WITH_TIMEOUT(changed.size(),1,4500);
  QTRY_VERIFY_WITH_TIMEOUT(stream,4500);
  QCOMPARE(changed.at(0).at(0).value<QJsonObject>().value("nodes").toArray().size(),1);
  graph=R"({"version":1,"nodes":[{"id":"alpha.view","type":"view"},{"id":"beta.view","type":"view"}],"edges":[]})";
  stream->write("event: invalidate\ndata: {}\n\n");stream->flush();
  QTRY_COMPARE_WITH_TIMEOUT(changed.size(),2,4500);
  QCOMPARE(changed.at(1).at(0).value<QJsonObject>().value("nodes").toArray().size(),2);
  denied=true;
  stream->write("event: invalidate\ndata: {}\n\n");stream->flush();
  QTRY_VERIFY_WITH_TIMEOUT(availability.size()>=2,4500);
  QCOMPARE(availability.last().at(0).toBool(),false);
  QTRY_VERIFY_WITH_TIMEOUT(changed.size()>=3,4500);
  QVERIFY(changed.last().at(0).value<QJsonObject>().isEmpty());
  qunsetenv("ADA_CORE_URL");qunsetenv("ADA_TOKEN");
 }
};
QTEST_GUILESS_MAIN(GraphTest)
#include "graph_client_test.moc"
