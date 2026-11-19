import http from 'node:http';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const graph={app:'mikoshi_classroom',version:1,nodes:[
 {id:'mikoshi_classroom.view',type:'view',title:'Mikoshi Classroom',
  icon:'studio',requires:['classroom.view']},
 {id:'mikoshi_classroom.blueprint',type:'resource',requires:['classroom.view'],
  composition:{schema:'mikoshi.composite.v1',discovery:'mikoshi.skill.v1'}}
],edges:[{from:'mikoshi_classroom.view',to:'mikoshi_classroom.blueprint',type:'uses'}]};
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store'});res.end(JSON.stringify(data));};
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:graph.app});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8950),'127.0.0.1');
