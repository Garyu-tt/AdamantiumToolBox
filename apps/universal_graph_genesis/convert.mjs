#!/usr/bin/env node
// Read-only one-shot converter; outputs editor-neutral Universal Graph IR JSON.
// It never modifies the Genesis source file or attempts remote execution.
import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {extractGenesisGraph,exportGenesisToUniversal} from './bridge.mjs';
const usage='Usage: node apps/universal_graph_genesis/convert.mjs <genesis-snapshot.json> [graph.id]';
try{
 if(process.argv.length<3||process.argv.length>4)throw new Error(usage);
 const path=resolve(process.argv[2]);
 if(statSync(path).size>8*1024*1024)throw new RangeError('snapshot_exceeds_8MiB_limit');
 const doc=JSON.parse(readFileSync(path,'utf8'));
 const {graph}=exportGenesisToUniversal(extractGenesisGraph(doc),{
  id:process.argv[3]||'genesis.brain'});
 process.stdout.write(JSON.stringify(graph,null,2)+'\n');
}catch(error){
 process.stderr.write('GENESIS export rejected: '+error.message+'\n');
 process.exitCode=1;
}
