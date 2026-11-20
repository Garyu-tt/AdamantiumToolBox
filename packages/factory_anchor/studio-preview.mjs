// SPDX-License-Identifier: Apache-2.0
// Visual observer is a client of a public preview status, not the MAS backend.
import {resolve,isAbsolute,parse,join} from 'node:path';
const id=n=>'f09f0000000000'+n.toString(16).padStart(2,'0');
const out=n=>[[id(n)]];
export function factoryAnchorStudioPreview(statusDirectory){
 if(typeof statusDirectory!=='string'||!isAbsolute(statusDirectory))
  throw new TypeError('factory_anchor_status_absolute_path_required');
 const root=resolve(statusDirectory);
 if(root===parse(root).root)throw new TypeError('factory_anchor_status_root_refused');
 const file=join(root,'factory-anchor-r09-status.json'),tab=id(1);
 return {
  schema:'adamantium.factory_anchor.studio-preview/1',
  masInstalled:false,sourceAppIndependent:true,
  writesProduction:false,signerPrivateKeyUsed:false,
  nodes:[
   {id:tab,type:'tab',label:'09 · FACTORY ANCHOR MAS',
    disabled:false,info:'Independent MAS package R09. Read-only local preview; production Core installation not asserted.'},
   {id:id(2),z:tab,type:'comment',
    name:'FACTORY ANCHOR · независимый MAS-плагин',
    info:'Проверка реального R05/R06/R08 публичного доказательства. Подписание и Lifecycle здесь недоступны.',
    x:370,y:90,wires:[]},
   {id:id(3),z:tab,type:'watch',name:'Новый отчёт MAS-плагина',
    files:file,recursive:false,x:195,y:200,wires:out(5)},
   {id:id(4),z:tab,type:'inject',name:'▶ Проверить текущий отчёт',
    props:[{p:'payload'}],repeat:'',crontab:'',once:false,onceDelay:0.1,
    topic:'',payload:'read',payloadType:'str',x:200,y:270,wires:out(5)},
   {id:id(5),z:tab,type:'file in',name:'Read-only factory-anchor status',
    filename:file,filenameType:'str',format:'utf8',
    chunk:false,sendError:false,encoding:'none',allProps:false,
    x:490,y:235,wires:out(6)},
   {id:id(6),z:tab,type:'json',name:'Разобрать MAS status',
    property:'payload',action:'obj',pretty:false,
    x:720,y:235,wires:out(7)},
   {id:id(7),z:tab,type:'switch',name:'Сверить состояние',
    property:'payload.status',propertyType:'msg',
    rules:[{t:'eq',v:'verified_current',vt:'str'},
     {t:'eq',v:'verified_stale',vt:'str'},
     {t:'else'}],
    checkall:'true',repair:false,outputs:3,
    x:930,y:235,wires:[[id(8)],[id(9)],[id(10)]]},
   {id:id(8),z:tab,type:'debug',name:'✓ R09 ДВА СВИДЕТЕЛЯ ПРОВЕРЕНЫ',
    active:true,tosidebar:true,console:false,tostatus:true,
    complete:'payload',targetType:'msg',
    statusVal:'payload.verification.anchorSequence',statusType:'msg',
    x:1190,y:160,wires:[]},
   {id:id(9),z:tab,type:'debug',name:'! R09 ПОДПИСЬ УСТАРЕЛА',
    active:true,tosidebar:true,console:false,tostatus:false,
    complete:'payload',targetType:'msg',statusVal:'',statusType:'auto',
    x:1190,y:250,wires:[]},
   {id:id(10),z:tab,type:'debug',name:'✕ R09 НЕТ ПОДТВЕРЖДЕНИЯ',
    active:true,tosidebar:true,console:false,tostatus:false,
    complete:'payload',targetType:'msg',statusVal:'',statusType:'auto',
    x:1190,y:340,wires:[]},
   {id:id(11),z:tab,type:'comment',
    name:'Core + app: независимый контракт и отдельные MAS права',
    info:'factory_anchor.read отдельно от factory_anchor.attest. В этой студии только публичная проверка.',
    x:490,y:435,wires:[]},
   {id:id(12),z:tab,type:'comment',
    name:'MAS production: NOT INSTALLED · Lifecycle: not approved',
    info:'Плагин проверен как Core + App, но не зарегистрирован в действующем MAS Core и не получает прав на публикацию.',
    x:510,y:525,wires:[]}
  ]
 };
}
