#include "window.hpp"
#include <QApplication>
#include <QCoreApplication>
#include <QListWidgetItem>
#include <iostream>
int main(int argc,char** argv) {
 QApplication app(argc,argv);
 NativeShell shell;
 shell.show();
 shell.setCapabilities({"leonardo.generate","workspace.open","leonardo.generate"});
 auto* initial= shell.itemFor("leonardo.generate");
 if(!initial||shell.capabilities().size()!=2)return 1;
 shell.setCapabilities({"workspace.open","leonardo.generate"});
 if(shell.itemFor("leonardo.generate")!=initial)return 2;
 shell.setCapabilities({"workspace.open"});
 if(shell.itemFor("leonardo.generate")||shell.capabilities().size()!=1)return 3;
 shell.toggleFullscreen();
 QCoreApplication::processEvents();
 if(!shell.isFullScreen())return 4;
 shell.toggleFullscreen();
 QCoreApplication::processEvents();
 if(shell.isFullScreen())return 5;
 std::cout<<"QT6_BOOTSTRAP_OK incremental items, revocation, fullscreen\n";
 return 0;
}