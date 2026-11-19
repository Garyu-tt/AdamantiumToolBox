// Isolated deterministic CPU fixture, never a live Genesis or persistent world.
import http from 'node:http';
import {MockWorld} from './engine.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('missing_internal_key');
const config={start:0,target:4,limit:256};
let world=new MockWorld(config);
const spec={app:'danteworld',version:1,nodes:[
 {id:'danteworld.view',type:'view',title:'CPU World (тест)',icon:'graph',requires:['danteworld.read']},
 {id:'danteworld.observe',type:'action',title:'Наблюдение',contract:'dante.world.observe.v1',fixture:true,requires:['danteworld.read']},
 {id:'danteworld.apply',type:'action',title:'Действие',contract:'dante.world.apply.v1',fixture:true,requires:['danteworld.control']},
 {id:'danteworld.snapshot',type:'action',title:'Снимок',requires:['danteworld.read']},
 {id:'danteworld.restore',type:'action',title:'Восстановить снимок',requires:['danteworld.control']},
 {id:'danteworld.reset',type:'action',title:'Сбросить тестовый мир',requires:['danteworld.control']}
],edges:['observe','apply','snapshot','restore','reset'].map(x=>({from:'danteworld.view',to:'danteworld.'+x,type:'uses'}))};
const result=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));};
const respond=(action,params)=>{
 switch(action){
  case 'danteworld.observe': return world.observe();
  case 'danteworld.apply': return world.step(params.command);
  case 'danteworld.snapshot': return world.snapshot();
  case 'danteworld.restore': { const candidate=MockWorld.restore(params.snapshot);world=candidate;return world.observe(); }
  case 'danteworld.reset': world=new MockWorld(config);return world.observe();
  default: throw Error('unknown_action');
 }
};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return result(res,200,{app:'danteworld',fixture:true,persistent:false,genesis:false});
 if(req.headers['x-internal-key']!==secret)return result(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return result(res,200,spec);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',over=false;
  req.on('data',chunk=>{raw+=chunk;if(raw.length>16384){over=true;req.destroy();}});
  req.on('end',()=>{if(over)return;
   try{const body=JSON.parse(raw);return result(res,200,{result:respond(body.action,body.params||{})});}
   catch(e){return result(res,400,{error:String(e.message).slice(0,100)});}
  });return;
 }
 return result(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8897),'127.0.0.1');
