import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {tryRootTransform} from '../apps/math_lab/root_transform.mjs';
import {
 searchReversibleTransforms,TRANSFORM_GRAPH_SCHEMA
} from '../apps/math_lab/transform_graph.mjs';
import {
 referenceDecodeGraph,verifyGraphAgainstOriginal,decodeRootReference
} from '../apps/math_lab/reference_verify.mjs';

const magic=Buffer.from('MLG2','ascii');
const lengthVarint=n=>{const values=[];do{const d=n%128;n=Math.floor(n/128);values.push(d+(n?128:0));}while(n);return Buffer.from(values);};
const envelope=(source,ops,payload,codec=1)=>
 Buffer.concat([magic,lengthVarint(source.length),Buffer.from([ops.length,...ops,codec]),payload]);
const digest=x=>createHash('sha256').update(x).digest('hex');
const toBytes=n=>{
 let hex=n.toString(16);
 if(hex.length&1)hex='0'+hex;
 return Buffer.from(hex,'hex');
};

test('reference verifier runs as a separate process with hash-only receipt and tamper rejection',async()=>{
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {spawnSync}=await import('node:child_process');
 const {fileURLToPath}=await import('node:url');
 const cli=fileURLToPath(new URL('../tools/math-lab-reproduce.mjs',import.meta.url));
 const dir=await mkdtemp(join(tmpdir(),'math-lab-verifier-'));
 try{
  const original=Buffer.from([1,2,3,4,5]);
  const encoded=envelope(original,[3],deflateSync(Buffer.from([1,3,5,2,4])));
  const origPath=join(dir,'origin.bin'),candidatePath=join(dir,'encoded.mlg2');
  await writeFile(origPath,original);
  await writeFile(candidatePath,encoded);
  const result=spawnSync(process.execPath,[cli,origPath,candidatePath,'lab.fixture'],
   {encoding:'utf8',timeout:5000});
  assert.equal(result.status,0,result.stderr);
  const receipt=JSON.parse(result.stdout.trim());
  assert.equal(receipt.exactByteEquality,true);
  assert.equal(receipt.independentImplementation,true);
  assert.equal(receipt.independentAgentReviewed,false);
  assert.equal(receipt.independentQACompleted,false);
  assert.equal(receipt.originalSha256,digest(original));
  assert.equal(result.stdout.includes(original.toString('hex')),false);
  await writeFile(candidatePath,Buffer.from('MLG2deadbeef'));
  const rejected=spawnSync(process.execPath,[cli,origPath,candidatePath,'lab.fixture'],
   {encoding:'utf8',timeout:5000});
  assert.equal(rejected.status,1);
  assert.match(rejected.stderr,/REPRODUCTION_REJECTED/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
