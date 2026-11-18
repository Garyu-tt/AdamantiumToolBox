#include "plugin_loader.hpp"
#include <QApplication>
#include <QCryptographicHash>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QTemporaryDir>
#include <iostream>
static QString digest(const QString& path) {
 QFile file(path);if(!file.open(QIODevice::ReadOnly))return {};
 QCryptographicHash hash(QCryptographicHash::Sha256);
 if(!hash.addData(&file))return {};
 return QString::fromLatin1(hash.result().toHex());
}
static QString policy(const QTemporaryDir& dir,const QStringList& paths,bool wrong=false) {
 QJsonArray list;
 for(const auto& path:paths) {
  QString hash=digest(path);
  if(wrong)hash=QString(64,'0');
  list.append(QJsonObject{{"file",QFileInfo(path).fileName()},{"sha256",hash}});
 }
 const auto path=dir.path()+"/pins.json";
 QFile file(path);if(!file.open(QIODevice::WriteOnly))return {};
 file.write(QJsonDocument(QJsonObject{{"schema","mas-native-plugin-pins-1"},
  {"plugins",list}}).toJson(QJsonDocument::Compact));file.close();
 return path;
}
int main(int argc,char** argv) {
 QApplication app(argc,argv);
 if(argc!=3)return 1;
 const QStringList files={argv[1],argv[2]};
 const auto folder=QFileInfo(files.front()).absolutePath();
 QTemporaryDir dir;if(!dir.isValid())return 2;
 const auto absent=loadApprovedUiPlugins(&app,folder,{});
 if(absent.manager||absent.workspace)return 3;
 auto incorrect=policy(dir,files,true);
 const auto rejected=loadApprovedUiPlugins(&app,folder,incorrect);
 if(rejected.manager||rejected.workspace)return 4;
 auto correct=policy(dir,files);
 const auto approved=loadApprovedUiPlugins(&app,folder,correct);
 if(!approved.manager||!approved.workspace)return 5;
 std::cout<<"NATIVE_LOADER_OK unpinned denied, wrong SHA denied, approved plugins loaded\n";
}
