#include "graph_events.hpp"
#include <QSignalSpy>
#include <QTcpServer>
#include <QTcpSocket>
#include <QTest>
class StreamTest final : public QObject {
 Q_OBJECT
private slots:
 void liveUpdates() {
  QTcpServer server;
  QVERIFY(server.listen(QHostAddress::LocalHost,0));
  QPointer<QTcpSocket> socket;
  connect(&server,&QTcpServer::newConnection,&server,[&] {
   socket=server.nextPendingConnection();
   connect(socket,&QTcpSocket::readyRead,&server,[&] {
    const auto request=socket->readAll();
    if(!request.contains("GET /api/events")||!request.contains("Bearer test_token_"))return;
    socket->write("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\n"
      "Cache-Control: no-store\r\nConnection: keep-alive\r\n\r\n"
      "event: ready\ndata: {}\n\n");socket->flush();
   });
  });
  GraphEvents client;
  QSignalSpy invalidated(&client,&GraphEvents::invalidated);
  QSignalSpy available(&client,&GraphEvents::streamAvailable);
  const QUrl url(QString("http://127.0.0.1:%1/").arg(server.serverPort()));
  client.start(url,"test_token_this_is_long_enough_for_testing");
  QTRY_COMPARE_WITH_TIMEOUT(invalidated.size(),1,3000);
  QVERIFY(socket);
  socket->write("id: 1\nevent: invalidate\ndata: {}\n\n");socket->flush();
  QTRY_COMPARE_WITH_TIMEOUT(invalidated.size(),2,3000);
  QVERIFY(available.size()>=1);
  QCOMPARE(available.at(0).at(0).toBool(),true);
  socket->disconnectFromHost();
  QTRY_VERIFY_WITH_TIMEOUT(available.size()>=2,3000);
  QCOMPARE(available.at(1).at(0).toBool(),false);
 }
};
QTEST_GUILESS_MAIN(StreamTest)
#include "graph_events_test.moc"
