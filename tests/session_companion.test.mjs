import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sanitizeSession,currentSession} from '../apps/client_watchdog/session.mjs';
const now=Date.now(),stamp=new Date(now).toISOString();
const sample={schema:'mas-session-companion-status-1',
 updatedAt:stamp,mode:'agent_present',reason:'agent_detected',
 agentCount:1,failures:0,launches:1,lastGoodUtc:stamp,
 nextAttemptUtc:null,privateField:'do_not_expose'};
assert.equal(sanitizeSession(sample,now).mode,'agent_present');
assert.equal(sanitizeSession(sample,now+190000).mode,'stale');
assert.equal(sanitizeSession({...sample,updatedAt:new Date(now+700000).toISOString()},now).mode,'invalid');
assert.equal(sanitizeSession({...sample,schema:'bad'},now).mode,'invalid');
assert(!JSON.stringify(sanitizeSession(sample,now)).includes('privateField'));
assert.equal((await currentSession(null)).mode,'not_configured');
const root=await mkdtemp(join(tmpdir(),'mas-session-companion-'));
const dir=join(root,'Adamantium Toolbox','client-watchdog','telemetry');
const file=join(dir,'session-status.json');
try{
 await mkdir(dir,{recursive:true});
 await writeFile(file,JSON.stringify(sample));
 assert.equal((await currentSession(root,now)).agentCount,1);
 await writeFile(file,'invalid json');
 assert.equal((await currentSession(root,now)).mode,'invalid');
 await rm(file);
 const external=join(root,'other.json');
 await writeFile(external,JSON.stringify(sample));
 await symlink(external,file);
 assert.equal((await currentSession(root,now)).mode,'invalid');
 console.log('SESSION_COMPANION_OK stale, redaction, no config, invalid data, symlink');
}finally{await rm(root,{recursive:true,force:true});}
