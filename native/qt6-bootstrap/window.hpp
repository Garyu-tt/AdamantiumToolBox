#pragma once
#include <QMainWindow>
#include <QStringList>
class QListWidget;
class QListWidgetItem;
class QLabel;
class NativeShell final : public QMainWindow {
public:
 explicit NativeShell(QWidget* parent=nullptr);
 void setCapabilities(const QStringList& ids);
 QStringList capabilities() const;
 QListWidgetItem* itemFor(const QString& id) const;
 void toggleFullscreen();
private:
 QListWidget* entries_=nullptr;
 QLabel* status_=nullptr;
};