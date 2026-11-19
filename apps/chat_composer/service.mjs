import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const manifest=JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const graph={"app":"chat_composer","version":1,"nodes":[{"id":"chat_composer.view","type":"view","title":"Chat Composer","icon":"studio","requires":["chat.compose"],"composition":{"schema":"mas-composite-view-1","surface":"conversation","slot":"composer","order":20}}],"edges":[]};
const send=(res,code,body)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
