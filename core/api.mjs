import {codeMap,codeGraph} from './codemap.mjs';
import {loadFrontend,saveFrontend} from './frontend.mjs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function standardApi(req,res,options){
 const {reply,token,secret,caps}=options;
 const url=new URL(req.url,'http://127.0.0.1');
 if(!['/api/codemap','/api/codemap/graph','/api/codemap/context','/api/mesh/status','/api/frontend'].includes(url.pathname))return false;
 const internal=req.headers['x-internal-key']===secret;
 const user=req.headers.authorization==='Bearer '+token;
 if(!user&&!internal){reply(res,401,{error:'unauthorized'});return true;}
 if(url.pathname==='/api/mesh/status'){
  if(req.method!=='GET'||!caps.has('mesh.read'))reply(res,403,{error:'denied'});
  else try{
   const state=join(process.env.LOCALAPPDATA||process.cwd(),'Adamantium Toolbox','mesh','status.json');
   reply(res,200,JSON.parse((await readFile(state,'utf8')).replace(/^\uFEFF/,'')));
  }catch(e){reply(res,200,{schema:'mas-mesh-status-1',state:'not_initialized',peers:[]});}
  return true;
 }
 if(url.pathname.startsWith('/api/codemap')){
  if(req.method!=='GET'||!caps.has('codemap.read'))reply(res,403,{error:'denied'});
  else try{
   if(url.pathname==='/api/codemap/graph'){
    reply(res,200,await codeGraph('graph'));return true;
   }
   if(url.pathname==='/api/codemap/context'){
    const file=url.searchParams.get('file'),sha=url.searchParams.get('sha');
    if(!file||!sha)throw Error('file_and_sha_required');
    reply(res,200,await codeGraph('context',file,sha));return true;
   }
   const level=Number(url.searchParams.get('level')||0);
   if(![0,1,2].includes(level))throw Error('bad_level');
   reply(res,200,await codeMap(level,url.searchParams.get('file'),url.searchParams.get('sha')));
  }catch(e){reply(res,400,{error:String(e.message).slice(0,120)});}
  return true;
 }
 if(req.method==='GET'){
  if(!internal&&!caps.has('frontend.read'))reply(res,403,{error:'denied'});
  else try{reply(res,200,await loadFrontend());}
  catch(e){reply(res,500,{error:'load_failed'});}
  return true;
 }
 if(req.method==='POST'){
  if(!internal&&!caps.has('frontend.write')){reply(res,403,{error:'denied'});return true;}
  let s='';req.on('data',part=>{s+=part;if(s.length>175000)req.destroy();});
  req.on('end',async()=>{
   try{reply(res,200,await saveFrontend(JSON.parse(s)));}
   catch(e){reply(res,409,{error:String(e.message).slice(0,120)});}
  });
  return true;
 }
 reply(res,405,{error:'bad_method'});
 return true;
}
