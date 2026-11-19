#include "plugin_loader.hpp"
#include <QCryptographicHash>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLibrary>
#include <QPluginLoader>
#include <QRegularExpression>
#include <QSet>
#include <QDebug>
namespace {
bool validName(const QString& name) {
 static const QRegularExpression pattern("^[A-Za-z0-9][A-Za-z0-9_.-]{2,179}$");
 return pattern.match(name).hasMatch()&&!name.contains("..")&&QLibrary::isLibrary(name);
}
bool validHash(const QString& hash) {
 static const QRegularExpression pattern("^[a-f0-9]{64}$");
 return pattern.match(hash).hasMatch();
}
QMap<QString,QString> approvedPins(const QString& policyFile) {
 const QFileInfo info(policyFile);
 if(policyFile.isEmpty()||info.isSymLink()||!info.isFile()||info.size()>65536)
  return {};
 QFile file(policyFile);if(!file.open(QIODevice::ReadOnly))return {};
 QJsonParseError parse;
 const auto document=QJsonDocument::fromJson(file.readAll(),&parse);
 if(parse.error!=QJsonParseError::NoError||!document.isObject())return {};
 const auto obj=document.object();
 if(obj.value("schema").toString()!="mas-native-plugin-pins-1"||
  !obj.value("plugins").isArray()||obj.value("plugins").toArray().size()>128)return {};
 QMap<QString,QString> pins;
 for(const auto& value:obj.value("plugins").toArray()) {
  if(!value.isObject())return {};
  const auto entry=value.toObject();
  const auto name=entry.value("file").toString(),hash=entry.value("sha256").toString();
  if(!validName(name)||!validHash(hash)||pins.contains(name))return {};
  pins.insert(name,hash);
 }
 return pins;
}
bool sameFileHash(const QString& path,const QString& expected) {
 const QFileInfo info(path);
 if(!info.isFile()||info.isSymLink()||info.size()>52428800)return false;
 QFile file(path);if(!file.open(QIODevice::ReadOnly))return false;
 QCryptographicHash sha(QCryptographicHash::Sha256);
 if(!sha.addData(&file))return false;
 return QString::fromLatin1(sha.result().toHex())==expected;
}
}
NativeUiPlugins loadApprovedUiPlugins(QObject* lifetime,const QString& directory,
                                      const QString& policyFile) {
 NativeUiPlugins result;
 if(policyFile.isEmpty()||!lifetime)return result;
 const auto pins=approvedPins(policyFile);
 if(pins.isEmpty())return result;
 const QFileInfo root(directory);
 if(!root.isDir()||root.isSymLink())return result;
 const QDir folder(directory);const auto canonical=folder.canonicalPath();
 for(auto it=pins.cbegin();it!=pins.cend();++it) {
  const auto path=folder.absoluteFilePath(it.key());
  if(QFileInfo(path).canonicalPath()!=canonical||!sameFileHash(path,it.value()))continue;
  auto* loader=new QPluginLoader(path,lifetime);
  auto* object=loader->instance();
  if(!object){delete loader;continue;}
  if(auto* workspace=qobject_cast<INativeWorkspace*>(object))
   if(!result.workspace)result.workspace=workspace;
  if(auto* manager=qobject_cast<INativeWindowManager*>(object))
   if(!result.manager)result.manager=manager;
  if(auto* view=qobject_cast<INativeView*>(object))
   if(!result.views.contains(view->viewId()))result.views.insert(view->viewId(),view);
 }
 return result;
}
