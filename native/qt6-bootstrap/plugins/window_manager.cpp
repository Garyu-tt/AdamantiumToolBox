#include "interfaces.hpp"
#include <QMdiArea>
#include <QMdiSubWindow>
#include <QMap>
#include <QPointer>
class WindowManager final:public QObject,public INativeWindowManager {
 Q_OBJECT
 Q_PLUGIN_METADATA(IID "org.mechanicus.native.windows/1.0")
 Q_INTERFACES(INativeWindowManager)
public:
 QWidget* createWindowLayer(QWidget* parent) override {
  area_=new QMdiArea(parent);
  area_->setOption(QMdiArea::DontMaximizeSubWindowOnActivation,true);
  area_->setBackground(parent->palette().brush(QPalette::Base));
  QObject::connect(area_,&QObject::destroyed,this,[this]{area_=nullptr;windows_.clear();});
  return area_;
 }
 void openWindow(const QString& id,const QString& title,QWidget* content) override {
  if(!area_||id.isEmpty()||!content||windows_.contains(id))return;
  auto* sub=area_->addSubWindow(content);
  sub->setAttribute(Qt::WA_DeleteOnClose);
  sub->setWindowTitle(title);
  windows_.insert(id,sub);
  QObject::connect(sub,&QObject::destroyed,this,[this,id]{windows_.remove(id);});
  sub->resize(560,420);sub->show();area_->setActiveSubWindow(sub);
 }
 void closeWindow(const QString& id) override {
  if(auto* sub=windows_.value(id).data())sub->close();
 }
private:
 QPointer<QMdiArea> area_;
 QMap<QString,QPointer<QMdiSubWindow>> windows_;
};
#include "window_manager.moc"
