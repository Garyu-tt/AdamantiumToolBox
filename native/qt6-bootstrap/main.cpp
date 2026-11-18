#include "window.hpp"
#include "graph_client.hpp"
#include <QApplication>
#include <QCoreApplication>
#include <QJsonArray>
#include <QJsonObject>
#include <QObject>
#include <QStringList>
#include <QTimer>
int main(int argc,char** argv) {
 QApplication app(argc,argv);
 NativeShell shell;
 shell.show();
 GraphClient graph;
 QObject::connect(&graph,&GraphClient::availabilityChanged,&shell,
  [&shell](bool online){if(!online)shell.setCapabilities({});});
 QObject::connect(&graph,&GraphClient::graphChanged,&shell,
  [&shell](const QJsonObject& snapshot) {
   QStringList apps;
   for(const auto& item:snapshot.value("nodes").toArray()) {
    const auto node=item.toObject();
    if(node.value("type").toString()=="view")apps.append(node.value("id").toString());
   }
   shell.setCapabilities(apps);
  });
 graph.start();
 if(app.arguments().contains("--smoke"))
  QTimer::singleShot(120,&app,&QCoreApplication::quit);
 return app.exec();
}