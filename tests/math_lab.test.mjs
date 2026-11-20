import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {tryRootTransform,decodeRootTransform,ROOT_TRANSFORM_ABI}
 from '../apps/math_lab/root_transform.mjs';
import {runCompressionExperiment,validateHypothesis,shannonBitsPerByte}
 from '../apps/math_lab/experiment.mjs';
import {createResearchPlan,RESEARCH_PLAN_SCHEMA} from '../apps/math_lab/research_plan.mjs';
import {validateManifest} from '../core/contract.mjs';
import {readFile} from 'node:fs/promises';

const toBytes=n=>{
 let hex=n.toString(16);
 if(hex.length%2)hex='0'+hex;
 return Buffer.from(hex,'hex');
};

test('MAS app manifest is valid and plugin-independent',async()=>{
 const m=JSON.parse(await readFile(new URL('../apps/math_lab/manifest.json',import.meta.url),'utf8'));
 assert.equal(validateManifest(m),true);
 assert.deepEqual(m.permissions,['math_lab.read','math_lab.experiment','math_lab.verify']);
 assert.equal(m.lifecycle,'independent');
});

test('arbitrary-degree integer root losslessly encodes 10^1000',()=>{
 const data=toBytes(10n**1000n);
 assert.equal(data.length,416);
 const r=tryRootTransform(data,{degrees:[1000],maxDepth:1,maxEvaluations:4});
 assert.ok(r.compressed);
 assert.ok(r.compressed.length<30);
 assert.ok(decodeRootTransform(r.compressed).equals(data));
 assert.equal(r.mode,'root-transform');
 assert.ok(r.evaluated<=4);
});

test('arbitrary-degree root of binary power is compact and exact',()=>{
 const data=toBytes(2n**4096n);
 const r=tryRootTransform(data,{degrees:[4096],maxDepth:1});
 assert.ok(r.compressed);
 assert.ok(r.compressed.length<30);
 assert.deepEqual(decodeRootTransform(r.compressed),data);
});

test('small numbers and random bytes are never forced into a larger stream',()=>{
 const small=Buffer.from([0x07,0x5b,0xcd,0x15]);
 assert.equal(tryRootTransform(small,{degrees:[2,3]}).compressed,null);
 const random=randomBytes(1024);
 const r=tryRootTransform(random,{maxDepth:1,maxEvaluations:20});
 assert.equal(r.compressed,null);
 assert.equal(r.mode,'raw-fallback');
});

test('leading zero bytes are exactly reconstructed, including explicit length',()=>{
 const source=Buffer.concat([Buffer.alloc(12),toBytes(10n**1000n)]);
 const r=tryRootTransform(source,{degrees:[1000],maxDepth:1});
 assert.ok(r.compressed);
 assert.deepEqual(decodeRootTransform(r.compressed),source);
 assert.equal(decodeRootTransform(r.compressed).length,428);
});

test('bounded random property roundtrips independently whenever compressed',()=>{
 for(let i=0;i<22;i++){
  const size=i===0?0:i*7;
  const source=randomBytes(size);
  const encoded=tryRootTransform(source,{degrees:[2,3,5],maxDepth:1,maxEvaluations:4});
  if(encoded.compressed)assert.deepEqual(decodeRootTransform(encoded.compressed),source);
  else assert.equal(encoded.mode,'raw-fallback');
  assert.ok(encoded.evaluated<=4);
 }
});

test('strict decoder rejects corrupt magic, truncation, trailing bytes and absurd lengths',()=>{
 const good=tryRootTransform(toBytes(10n**1000n),{degrees:[1000],maxDepth:1}).compressed;
 assert.ok(good);
 assert.throws(()=>decodeRootTransform(Buffer.from('xxxx')),/not a RootTransform/);
 assert.throws(()=>decodeRootTransform(good.subarray(0,good.length-1)));
 assert.throws(()=>decodeRootTransform(Buffer.concat([good,Buffer.from([0])])),/trailing/);
 assert.throws(()=>decodeRootTransform(good,{maxOutputBytes:32}),/bound/);
});

test('Shannon estimate is analysis only and reports plausible range',()=>{
 assert.equal(shannonBitsPerByte(Buffer.alloc(100)),0);
 assert.equal(shannonBitsPerByte(Buffer.from([0,1,0,1])),1);
 const e=shannonBitsPerByte(randomBytes(1024));
 assert.ok(e>6.5&&e<=8);
});

test('MDL report includes model cost, baseline zlib and exact recovery without claiming external QA',()=>{
 const data=toBytes(10n**1000n);
 const report=runCompressionExperiment(data,{
  datasetId:'power1000',degrees:[1000],maxDepth:1,
  rootModelBytes:7,zlibModelBytes:0
 });
 assert.equal(report.originalBytes,416);
 assert.equal(report.transform,ROOT_TRANSFORM_ABI);
 assert.equal(report.verification.exactRootRoundtrip,true);
 assert.equal(report.verification.independentAudit,'not-performed');
 assert.equal(report.verification.approvedForProduction,false);
 const root=report.candidates.find(c=>c.method==='root-transform');
 assert.ok(root.storedBytes<30);
 assert.equal(root.totalBytes,root.storedBytes+7);
 assert.equal(report.selected,'root-transform');
 assert.equal(report.savingsBytes,416-report.selectedTotalBytes);
 assert.match(report.inputSha256,/^[a-f0-9]{64}$/);
 assert.match(report.experimentDigest,/^[a-f0-9]{64}$/);
});

