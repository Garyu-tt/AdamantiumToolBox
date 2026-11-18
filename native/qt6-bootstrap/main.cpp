#include "window.hpp"
#include <QApplication>
#include <QCoreApplication>
#include <QTimer>
int main(int argc,char** argv) {
 QApplication app(argc,argv);
 NativeShell shell;
 shell.show();
 if(app.arguments().contains("--smoke"))
  QTimer::singleShot(120,&app,&QCoreApplication::quit);
 return app.exec();
}