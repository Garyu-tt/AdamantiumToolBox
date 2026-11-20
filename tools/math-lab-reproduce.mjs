#!/usr/bin/env node
/**
 * Isolated Math Lab reproduction CLI. This is an independent OS process using
 * a separately implemented reference decoder, not an independent reviewer.
 *
 * Usage: node tools/math-lab-reproduce.mjs ORIGINAL.bin GRAPH.mlg2 [dataset-id]
 * Reads only explicitly named local files; outputs SHA-256 evidence, never bytes.
 */
import {readFile} from 'node:fs/promises';
import {verifyGraphAgainstOriginal} from '../apps/math_lab/reference_verify.mjs';

const [originalPath,encodedPath,datasetId='local.fixture']=process.argv.slice(2);
if(!originalPath||!encodedPath||process.argv.length>5){
 process.stderr.write('Usage: math-lab-reproduce ORIGINAL.bin GRAPH.mlg2 [dataset-id]\n');
 process.exitCode=2;
}else{
 try{
  const [original,encoded]=await Promise.all([readFile(originalPath),readFile(encodedPath)]);
  if(original.length>8192||encoded.length>8192)throw new RangeError('Reproduction input exceeds limits');
  const receipt=verifyGraphAgainstOriginal(encoded,original,{datasetId});
  process.stdout.write(JSON.stringify(receipt)+'\n');
 }catch(error){
  process.stderr.write('REPRODUCTION_REJECTED: '+String(error.message).slice(0,200)+'\n');
  process.exitCode=1;
 }
}
