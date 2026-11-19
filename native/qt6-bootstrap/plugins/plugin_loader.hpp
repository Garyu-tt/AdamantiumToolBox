#pragma once
#include "interfaces.hpp"
#include <QMap>
#include <QString>
class QObject;
struct NativeUiPlugins {
 INativeWorkspace* workspace=nullptr;
 INativeWindowManager* manager=nullptr;
 QMap<QString,INativeView*> views;
};
// Empty policy is intentional: no third-party code is loaded and Raw UI remains active.
NativeUiPlugins loadApprovedUiPlugins(QObject* lifetime,const QString& directory,
                                     const QString& policyFile);
