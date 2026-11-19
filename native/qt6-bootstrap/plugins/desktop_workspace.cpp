#include "interfaces.hpp"
#include "workspace_rows.hpp"
#include <QJsonArray>
#include <QLabel>
#include <QListWidget>
#include <QMetaObject>
#include <QPointer>
#include <QVBoxLayout>
// A subscription belongs to its panel, not to the shared plugin instance.
class WorkspaceDeltaSink final:public QObject {
 Q_OBJECT
public:
 WorkspaceDeltaSink(QListWidget* list,QObject* parent):QObject(parent),list_(list){}
public slots:
 void apply(const QJsonArray& changed,const QJsonArray& revoked) {
  if(list_)patchWorkspaceRows(list_,changed,revoked);
 }
private:
 QPointer<QListWidget> list_;
};
class DesktopWorkspace final:public QObject,public INativeWorkspace {
 Q_OBJECT
 Q_PLUGIN_METADATA(IID "org.mechanicus.native.workspace/1.0")
 Q_INTERFACES(INativeWorkspace)
public:
 QWidget* createWorkspace(QWidget* parent,QObject* host) override {
  auto* panel=new QWidget(parent);
  auto* layout=new QVBoxLayout(panel);
  layout->addWidget(new QLabel("Desktop Workspace",panel));
  auto* list=new QListWidget(panel);layout->addWidget(list);
  if(host) {
   QJsonArray initial;
   if(QMetaObject::invokeMethod(host,"views",Qt::DirectConnection,Q_RETURN_ARG(QJsonArray,initial)))
    patchWorkspaceRows(list,initial,{});
   QPointer<QObject> guard(host);
   QObject::connect(list,&QListWidget::itemDoubleClicked,panel,
    [guard](QListWidgetItem* item){
     if(guard)QMetaObject::invokeMethod(guard.data(),"openView",Qt::QueuedConnection,
      Q_ARG(QString,item->data(Qt::UserRole).toString()));
    });
   auto* sink=new WorkspaceDeltaSink(list,panel);
   QObject::connect(host,SIGNAL(viewsDelta(QJsonArray,QJsonArray)),sink,
    SLOT(apply(QJsonArray,QJsonArray)));
  }
  return panel;
 }
};
#include "desktop_workspace.moc"
