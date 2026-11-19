#include "workspace_rows.hpp"
#include <QAbstractItemModel>
#include <QApplication>
#include <QElapsedTimer>
#include <QJsonArray>
#include <QJsonObject>
#include <QListWidget>
#include <QSignalSpy>
#include <algorithm>
#include <iostream>
#include <vector>
int main(int argc,char** argv) {
 QApplication app(argc,argv);
 QListWidget list;
 QJsonArray nodes;
 constexpr int count=1500;
 for(int i=0;i<count;++i) {
  nodes.append(QJsonObject{{"id","view."+QString::number(i)},
   {"type","view"},{"title","Title "+QString::number(i)}});
 }
 patchWorkspaceRows(&list,nodes,{});
 if(list.count()!=count)return 1;
 QListWidgetItem* stable=list.item(500);
 QSignalSpy added(list.model(),&QAbstractItemModel::rowsInserted);
 QSignalSpy removed(list.model(),&QAbstractItemModel::rowsRemoved);
 QSignalSpy changed(list.model(),&QAbstractItemModel::dataChanged);
 constexpr int repeats=250;
 std::vector<qint64> micros;
 micros.reserve(repeats);
 QElapsedTimer clock;
 for(int i=0;i<repeats;++i) {
  clock.start();
  patchWorkspaceRows(&list,{},{});
  micros.push_back(clock.nsecsElapsed()/1000);
 }
 if(added.count()!=0||removed.count()!=0||changed.count()!=0)return 2;
 if(list.item(500)!=stable)return 3;
 QJsonArray rename{QJsonObject{{"id","view.500"},
  {"type","view"},{"title","Updated title"}}};
 patchWorkspaceRows(&list,rename,{});
 if(added.count()!=0||removed.count()!=0||changed.count()!=1)return 4;
 if(list.item(500)!=stable||stable->text()!="Updated title")return 5;
 patchWorkspaceRows(&list,rename,{});
 if(changed.count()!=1)return 6;
 patchWorkspaceRows(&list,{},QJsonArray{"view.500"});
 if(added.count()!=0||removed.count()!=1||list.count()!=count-1)return 7;
 std::sort(micros.begin(),micros.end());
 std::cout<<"MAS_WORKSPACE_INCREMENTAL_OK views="<<count
  <<" noop_events="<<repeats<<" model_changes=0"
  <<" median_us="<<micros[repeats/2]
  <<" p95_us="<<micros[(repeats*95)/100]
  <<" note=synthetic_cpu_model_not_fps\n";
 return 0;
}
