import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const dir=await mkdtemp(join(tmpdir(),'mas-factory-http-'));
const path=join(dir,'events.jsonl');
const key=randomBytes(32).toString('hex');
const portProbe=createServer();await new Promise(ok=>portProbe.listen(0,'127.0.0.1',ok));
const port=portProbe.address().port;await new Promise(ok=>portProbe.close(ok));
const event={schema:'factory-diagnostic-event/1',agent_id:'agent-1',session_id:'session-1',at:'2026-11-21T10:00:00Z',type:'assistant_message',text:'actual reply'};
await writeFile(path,JSON.stringify(event)+'\n');
const child=spawn(process.execPath,[join(root,'apps/factory-diagnostics/service.mjs')],{
 env:{...process.env,APP_PORT:String(port),ADA_INTERNAL_KEY:key,ADA_FACTORY_DIAGNOSTICS_FILE:path},stdio:'ignore'
});
const base='http://127.0.0.1:'+port;
const get=(route,secret)=>fetch(base+route,{headers:secret?{'x-internal-key':secret}:{},signal:AbortSignal.timeout(1500)});
const invoke=(action,params={},secret=key)=>fetch(base+'/invoke',{method:'POST',headers:{'x-internal-key':secret,'content-type':'application/json'},body:JSON.stringify({action,params}),signal:AbortSignal.timeout(2000)});
try{
 let ready=false;
 for(let i=0;i<30;i++){try{const r=await get('/health');if(r.status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert(ready,'service must start');
 assert.equal((await get('/graph')).status,401);
 assert.equal((await get('/graph','bad-key')).status,401);
 const graph=await (await get('/graph',key)).json();
 assert(graph.nodes.every(n=>n.requires.includes('factory.read')));
 assert.equal((await invoke('factory-diagnostics.events',{},'wrong-key')).status,401);
 const res=await (await invoke('factory-diagnostics.events')).json();
 assert.equal(res.result.source,'connected');assert.equal(res.result.events[0].text,'actual reply');
 const sessions=await (await invoke('factory-diagnostics.sessions')).json();
 assert.equal(sessions.result.sessions[0].agent_id,'agent-1');
 assert.equal((await invoke('factory-diagnostics.mutate')).status,403);
 console.log('FACTORY_DIAGNOSTICS_HTTP_OK owner_only, no write actions, real event');
}finally{child.kill();await rm(dir,{recursive:true,force:true});}
