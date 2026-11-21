// Independent checkpoint microplugin; real Genesis is never created by this process.
import http from 'node:http';
import {resolve,join} from 'node:path';
import {CheckpointManager} from './manager.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('missing_internal_key');
const path=resolve(process.env.DANTE_CHECKPOINT_PATH||
 join(process.env.LOCALAPPDATA||process.cwd(),'Adamantium Toolbox','dante-state','checkpoint.json'));
const manager=await new CheckpointManager(path).open();
const spec={app:'dantecheckpoint',version:1,nodes:[
 {id:'dantecheckpoint.view',type:'view',title:'Контрольные точки',icon:'graph',requires:['dantecheckpoint.read']},
 {id:'dantecheckpoint.status',type:'action',title:'Статус',requires:['dantecheckpoint.read']},
 {id:'dantecheckpoint.restore',type:'action',title:'Прочитать состояние',contract:'dante.state.restore.v1',requires:['dantecheckpoint.read']},
 {id:'dantecheckpoint.commit',type:'action',title:'Атомарное сохранение',contract:'dante.state.checkpoint.v1',requires:['dantecheckpoint.write']}
],edges:['status','restore','commit'].map(x=>({from:'dantecheckpoint.view',to:'dantecheckpoint.'+x,type:'uses'}))};
const send=(res,code,body)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
async function action(id,params){
 if(id==='dantecheckpoint.status')return manager.status();
 if(id==='dantecheckpoint.restore')return manager.read();
 if(id==='dantecheckpoint.commit')return await manager.commit(params);
 throw Error('unknown_action');
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'dantecheckpoint',genesis:false});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,spec);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',over=false;req.on('data',p=>{raw+=p;if(raw.length>2200000){over=true;req.destroy();}});
  req.on('end',async()=>{if(over)return;
   try{const b=JSON.parse(raw);return send(res,200,{result:await action(b.action,b.params||{})});}
   catch(e){return send(res,400,{error:String(e.message).slice(0,120)});}
  });return;
 }
 return send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8902),'127.0.0.1');
