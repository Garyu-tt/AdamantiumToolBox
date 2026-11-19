#include "raw_view.hpp"
#include "host_bridge.hpp"
#include "action_discovery.hpp"
#include <QHash>
#include <QSignalBlocker>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonParseError>
#include <QLabel>
#include <QListWidget>
#include <QPlainTextEdit>
#include <QPushButton>
#include <QSet>
#include <QUuid>
#include <QVBoxLayout>
RawView::RawView(const QJsonObject& view,HostBridge* host,QWidget* parent):
 QWidget(parent),viewId_(view.value("id").toString()),host_(host) {
 auto* layout=new QVBoxLayout(this);
 layout->addWidget(new QLabel(view.value("title").toString(viewId_),this));
 layout->addWidget(new QLabel("Raw API — authorized actions of this view",this));
 actions_=new QListWidget(this);layout->addWidget(actions_);
 params_=new QPlainTextEdit(this);params_->setPlainText("{}");
 params_->setPlaceholderText("JSON object with action parameters");
 params_->setMaximumHeight(100);layout->addWidget(params_);
 run_=new QPushButton("Invoke",this);layout->addWidget(run_);
 state_=new QLabel(this);layout->addWidget(state_);
 output_=new QPlainTextEdit(this);output_->setReadOnly(true);layout->addWidget(output_);
 connect(run_,&QPushButton::clicked,this,&RawView::invokeSelected);
 connect(host_,&HostBridge::graphChanged,this,&RawView::updateGraph);
 connect(host_,&HostBridge::availabilityChanged,this,&RawView::online);
 connect(host_,&HostBridge::invocationCompleted,this,&RawView::complete);
 updateGraph(host_->graph());online(host_->available());
}
void RawView::updateGraph(const QJsonObject& graph) {
 const auto nodes=graph.value("nodes").toArray();
 const QSet<QString> allowed=discoverViewActions(graph,viewId_);
 const auto selected=actions_->currentItem()?
  actions_->currentItem()->data(Qt::UserRole).toString():QString{};
 QSignalBlocker silent(actions_);
 QHash<QString,QListWidgetItem*> old;
 QSet<QString> activeActions;
 for(int i=0;i<actions_->count();++i)
  old.insert(actions_->item(i)->data(Qt::UserRole).toString(),actions_->item(i));
 for(const auto& value:nodes) {
  const auto n=value.toObject();
  const auto id=n.value("id").toString();
  if(n.value("type").toString()!="action"||!allowed.contains(id))continue;
  activeActions.insert(id);
  auto* row=old.take(id);
  if(!row){row=new QListWidgetItem(actions_);row->setData(Qt::UserRole,id);}
  const auto title=n.value("title").toString(id);
  if(row->text()!=title)row->setText(title);
 }
 for(const auto* row:old)delete actions_->takeItem(actions_->row(row));
 if(!lastResultAction_.isEmpty()&&!activeActions.contains(lastResultAction_)){
  output_->clear();lastResultAction_.clear();
 }
 for(int i=0;i<actions_->count();++i) {
  if(actions_->item(i)->data(Qt::UserRole).toString()==selected)actions_->setCurrentRow(i);
 }
 if(actions_->count()&&!actions_->currentItem())actions_->setCurrentRow(0);
 run_->setEnabled(online_&&pending_.isEmpty()&&actions_->currentItem()!=nullptr);
 state_->setText(actions_->count()?QString{}:"No authorized actions available");
}
void RawView::invokeSelected() {
 if(!online_||!pending_.isEmpty()||!actions_->currentItem())return;
 QJsonParseError parse;
 const auto doc=QJsonDocument::fromJson(params_->toPlainText().toUtf8(),&parse);
 if(parse.error!=QJsonParseError::NoError||!doc.isObject()) {
  state_->setText("Parameters must be a JSON object");return;
 }
 pending_=QUuid::createUuid().toString(QUuid::WithoutBraces);
 run_->setEnabled(false);state_->setText("Running...");
 inflightAction_=actions_->currentItem()->data(Qt::UserRole).toString();
 host_->invoke(pending_,inflightAction_,doc.object());
}
void RawView::complete(const QString& id,const QJsonObject& result,const QString& error) {
 if(id!=pending_)return;
 pending_.clear();run_->setEnabled(online_&&actions_->currentItem()!=nullptr);
 state_->setText(error.isEmpty()?"Completed":error);
 if(error.isEmpty()){
  lastResultAction_=inflightAction_;
  output_->setPlainText(QString::fromUtf8(QJsonDocument(result).toJson(QJsonDocument::Indented)));
 }else{output_->clear();lastResultAction_.clear();}
 inflightAction_.clear();
}
void RawView::online(bool yes) {
 online_=yes;run_->setEnabled(online_&&pending_.isEmpty()&&actions_->currentItem()!=nullptr);
 if(!online_){state_->setText("Core unavailable — execution disabled");
  output_->clear();lastResultAction_.clear();
 }
}
