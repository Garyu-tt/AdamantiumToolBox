import {strict as assert} from 'node:assert';
import {mkdtemp,rm,stat,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {probePlugin} from '../standards/lifecycle/probe.mjs';
const root=resolve(fileURLToPath(new URL('../apps/database/',import.meta.url)));
const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
const dir=await mkdtemp(join(tmpdir(),'probe-database-real-'));
const real=join(dir,'must-not-be-touched');
const oldDir=process.env.DATABASE_DATA_DIR,oldPolicy=process.env.DATABASE_STORAGE_POLICY;
try{
 process.env.DATABASE_DATA_DIR=real;
 process.env.DATABASE_STORAGE_POLICY=JSON.stringify({schema:'mas-database-policy-1',
  tier:'edge',maxJournalBytes:1048576,maxBackups:0,allowWrites:true});
 const result=await probePlugin(root,manifest,6000);
 assert.equal(result.health,'ok');
 assert.equal(result.graph,'valid');
 await assert.rejects(stat(real),/ENOENT/);
 console.log('DATABASE_PROBE_R04_OK isolated-writable-probe-does-not-touch-real-data');
}finally{
 if(oldDir===undefined)delete process.env.DATABASE_DATA_DIR;
 else process.env.DATABASE_DATA_DIR=oldDir;
 if(oldPolicy===undefined)delete process.env.DATABASE_STORAGE_POLICY;
 else process.env.DATABASE_STORAGE_POLICY=oldPolicy;
 await rm(dir,{recursive:true,force:true});
}
