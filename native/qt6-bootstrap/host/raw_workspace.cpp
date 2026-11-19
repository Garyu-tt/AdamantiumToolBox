#include "raw_workspace.hpp"
#include "host_bridge.hpp"
#include "workspace_rows.hpp"
#include <QLabel>
#include <QListWidget>
#include <QVBoxLayout>
QWidget* createRawWorkspace(QWidget* parent,HostBridge* bridge) {
 auto* surface=new QWidget(parent);
 auto* layout=new QVBoxLayout(surface);
 layout->addWidget(new QLabel("Raw Workspace",surface));
 auto* list=new QListWidget(surface);layout->addWidget(list);
 QObject::connect(bridge,&HostBridge::viewsDelta,surface,
  [list](const QJsonArray& changes,const QJsonArray& revoked) {
   patchWorkspaceRows(list,changes,revoked);
  });
 patchWorkspaceRows(list,bridge->views(),{});
 QObject::connect(list,&QListWidget::itemDoubleClicked,surface,[bridge](QListWidgetItem* item) {
  bridge->openView(item->data(Qt::UserRole).toString());
 });
 return surface;
}
