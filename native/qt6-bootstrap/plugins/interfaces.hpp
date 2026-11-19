#pragma once
#include <QtPlugin>
#include <QString>
class QObject;
class QWidget;
// Optional native UI providers: the Core and graph transport do not depend on them.
class INativeWorkspace {
public:
 virtual ~INativeWorkspace()=default;
 virtual QWidget* createWorkspace(QWidget* parent,QObject* host)=0;
};
class INativeWindowManager {
public:
 virtual ~INativeWindowManager()=default;
 virtual QWidget* createWindowLayer(QWidget* parent)=0;
 virtual void openWindow(const QString& id,const QString& title,QWidget* content)=0;
 virtual void closeWindow(const QString& id)=0;
 virtual void updateWindowTitle(const QString& id,const QString& title)=0;
};
class INativeView {
public:
 virtual ~INativeView()=default;
 virtual QString viewId() const=0;
 virtual QWidget* createView(QWidget* parent,QObject* host)=0;
};
Q_DECLARE_INTERFACE(INativeWorkspace,"org.mechanicus.native.workspace/1.0")
Q_DECLARE_INTERFACE(INativeWindowManager,"org.mechanicus.native.windows/1.1")
Q_DECLARE_INTERFACE(INativeView,"org.mechanicus.native.view/1.0")
