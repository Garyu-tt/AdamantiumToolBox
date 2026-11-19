// Thin MAS app: readiness and UI only; never substitutes a mock for Genesis.
import http from 'node:http';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('missing_internal_key');
const spec={app:'dante',version:1,nodes:[
 {id:'dante.view',type:'view',title:'Данте',icon:'dante',requires:['dante.read']},
 {id:'dante.status',type:'action',title:'Проверить статус',requires:['dante.read']}
],edges:[{from:'dante.view',to:'dante.status',type:'uses'}]};
const status=()=>({schema:'dante.app.status.v1',state:'composition_only',
 genesisVerified:false,worldVerified:false,checkpointVerified:false,live:false,
 message:'Providers are discovered through the host capability graph; no Genesis launch performed.'});
const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'dante',mode:'composition_only'});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,spec);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',tooLarge=false;
  req.on('data',part=>{raw+=part;if(raw.length>8192){tooLarge=true;req.destroy();}});
  req.on('end',()=>{if(tooLarge)return;
   try{const b=JSON.parse(raw);if(b.action!=='dante.status')return send(res,404,{error:'unknown_action'});
    return send(res,200,{result:status()});}
   catch{return send(res,400,{error:'invalid_body'});}
  });return;
 }
 return send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8896),'127.0.0.1');
