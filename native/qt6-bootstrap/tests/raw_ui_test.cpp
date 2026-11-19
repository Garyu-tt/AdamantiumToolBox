#include "host_bridge.hpp"
#include "raw_view.hpp"
#include "raw_workspace.hpp"
#include <QApplication>
#include <QListWidget>
#include <QPlainTextEdit>
#include <QPushButton>
#include <QSignalSpy>
#include <QJsonArray>
#include <QJsonObject>
#include <iostream>
static QJsonObject view(QString id,QString name) {
 return {{"id",id},{"type","view"},{"title",name}};
}
int main(int argc,char** argv) {
 QApplication app(argc,argv);
 HostBridge bridge;
 QWidget parent;
 auto* space=createRawWorkspace(&parent,&bridge);
 auto* launcher=space->findChild<QListWidget*>();
 QJsonArray nodes;
 for(int i=0;i<160;++i)nodes.append(view("item."+QString::number(i),"Title "+QString::number(i)));
 const QJsonObject action{{"id","item.0.run"},{"type","action"},{"title","Run"}};
 nodes.append(action);
 QJsonArray edges{QJsonObject{{"from","item.0"},{"to","item.0.run"},{"type","uses"}}};
 QSignalSpy changed(&bridge,&HostBridge::viewsDelta);
 bridge.publish(QJsonObject{{"nodes",nodes},{"edges",edges}});
 if(launcher->count()!=160||changed.count()!=1)return 1;
 auto* stable=launcher->item(75);
 nodes.replace(0,view("item.0","Renamed"));
 bridge.publish(QJsonObject{{"nodes",nodes},{"edges",edges}});
 if(launcher->item(launcher->row(stable))!=stable||changed.last()[0].toJsonArray().size()!=1)return 2;
 RawView raw(nodes[0].toObject(),&bridge,&parent);
 auto* actions=raw.findChild<QListWidget*>();
 auto* button=raw.findChild<QPushButton*>();
 auto* params=raw.findChild<QPlainTextEdit*>();
 if(!actions||actions->count()!=1||!button||!params)return 3;
 // Composite providers use view -> resource (uses) -> action (provides).
 nodes.append(QJsonObject{{"id","item.0.provider"},{"type","resource"}});
 nodes.append(QJsonObject{{"id","item.0.render"},{"type","action"},{"title","Render"}});
 nodes.append(QJsonObject{{"id","item.1.hidden"},{"type","action"},{"title","Unrelated"}});
 edges.append(QJsonObject{{"from","item.0"},{"to","item.0.provider"},{"type","uses"}});
 edges.append(QJsonObject{{"from","item.0.provider"},{"to","item.0.render"},{"type","provides"}});
 edges.append(QJsonObject{{"from","item.0"},{"to","item.1.hidden"},{"type","related"}});
 bridge.publish(QJsonObject{{"nodes",nodes},{"edges",edges}});
 if(actions->count()!=2||actions->findItems("Render",Qt::MatchExactly).size()!=1||
    !actions->findItems("Unrelated",Qt::MatchExactly).isEmpty())return 12;
 // A revoked resource edge must immediately remove the indirect action.
 edges.removeAt(1);
 bridge.publish(QJsonObject{{"nodes",nodes},{"edges",edges}});
 if(actions->count()!=1||!actions->findItems("Render",Qt::MatchExactly).isEmpty())return 13;
 edges.append(QJsonObject{{"from","item.0"},{"to","item.0.provider"},{"type","uses"}});
 edges.append(QJsonObject{{"from","item.0.provider"},{"to","item.0.render"},{"type","provides"}});
 bridge.publish(QJsonObject{{"nodes",nodes},{"edges",edges}});
 if(actions->count()!=2)return 14;
 QSignalSpy calls(&bridge,&HostBridge::invokeRequested);
 bridge.setAvailable(true);
 params->setPlainText("{\"i\":9}");
 button->click();
 if(calls.size()!=1||calls.at(0).at(1).toString()!="item.0.run")return 4;
 bridge.complete(calls.at(0).at(0).toString(),QJsonObject{{"result",true}},{});
 const auto edits=raw.findChildren<QPlainTextEdit*>();
 if(edits.size()!=2||!edits.at(1)->toPlainText().contains("true"))return 7;
 bridge.publish(QJsonObject{{"nodes",nodes},{"edges",QJsonArray{}}});
 if(actions->count()!=0||button->isEnabled())return 5;
 if(!edits.at(1)->toPlainText().isEmpty())return 8;
 bridge.publish(QJsonObject{{"nodes",QJsonArray{}},{"edges",QJsonArray{}}});
 if(launcher->count()!=0)return 6;
 bridge.publish(QJsonObject{{"nodes",nodes},{"edges",edges}});
 bridge.setAvailable(true);
 button->click();
 if(calls.size()!=2)return 9;
 bridge.complete(calls.at(1).at(0).toString(),QJsonObject{{"result","sensitive"}},{});
 if(!edits.at(1)->toPlainText().contains("sensitive"))return 10;
 bridge.setAvailable(false);
 if(!edits.at(1)->toPlainText().isEmpty()||button->isEnabled())return 11;
 std::cout<<"MAS_RAW_UI_OK incremental workspace, authorized actions and revocation\n";
}
