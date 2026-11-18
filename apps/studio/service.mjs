import http from 'node:http';
const secret=process.env.ADA_INTERNAL_KEY||'';
const core=process.env.ADA_CORE_URL;
if(!core||!/^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(core))throw Error('Invalid core endpoint');
if(secret.length<24)throw Error('Missing internal key');
const spec={app:'studio',version:1,nodes:[
 {id:'studio.view',type:'view',title:'Graph Studio',icon:'studio',requires:['studio.read']},
 {id:'studio.load',type:'action',title:'Загрузить frontend-граф',requires:['studio.read']},
 {id:'studio.save',type:'action',title:'Сохранить frontend-граф',requires:['studio.write']}
],edges:['load','save'].map(id=>({from:'studio.view',to:'studio.'+id,type:'uses'}))};
const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function invoke(action,params){
 if(!['studio.load','studio.save'].includes(action))throw Error('unknown_action');
 const method=action==='studio.load'?'GET':'POST';
 const response=await fetch(core+'/api/frontend',{
  method,signal:AbortSignal.timeout(5000),
  headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},
  body:method==='POST'?JSON.stringify(params):undefined
 });
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'frontend_failed');
 return data;
}
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:'studio'});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,spec);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>175000)req.destroy();});
  req.on('end',async()=>{try{const b=JSON.parse(raw);send(res,200,{result:await invoke(b.action,b.params||{})});}
   catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8883),'127.0.0.1');
