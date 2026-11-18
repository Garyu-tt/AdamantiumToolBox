#include "window.hpp"
#include <QLabel>
#include <QListWidget>
#include <QListWidgetItem>
#include <QSet>
#include <QShortcut>
#include <QSplitter>
#include <QVBoxLayout>
#include <QWidget>
#include <algorithm>

NativeShell::NativeShell(QWidget* parent):QMainWindow(parent) {
 setWindowTitle("Mechanicus Native — Qt6 bootstrap");
 auto* central=new QWidget(this);
 auto* layout=new QVBoxLayout(central);
 auto* splitter=new QSplitter(Qt::Horizontal,central);
 entries_=new QListWidget(splitter);
 auto* info=new QLabel("Raw UI: capabilities appear through the authorized graph.",splitter);
 info->setWordWrap(true);
 splitter->addWidget(entries_);
 splitter->addWidget(info);
 layout->addWidget(splitter);
 status_=new QLabel("MAS Core not connected: invoking is disabled.",central);
 layout->addWidget(status_);
 setCentralWidget(central);
 auto* fullscreen=new QShortcut(QKeySequence(Qt::Key_F11),this);
 connect(fullscreen,&QShortcut::activated,this,&NativeShell::toggleFullscreen);
 connect(entries_,&QListWidget::currentTextChanged,info,
  [info](const QString& id) {
   info->setText(id.isEmpty()?"Raw UI: no selection.":"Selected capability: "+id);
  });
 resize(960,600);
}
QListWidgetItem* NativeShell::itemFor(const QString& id) const {
 const auto items=entries_->findItems(id,Qt::MatchExactly);
 return items.isEmpty()?nullptr:items.front();
}
void NativeShell::setCapabilities(const QStringList& ids) {
 QSet<QString> desired;
 for(const auto& id:ids)if(!id.isEmpty())desired.insert(id);
 for(int i=entries_->count()-1;i>=0;--i) {
  if(!desired.contains(entries_->item(i)->text()))delete entries_->takeItem(i);
 }
 for(const auto& id:desired)if(!itemFor(id))entries_->addItem(id);
 status_->setText(QString::number(entries_->count())+" authorized capabilities. No auto-invoke.");
}
QStringList NativeShell::capabilities() const {
 QStringList result;
 for(int i=0;i<entries_->count();++i)result.append(entries_->item(i)->text());
 result.sort();
 return result;
}
void NativeShell::toggleFullscreen() {
 if(isFullScreen())showNormal();
 else showFullScreen();
}