// Durable at-least-once sensor transport; no Genesis or consumer is embedded.
import http from 'node:http';
import {resolve,join} from 'node:path';
import {DurableQueue} from './queue.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('missing_internal_key');
const file=resolve(process.env.DANTE_SENSOR_QUEUE_PATH||
 join(process.env.LOCALAPPDATA||process.cwd(),'Adamantium Toolbox','dante-sensory','queue.json'));
const queue=await new DurableQueue({path:file}).open();
const spec={app:'dantesensory',version:1,nodes:[
 {id:'dantesensory.view',type:'view',title:'Очередь восприятия',icon:'graph',requires:['dantesensory.read']},
 {id:'dantesensory.status',type:'action',title:'Статус очереди',requires:['dantesensory.read']},
 {id:'dantesensory.peek',type:'action',title:'Взять для обработки',requires:['dantesensory.read']},
 {id:'dantesensory.publish',type:'action',title:'Сохранить событие',contract:'dante.sensory.deliver.v1',requires:['dantesensory.write']},
 {id:'dantesensory.ack',type:'action',title:'Подтвердить обработку',requires:['dantesensory.write']}
],edges:['status','peek','publish','ack'].map(x=>({from:'dantesensory.view',to:'dantesensory.'+x,type:'uses'}))};
const send=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));};
async function act(action,params){
 switch(action){
  case 'dantesensory.status':return queue.status();
  case 'dantesensory.peek':return queue.peek(params.limit);
  case 'dantesensory.publish':return await queue.publish(params.event);
  case 'dantesensory.ack':return await queue.ack(params.id);
  default:throw Error('unknown_action');
 }
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'dantesensory',kind:'durable_sensor_queue'});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,spec);
 if(req.method==='POST'&&req.url==='/invoke'){
  let body='',over=false;req.on('data',part=>{body+=part;if(body.length>20000){over=true;req.destroy();}});
  req.on('end',async()=>{if(over)return;
   try{const b=JSON.parse(body);return send(res,200,{result:await act(b.action,b.params||{})});}
   catch(e){const status=/unknown_action|invalid_|event_too_large/.test(e.message)?400:503;
    return send(res,status,{error:String(e.message).slice(0,120)});}
  });return;
 }
 return send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8899),'127.0.0.1');
