import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {dispatch} from './protocol.mjs';
const m=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const key=process.env.ADA_INTERNAL_KEY||'',bearer=process.env.ADA_MCP_BEARER||'';
if(key.length<24)throw Error('missing_internal_credential');
const active=bearer.length>=24;
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
function body(req,limit=131072){return new Promise((resolve,reject)=>{
 const parts=[];let size=0;req.on('data',p=>{size+=p.length;if(size>limit){reject(Error('body_too_large'));req.destroy();}else parts.push(p);});
 req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(parts).toString('utf8')));}catch{reject(Error('bad_json'));}});req.on('error',reject);
});}
const graph={app:m.id,version:1,nodes:[{id:m.id+'.view',type:'view',title:'MCP Bridge',icon:m.icon,requires:['mcp_bridge.read']},
 {id:m.id+'.status',type:'action',title:'Bridge status',requires:['mcp_bridge.read']}],edges:[{from:m.id+'.view',to:m.id+'.status',type:'uses'}]};
http.createServer(async(req,res)=>{
 const pathname=(req.url||'').split('?')[0];
 if(req.method==='GET'&&pathname==='/health')return json(res,200,{app:m.id,protocol:'mcp-streamable-http',exposed:'loopback',mcp:active?'ready':'disabled'});
 if(pathname==='/mcp'){
  if(!active)return json(res,503,{error:'mcp_not_configured'});
  if(req.headers.authorization!=='Bearer '+bearer)return json(res,401,{error:'unauthorized'});
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  try{const p=await body(req);const result=await dispatch(p);return result?json(res,200,result):(res.writeHead(202),res.end());}
  catch(e){return json(res,400,{error:String(e.message).slice(0,100)});}
 }
 if(req.headers['x-internal-key']!==key)return json(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&pathname==='/graph')return json(res,200,graph);
 if(req.method==='POST'&&pathname==='/invoke'){
  try{const p=await body(req);if(p.action!==m.id+'.status')return json(res,403,{error:'denied'});
   return json(res,200,{result:{service:'mcp_bridge',status:active?'ready':'disabled'}});}
  catch(e){return json(res,400,{error:String(e.message).slice(0,100)});}
 }
 json(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||m.service.port),'127.0.0.1');
