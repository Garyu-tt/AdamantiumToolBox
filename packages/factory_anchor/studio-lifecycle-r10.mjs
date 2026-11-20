// SPDX-License-Identifier: Apache-2.0
// Native Node-RED diagnostic view of MAS lifecycle gates. No write actions.
import {resolve,join,isAbsolute,parse} from 'node:path';
const id=n=>'f10f0000000000'+n.toString(16).padStart(2,'0');
const link=n=>[[id(n)]];
export function factoryLifecycleStudioPreview(statusDir){
 if(typeof statusDir!=='string'||!isAbsolute(statusDir))
  throw new TypeError('absolute_lifecycle_status_directory_required');
 const root=resolve(statusDir);
 if(root===parse(root).root)throw new TypeError('refuse_filesystem_root');
 const tab=id(1),file=join(root,'factory-anchor-lifecycle-r10.json');
 return {
  schema:'adamantium.factory_anchor.lifecycle-studio/1',
  mutatesPolicies:false,activatesPlugins:false,
  canGrantPermissions:false,executesCode:false,
  nodes:[
   {id:tab,type:'tab',label:'10 · SIGNED LIFECYCLE R10',
    disabled:false,info:'This is read-only visibility. A missing policy scope is NOT automatically granted.'},
   {id:id(2),type:'comment',z:tab,
    name:'R10 · ПРАВА → ПОДПИСЬ → ПЛАН → АКТИВАЦИЯ',
    info:'Реальная MAS политика проверяется отдельно от подписанного пакета. Никакой установки по факту прохождения CI.',
    x:390,y:90,wires:[]},
   {id:id(3),type:'watch',z:tab,name:'Новый Lifecycle-отчёт',
    files:file,recursive:false,x:175,y:190,wires:link(5)},
   {id:id(4),type:'inject',z:tab,name:'▶ Прочитать состояние разрешений',
    props:[{p:'payload'}],repeat:'',crontab:'',once:false,onceDelay:0.1,
    topic:'',payload:'inspect',payloadType:'str',
    x:190,y:260,wires:link(5)},
   {id:id(5),type:'file in',z:tab,name:'Read-only: MAS Lifecycle status',
    filename:file,filenameType:'str',format:'utf8',
    chunk:false,sendError:false,encoding:'none',allProps:false,
    x:480,y:225,wires:link(6)},
   {id:id(6),type:'json',z:tab,name:'Разобрать отчёт',
    property:'payload',action:'obj',pretty:false,
    x:685,y:225,wires:link(7)},
   {id:id(7),type:'switch',z:tab,name:'Подписан / готов / запрещено',
    property:'payload.state',propertyType:'msg',
    rules:[
     {t:'eq',v:'signed_staged_unactivated',vt:'str'},
     {t:'eq',v:'ready_to_stage',vt:'str'},
     {t:'else'}
    ],checkall:'true',repair:false,outputs:3,
    x:935,y:225,wires:[[id(8)],[id(9)],[id(10)]]},
   {id:id(8),type:'debug',z:tab,name:'✓ ПОДПИСАН, НЕ АКТИВИРОВАН',
    active:true,tosidebar:true,console:false,tostatus:false,
    complete:'payload',targetType:'msg',statusVal:'',statusType:'auto',
    x:1210,y:150,wires:[]},
   {id:id(9),type:'debug',z:tab,name:'◌ МОЖНО ГОТОВИТЬ ПОДПИСЬ',
    active:true,tosidebar:true,console:false,tostatus:false,
    complete:'payload',targetType:'msg',statusVal:'',statusType:'auto',
    x:1200,y:240,wires:[]},
   {id:id(10),type:'debug',z:tab,name:'✕ НЕТ ПРАВ / ТРЕБУЕТСЯ РЕШЕНИЕ',
    active:true,tosidebar:true,console:false,tostatus:false,
    complete:'payload',targetType:'msg',statusVal:'',statusType:'auto',
    x:1220,y:330,wires:[]},
   {id:id(11),type:'comment',z:tab,
    name:'Сейчас: Core 8880 работает, factory_anchor НЕ установлен',
    info:'Для установки нужны отдельные подписанные Lifecycle шаги и подтверждение владельца. Эта вкладка не отправляет команды изменения политики.',
    x:493,y:425,wires:[]},
   {id:id(12),type:'comment',z:tab,
    name:'Никаких install, exec, function, shell или выдачи прав',
    info:'Ревизия регистра, отдельные owner scopes и проверенный подписанный пакет не заменяют операторское согласование.',
    x:505,y:505,wires:[]}
  ]
 };
}
