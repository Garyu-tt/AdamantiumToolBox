// SPDX-License-Identifier: Apache-2.0
// Second read-only lane inside existing R10 studio tab.
// Reports a verifiable disposable test signature, never an owner grant.
import {resolve,join,isAbsolute,parse} from 'node:path';
const id=n=>'f10f0000000000'+n;
const arrow=n=>[[id(n)]];
export function sandboxLifecycleStudioLane(statusDir){
 if(typeof statusDir!=='string'||!isAbsolute(statusDir))
  throw new TypeError('sandbox_status_absolute_path_required');
 const root=resolve(statusDir);
 if(root===parse(root).root)throw new TypeError('sandbox_status_root_refused');
 const file=join(root,'factory-anchor-r10-sandbox-stage.json');
 const tab=id('01');
 return {
  schema:'adamantium.factory_anchor.sandbox-studio/1',
  testIdentityOnly:true,canGrantMas:false,
  mutatesOwnerPolicy:false,installsProduction:false,
  nodes:[
   {id:id('a1'),z:tab,type:'comment',name:'ПЕСОЧНИЦА · независимое доказательство подписи',
    info:'Вторая цепочка показывает результат упаковки и Ed25519 тестовой идентичностью. Она НЕ является подписью владельца MAS.',
    x:440,y:650,wires:[]},
   {id:id('a2'),z:tab,type:'watch',name:'Изменение тестовой квитанции',
    files:file,recursive:false,x:200,y:745,wires:arrow('a4')},
   {id:id('a3'),z:tab,type:'inject',name:'▶ Посмотреть подписанную песочницу',
    props:[{p:'payload'}],repeat:'',crontab:'',once:false,onceDelay:0.1,
    topic:'',payload:'preview',payloadType:'str',
    x:215,y:820,wires:arrow('a4')},
   {id:id('a4'),z:tab,type:'file in',name:'Read-only: sandbox test receipt',
    filename:file,filenameType:'str',format:'utf8',
    chunk:false,sendError:false,encoding:'none',allProps:false,
    x:490,y:785,wires:arrow('a5')},
   {id:id('a5'),z:tab,type:'json',name:'Результат тестовой подписи',
    property:'payload',action:'obj',pretty:false,
    x:735,y:785,wires:arrow('a6')},
   {id:id('a6'),z:tab,type:'switch',name:'Только тест / ошибка',
    property:'payload.state',propertyType:'msg',
    rules:[{t:'eq',v:'sandbox_signed_staged_unactivated',vt:'str'},
     {t:'else'}],checkall:'true',repair:false,outputs:2,
    x:980,y:785,wires:[[id('a7')],[id('a8')]]},
   {id:id('a7'),z:tab,type:'debug',name:'✓ ТЕСТОВАЯ ПОДПИСЬ · НЕ ПРОД',
    active:true,tosidebar:true,console:false,tostatus:false,
    complete:'payload',targetType:'msg',statusVal:'',statusType:'auto',
    x:1240,y:745,wires:[]},
   {id:id('a8'),z:tab,type:'debug',name:'✕ ТЕСТОВАЯ ПОДПИСЬ НЕ ПРОШЛА',
    active:true,tosidebar:true,console:false,tostatus:false,
    complete:'payload',targetType:'msg',statusVal:'',statusType:'auto',
    x:1240,y:825,wires:[]}
  ]
 };
}
