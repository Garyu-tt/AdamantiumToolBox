#include "interfaces.hpp"
#include <QApplication>
#include <QJsonArray>
#include <QJsonObject>
#include <QListWidget>
#include <QMdiArea>
#include <QMetaObject>
#include <QPluginLoader>
#include <QTest>
#include <QWidget>
#include <iostream>
#include <QEvent>
#include <QCoreApplication>
class MockHost final:public QObject {
 Q_OBJECT
public:
 QJsonArray current{{QJsonObject{{"id","first.view"},{"title","First"},{"type","view"}}}};
 QString opened;
 Q_INVOKABLE QJsonArray views() const{return current;}
 Q_INVOKABLE void openView(const QString& id){opened=id;}
signals:
 void viewsDelta(const QJsonArray& upserts,const QJsonArray& revoked);
};
int main(int argc,char** argv) {
 QApplication app(argc,argv);
 if(argc!=4)return 1;
 QPluginLoader ws(argv[1]),wm(argv[2]),lv(argv[3]);
 auto* workspace=qobject_cast<INativeWorkspace*>(ws.instance());
 auto* manager=qobject_cast<INativeWindowManager*>(wm.instance());
 auto* leonardo=qobject_cast<INativeView*>(lv.instance());
 if(!workspace||!manager||!leonardo||leonardo->viewId()!="leonardo.view")return 2;
 MockHost host;
 QWidget parent;
 auto* desktop=workspace->createWorkspace(&parent,&host);
 auto* list=desktop->findChild<QListWidget*>();
 if(!list||list->count()!=1||list->item(0)->text()!="First")return 3;
 const auto first=list->item(0);
 emit host.viewsDelta(QJsonArray{QJsonObject{{"id","first.view"},{"title","First"},{"type","view"}}},{});
 if(list->item(0)!=first)return 4;
 emit host.viewsDelta(QJsonArray{QJsonObject{{"id","second.view"},{"title","Second"},{"type","view"}}},{});
 if(list->count()!=2)return 5;
 emit host.viewsDelta({},QJsonArray{"first.view"});
 if(list->count()!=1||list->item(0)->data(Qt::UserRole).toString()!="second.view")return 6;
 list->itemDoubleClicked(list->item(0));
 QCoreApplication::processEvents();
 if(host.opened!="second.view")return 7;
 auto* layer=manager->createWindowLayer(&parent);
 auto* area=qobject_cast<QMdiArea*>(layer);
 if(!area)return 8;
 manager->openWindow("test.view","Test",new QWidget());
 if(area->subWindowList().size()!=1)return 9;
 manager->closeWindow("test.view");
 QCoreApplication::sendPostedEvents(nullptr,QEvent::DeferredDelete);
 if(!area->subWindowList().isEmpty())return 10;
 delete desktop;delete area;
 std::cout<<"NATIVE_PLUGINS_OK workspace delta, open and window close\n";
 return 0;
}
#include "plugins_test.moc"
