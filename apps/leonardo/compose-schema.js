import {attachComposition} from './compose-client.js';
export function attachLeonardoLayout(host,api,after,c){
 const schema={schema:'mas-ui-schema-1',app:'leonardo',
  groups:[
   {id:'task',title:'Новая графическая задача',width:'full',priority:1},
   {id:'providers',title:'Движки',width:'card',priority:10},
   {id:'results',title:'Результат',width:'card',priority:20},
   {id:'jobs',title:'',width:'card',priority:30}],
  elements:[
   {id:'prompt',role:'field',group:'task',label:'Описание'},
   {id:'kind',role:'field',group:'task',label:'Тип задачи'},
   {id:'provider',role:'field',group:'task',label:'Графический движок'},
   {id:'format',role:'field',group:'task',label:'Формат'},
   {id:'key',role:'field',group:'task',label:'Идентификатор иконки'},
   {id:'details',role:'field',group:'task',label:'Параметры'},
   {id:'remote',role:'field',group:'task'},
   {id:'submit',role:'action',group:'task'},
   {id:'providerStatus',role:'status',group:'providers'},
   {id:'refresh',role:'action',group:'providers'},
   {id:'output',role:'output',group:'results'},
   {id:'preview',role:'output',group:'results'},
   {id:'jobsHeading',role:'heading',group:'jobs'},
   {id:'reloadJobs',role:'action',group:'jobs'},
   {id:'jobsList',role:'collection',group:'jobs'}]};
 const controls={prompt:c.prompt,kind:c.kinds,provider:c.providers,format:c.formats,
  key:c.key,details:c.details,remote:c.remoteLabel,submit:c.submit,
  providerStatus:c.info,refresh:c.refresh,output:c.output,preview:c.preview,
  jobsHeading:c.jobsHeading,reloadJobs:c.reloadJobs,jobsList:c.jobsList};
 return attachComposition(host,api,{after,schema,controls});
}
