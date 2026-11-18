#include "interfaces.hpp"
#include "workspace_rows.hpp"
#include <QJsonArray>
#include <QLabel>
#include <QListWidget>
#include <QMetaObject>
#include <QPointer>
#include <QVBoxLayout>
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
  QPointer<QListWidget> guard(list);
  if(host) {
   QJsonArray initial;
   if(QMetaObject::invokeMethod(host,"views",Qt::DirectConnection,Q_RETURN_ARG(QJsonArray,initial)))
    patchWorkspaceRows(list,initial,{});
   QObject::connect(list,&QListWidget::itemDoubleClicked,panel,
    [host](QListWidgetItem* item){
     QMetaObject::invokeMethod(host,"openView",Qt::QueuedConnection,
      Q_ARG(QString,item->data(Qt::UserRole).toString()));
    });
   // Signature-independent delta adapter, disconnected when panel is destroyed.
   QObject::connect(host,SIGNAL(viewsDelta(QJsonArray,QJsonArray)),this,
    SLOT(onDelta(QJsonArray,QJsonArray)));
  }
  list_=guard;
  QObject::connect(panel,&QObject::destroyed,this,[this]{list_.clear();});
  return panel;
 }
private slots:
 void onDelta(const QJsonArray& updated,const QJsonArray& removed) {
  if(list_)patchWorkspaceRows(list_,updated,removed);
 }
private:
 QPointer<QListWidget> list_;
};
#include "desktop_workspace.moc"
