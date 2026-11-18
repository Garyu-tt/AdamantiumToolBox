#include "graph_client.hpp"
#include "host_bridge.hpp"
#include "plugin_loader.hpp"
#include "raw_view.hpp"
#include "raw_workspace.hpp"
#include <QApplication>
#include <QCommandLineParser>
#include <QHBoxLayout>
#include <QJsonObject>
#include <QMainWindow>
#include <QMap>
#include <QPointer>
#include <QShortcut>
#include <QStatusBar>
#include <QTabWidget>
#include <QTimer>
#include <QWidget>
int main(int argc,char** argv) {
 QApplication app(argc,argv);
 QCommandLineParser args;
 args.addHelpOption();
 args.addOption({"plugins","Approved plugin directory","path"});
 args.addOption({"plugin-policy","Operator-supplied SHA-256 pin policy","file"});
 args.addOption({"smoke-test","Open native desktop and exit without a backend"});
 args.process(app);
 const auto root=args.value("plugins").isEmpty()?
  QCoreApplication::applicationDirPath()+"/plugins":args.value("plugins");
 const auto extensions=loadApprovedUiPlugins(&app,root,args.value("plugin-policy"));
 HostBridge bridge;
 GraphClient client;
 QMainWindow shell;
 shell.setWindowTitle("Mechanicus Native Desktop");
 auto* base=new QWidget(&shell);
 auto* layout=new QHBoxLayout(base);
 layout->setContentsMargins(0,0,0,0);
 QWidget* workspace=extensions.workspace?
  extensions.workspace->createWorkspace(base,&bridge):createRawWorkspace(base,&bridge);
 QWidget* surface=extensions.manager?
  extensions.manager->createWindowLayer(base):static_cast<QWidget*>(new QTabWidget(base));
 if(!workspace||!surface)return 2;
 layout->addWidget(workspace,1);layout->addWidget(surface,4);
 shell.setCentralWidget(base);
 shell.statusBar()->showMessage("MAS Core unavailable: actions disabled");
 QObject::connect(&client,&GraphClient::availabilityChanged,&shell,[&](bool online) {
  bridge.setAvailable(online);
  shell.statusBar()->showMessage(online?"MAS Core authorized":"MAS Core unavailable: actions disabled");
 });
 QObject::connect(&client,&GraphClient::graphChanged,&bridge,&HostBridge::publish);
 QObject::connect(&bridge,&HostBridge::invokeRequested,&client,&GraphClient::invoke);
 QObject::connect(&client,&GraphClient::invocationCompleted,&bridge,&HostBridge::complete);
 QMap<QString,QPointer<QWidget>> active;
 QObject::connect(&bridge,&HostBridge::openRequested,&shell,[&](const QString& id) {
  if(auto* existing=active.value(id).data()){existing->setFocus();return;}
  QJsonObject view;
  for(const auto& val:bridge.views()) {
   const auto node=val.toObject();
   if(node.value("id").toString()==id){view=node;break;}
  }
  if(view.isEmpty())return;
  auto* provider=extensions.views.value(id,nullptr);
  QWidget* content=provider?provider->createView(surface,&bridge):nullptr;
  if(!content)content=new RawView(view,&bridge,surface);
  active.insert(id,content);
  QObject::connect(content,&QObject::destroyed,&shell,[&,id]{active.remove(id);});
  const auto title=view.value("title").toString(id);
  if(extensions.manager)extensions.manager->openWindow(id,title,content);
  else static_cast<QTabWidget*>(surface)->addTab(content,title);
 });
 QObject::connect(&bridge,&HostBridge::viewsDelta,&shell,
  [&](const QJsonArray&,const QJsonArray& revoked) {
   for(const auto& item:revoked) {
    const auto id=item.toString();
    if(!active.contains(id))continue;
    if(extensions.manager)extensions.manager->closeWindow(id);
    else if(auto* tabs=qobject_cast<QTabWidget*>(surface)) {
     auto* widget=active.value(id).data();
     if(widget) {
      const auto index=tabs->indexOf(widget);
      if(index>=0)tabs->removeTab(index);
      widget->deleteLater();
     }
    }
   }
  });
 auto* full=new QShortcut(QKeySequence(Qt::Key_F11),&shell);
 QObject::connect(full,&QShortcut::activated,&shell,[&] {
  if(shell.isFullScreen())shell.showNormal();else shell.showFullScreen();
 });
 shell.resize(1100,720);shell.show();
 client.start();
 if(args.isSet("smoke-test"))QTimer::singleShot(150,&app,&QCoreApplication::quit);
 return app.exec();
}
