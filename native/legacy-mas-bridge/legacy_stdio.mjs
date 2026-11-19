#!/usr/bin/env node
// Optional, supervised, read-only legacy MAS graph discovery sidecar.
// Only a trusted local supervisor may attach its stdin/stdout (no socket).
const MAGIC=Buffer.from('MASL');
const HEADER=20, LIMIT=65536;
const GET=1, RESULT=2, ERROR=3;
const TOKEN=process.env.MAS_LEGACY_CORE_TOKEN||'';
const RAW_URL=process.env.MAS_LEGACY_CORE_URL||'';
let base;
try {
 base=new URL(RAW_URL);
 const host=base.hostname;
 const port=Number(base.port);
 if(base.protocol!=='http:' || !['127.0.0.1','[::1]'].includes(host) ||
    !Number.isInteger(port)||port<1024||port>65535 ||
    base.pathname!=='/'||base.search||base.hash||base.username||base.password||
    TOKEN.length<24 || TOKEN.length>1024 || /[\r\n]/.test(TOKEN))throw Error('config');
}catch{process.stderr.write('legacy_sidecar_configuration\n');process.exitCode=2;}
if(process.exitCode){process.stdin.pause();}
else {
 let pending=Buffer.alloc(0),lastId=0n,queue=Promise.resolve(),terminated=false;
 function packet(op,id,payload=Buffer.alloc(0)){
   const b=Buffer.alloc(HEADER+payload.length);
   MAGIC.copy(b,0);b.writeUInt16BE(1,4);b.writeUInt16BE(op,6);
   b.writeBigUInt64BE(id,8);b.writeUInt32BE(payload.length,16);
   payload.copy(b,HEADER);return b;
 }
 function fail(id,code){
   if(terminated)return;
   terminated=true;
   process.stdout.write(packet(ERROR,id||1n,Buffer.from(code)),()=>{
     process.exitCode=2;process.stdin.pause();
   });
 }
 const idok=s=>/^[a-z][a-z0-9_.-]{0,127}$/.test(s);
 function cleanGraph(doc){
   if(!doc || doc.version!==1 || !Array.isArray(doc.nodes) ||
      !Array.isArray(doc.edges) || doc.nodes.length>2048 || doc.edges.length>4096)
     throw Error('invalid_graph');
   const nodes=[],names=new Set();
   for(const node of doc.nodes){
     if(!node||!idok(node.id)||!['view','action','resource','event'].includes(node.type)||
        names.has(node.id))throw Error('invalid_graph');
     names.add(node.id);nodes.push({id:node.id,type:node.type});
   }
   const edges=[];
   for(const e of doc.edges){
     if(!e||!names.has(e.from)||!names.has(e.to)||
       typeof e.type!=='string'||!/^[a-z][a-z0-9_-]{0,31}$/.test(e.type))
       throw Error('invalid_graph');
     edges.push({from:e.from,to:e.to,type:e.type});
   }
   const data=Buffer.from(JSON.stringify({schema:'mas-legacy-discovery-1',version:1,nodes,edges}));
   if(data.length>LIMIT)throw Error('graph_limit');
   return data;
 }
 async function readGraph(){
   const res=await fetch(new URL('/api/graph',base),{
     headers:{Authorization:'Bearer '+TOKEN,'Cache-Control':'no-store'},
     signal:AbortSignal.timeout(2000),redirect:'error'});
   if(!res.ok)throw Error('upstream_unavailable');
   if(Number(res.headers.get('content-length')||0)>LIMIT)throw Error('graph_limit');
   const reader=res.body.getReader();let size=0;const chunks=[];
   try{
     while(true){const {done,value}=await reader.read();if(done)break;
       size+=value.byteLength;
       if(size>LIMIT)throw Error('graph_limit');
       chunks.push(Buffer.from(value));
     }
   }finally{reader.releaseLock();}
   return cleanGraph(JSON.parse(Buffer.concat(chunks,size).toString('utf8')));
 }
 function handleFrame(frame){
   const id=frame.readBigUInt64BE(8),op=frame.readUInt16BE(6);
   if(id<=lastId || op!==GET || frame.length!==HEADER){fail(id,'invalid_request');return;}
   lastId=id;
   queue=queue.then(async()=>{
     if(terminated)return;
     try {const data=await readGraph();if(!terminated)process.stdout.write(packet(RESULT,id,data));}
     catch{fail(id,'legacy_graph_unavailable');}
   }).catch(()=>fail(id,'legacy_graph_unavailable'));
 }
 process.stdin.on('data',chunk=>{
   if(terminated)return;
   if(pending.length+chunk.length>8192){fail(1n,'invalid_request');return;}
   pending=Buffer.concat([pending,chunk]);
   while(!terminated && pending.length>=HEADER){
     if(!pending.subarray(0,4).equals(MAGIC)||pending.readUInt16BE(4)!==1 ||
        pending.readUInt32BE(16)!==0 || pending.readUInt16BE(6)!==GET){
       fail(1n,'invalid_request');return;
     }
     const frame=pending.subarray(0,HEADER);pending=pending.subarray(HEADER);
     handleFrame(frame);
   }
 });
 process.stdin.on('end',()=>{if(pending.length)process.exitCode=2;});
 process.stdin.on('error',()=>{process.exitCode=2;});
}
