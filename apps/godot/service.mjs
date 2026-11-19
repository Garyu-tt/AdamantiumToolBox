import http from 'node:http';
import {providers,dispatch} from './registry.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const caps=new Set((process.env.ADA_CAPS||'').split(','));
const actions={
 'godot.providers':['godot.read',null],
 'godot.engine.inspect':['godot.read','engine.inspect'],
 'godot.project.check':['godot.read','project.check'],
 'godot.session.start':['godot.launch','session.start'],
 'godot.session.status':['godot.read','session.status'],
 'godot.session.stop':['godot.launch','session.stop']
};
const spec={app:'godot',version:1,nodes:[
 {id:'godot.view',type:'view',title:'Godot World Engine',icon:'studio',requires:['godot.read']},
 {id:'godot.world',type:'resource',title:'World Engine Gateway',
  requires:['godot.read'],provider:{schema:'mas-world-engine-router-1',version:1}},
 ...Object.entries(actions).map(([id,[cap]])=>({id,type:'action',title:id,
  requires:[cap]}))
],edges:[{from:'godot.view',to:'godot.world',type:'uses'},
 ...Object.keys(actions).map(id=>({from:'godot.world',to:id,type:'provides'}))]};
function send(res,status,data){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
 res.end(JSON.stringify(data));
}
async function invoke(action,params){
 const target=actions[action];
 if(!target)throw Error('action_not_found');
 if(!caps.has(target[0]))throw Error('capability_denied');
 if(!target[1])return providers();
 return dispatch(target[1],params);
}
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:'godot'});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,spec);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';
  req.on('data',d=>{raw+=d;if(raw.length>32768)req.destroy();});
  req.on('end',async()=>{
   try{const b=JSON.parse(raw);
    send(res,200,{result:await invoke(b.action,b.params||{})});}
   catch(e){send(res,400,{error:String(e.message).slice(0,160)});}
  });return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8930),'127.0.0.1');
