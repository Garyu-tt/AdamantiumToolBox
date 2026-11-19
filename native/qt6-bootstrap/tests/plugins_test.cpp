#include "interfaces.hpp"
#include <QApplication>
#include <QJsonArray>
#include <QJsonObject>
#include <QListWidget>
#include <QMdiArea>
#include <QMdiSubWindow>
#include <QPointer>
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
 // Two independent desktop panels must receive the same graph deltas.
 auto* mirrored=workspace->createWorkspace(&parent,&host);
 auto* secondList=mirrored->findChild<QListWidget*>();
 if(!secondList||secondList->count()!=1)return 11;
 const auto mirroredFirst=secondList->item(0);
 emit host.viewsDelta(QJsonArray{QJsonObject{{"id","first.view"},{"title","First"},{"type","view"}}},{});
 if(list->item(0)!=first)return 4;
 if(secondList->item(0)!=mirroredFirst)return 12;
 emit host.viewsDelta(QJsonArray{QJsonObject{{"id","second.view"},{"title","Second"},{"type","view"}}},{});
 if(list->count()!=2)return 5;
 if(secondList->count()!=2)return 13;
 emit host.viewsDelta({},QJsonArray{"first.view"});
 if(list->count()!=1||list->item(0)->data(Qt::UserRole).toString()!="second.view")return 6;
 if(secondList->count()!=1||secondList->item(0)->data(Qt::UserRole).toString()!="second.view")return 14;
 delete mirrored;
 emit host.viewsDelta(QJsonArray{QJsonObject{{"id","third.view"},{"title","Third"},{"type","view"}}},{});
 if(list->count()!=2||!list->findItems("Third",Qt::MatchExactly).size())return 15;
 emit host.viewsDelta({},QJsonArray{"third.view"});
 if(list->count()!=1)return 16;
 list->itemDoubleClicked(list->item(0));
 QCoreApplication::processEvents();
 if(host.opened!="second.view")return 7;
 auto* layer=manager->createWindowLayer(&parent);
 auto* area=qobject_cast<QMdiArea*>(layer);
 if(!area)return 8;
 manager->openWindow("test.view","Test",new QWidget());
 if(area->subWindowList().size()!=1)return 9;
 auto* namedWindow=area->subWindowList().front();
 manager->updateWindowTitle("test.view","Renamed while active");
 if(namedWindow->windowTitle()!="Renamed while active"||
    area->subWindowList().front()!=namedWindow)return 20;
 manager->updateWindowTitle("missing.view","Do not create");
 if(area->subWindowList().size()!=1)return 21;
 QPointer<QMdiSubWindow> firstWindow=area->subWindowList().front();
 manager->closeWindow("test.view");
 // Re-authorization occurs before the old QMdiSubWindow is destroyed.
 manager->openWindow("test.view","Restored",new QWidget());
 if(area->subWindowList().isEmpty())return 17;
 QPointer<QMdiSubWindow> restored=area->activeSubWindow();
 if(!restored||restored==firstWindow)return 18;
 QCoreApplication::sendPostedEvents(nullptr,QEvent::DeferredDelete);
 if(firstWindow||area->subWindowList().size()!=1||
    area->subWindowList().front()!=restored)return 19;
 // A late old-window destroyed callback must not remove the new registry entry.
 manager->closeWindow("test.view");
 QCoreApplication::sendPostedEvents(nullptr,QEvent::DeferredDelete);
 if(!area->subWindowList().isEmpty()||restored)return 10;
 delete desktop;delete area;
 std::cout<<"NATIVE_PLUGINS_OK two panels, revoked panel cleanup, window close\n";
 return 0;
}
#include "plugins_test.moc"
