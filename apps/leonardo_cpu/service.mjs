import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {iconPNG} from './png.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const permitted=()=>new Set((process.env.ADA_CAPS||'').split(',')).has('graphics.provider');
const manifest=JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8'));
const spec={app:manifest.id,version:1,nodes:[
 {id:'leonardo_cpu.view',type:'view',title:'CPU Icon Generator',icon:'leonardo',requires:['graphics.provider']},
 {id:'leonardo_cpu.provider',type:'resource',title:'CPU Icon Provider',requires:['graphics.provider'],
  provider:{schema:'mas-graphics-provider-1',locality:'local',operations:[
   {kind:'icon',action:'leonardo_cpu.generate',formats:['image/png'],priority:10}]}},
 {id:'leonardo_cpu.generate',type:'action',title:'Generate a PNG icon',requires:['graphics.provider']}
],edges:[{from:'leonardo_cpu.view',to:'leonardo_cpu.provider',type:'uses'},
 {from:'leonardo_cpu.provider',to:'leonardo_cpu.generate',type:'provides'}]};
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,spec);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>12000)req.destroy();});
  req.on('end',()=>{try{
   const b=JSON.parse(raw),p=b.params||{};
   if(b.action!=='leonardo_cpu.generate'||!permitted())throw Error('capability_denied');
   if(typeof p.prompt!=='string'||p.prompt.length>4000)throw Error('invalid_prompt');
   const data=iconPNG(p.prompt,String(p.options?.variant||''));
   send(res,200,{result:{status:'completed',artifact:{mime:'image/png',encoding:'base64',data:data.toString('base64')}}});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
