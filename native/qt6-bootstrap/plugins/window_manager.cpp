#include "interfaces.hpp"
#include <QMdiArea>
#include <QMdiSubWindow>
#include <QMap>
#include <cstdint>
#include <QPointer>
class WindowManager final:public QObject,public INativeWindowManager {
 Q_OBJECT
 Q_PLUGIN_METADATA(IID "org.mechanicus.native.windows/1.1")
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
  if(!area_||id.isEmpty()||!content)return;
  auto existing=windows_.find(id);
  if(existing!=windows_.end()){
   if(existing.value().sub)return;
   windows_.erase(existing);
  }
  auto* sub=area_->addSubWindow(content);
  sub->setAttribute(Qt::WA_DeleteOnClose);
  sub->setWindowTitle(title);
  const auto generation=++nextGeneration_;
  windows_.insert(id,Entry{sub,generation});
  QObject::connect(sub,&QObject::destroyed,this,[this,id,generation]{
   auto current=windows_.find(id);
   if(current!=windows_.end()&&current.value().generation==generation)
    windows_.erase(current);
  });
  sub->resize(560,420);sub->show();area_->setActiveSubWindow(sub);
 }
 void updateWindowTitle(const QString& id,const QString& title) override {
  if(auto* sub=windows_.value(id).data()){
   if(sub->windowTitle()!=title)sub->setWindowTitle(title);
  }
 }
 void closeWindow(const QString& id) override {
  auto current=windows_.find(id);
  if(current==windows_.end())return;
  const QPointer<QMdiSubWindow> closing=current.value().sub;
  // Evict before deferred deletion: a re-authorized view may open immediately.
  windows_.erase(current);
  if(closing){
   closing->close();
   if(closing){closing->hide();closing->deleteLater();}
  }
 }
private:
 QPointer<QMdiArea> area_;
 struct Entry {QPointer<QMdiSubWindow> sub;std::uint64_t generation;};
 QMap<QString,Entry> windows_;
 std::uint64_t nextGeneration_=0;
};
#include "window_manager.moc"
