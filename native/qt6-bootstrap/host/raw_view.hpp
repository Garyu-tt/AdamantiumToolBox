#pragma once
#include <QJsonObject>
#include <QWidget>
class QListWidget;
class QPlainTextEdit;
class QLabel;
class QPushButton;
class HostBridge;
// Generic native API UI. If all optional UI modules are absent, actions remain usable.
class RawView final:public QWidget {
 Q_OBJECT
public:
 explicit RawView(const QJsonObject& view,HostBridge* host,QWidget* parent=nullptr);
private slots:
 void updateGraph(const QJsonObject& graph);
 void complete(const QString& id,const QJsonObject& result,const QString& error);
 void invokeSelected();
 void online(bool available);
private:
 QString viewId_,pending_;
 HostBridge* host_=nullptr;
 QListWidget* actions_=nullptr;
 QPlainTextEdit *params_=nullptr,*output_=nullptr;
 QPushButton* run_=nullptr;
 QLabel* state_=nullptr;
 bool online_=false;
};
