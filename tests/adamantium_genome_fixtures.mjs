export const clone=x=>JSON.parse(JSON.stringify(x));
const port=(id,dataType,direction,semantics='data')=>
 ({id,dataType,direction,semantics});
const node=(id,kind,typeRef,ports)=>({
 id,kind,typeRef,graphRef:'',ports,graphRefRevision:0
});
const edge=(id,fromNode,fromPort,toNode,toPort,semantics='data',delayTicks=0)=>
 ({id,fromNode,fromPort,toNode,toPort,semantics,delayTicks});
export function selfHostGraph(){
 const genome=node('genome','resource','adamantium.genome.store@1',[
  port('ref','genome.ref@1','output')]);
 const compiler=node('compiler','capability','adamantium.genome.compiler@1',[
  port('source','genome.ref@1','input'),
  port('graph','graph.ref@1','output')]);
 const verifier=node('verifier','capability','mechanicus.graph.verify@1',[
  port('graph','graph.ref@1','input'),
  port('result','verification.receipt@1','output')]);
 const candidate=node('candidate','capability','mechanicus.lifecycle.proposal@1',[
  port('receipt','verification.receipt@1','input')]);
 return {schema:GRAPH_SCHEMA,id:'adamantium.selfhost',schemaVersion:1,
  revision:4,domain:'program',interfacePorts:[],
  nodes:[genome,compiler,verifier,candidate],
  edges:[edge('decode','genome','ref','compiler','source'),
   edge('verify','compiler','graph','verifier','graph'),
   edge('propose','verifier','result','candidate','receipt')]};
}
export function sampleNeural(){
 return {schema:GRAPH_SCHEMA,id:'genesis.brain',schemaVersion:1,
  revision:2,domain:'neural',interfacePorts:[],
  nodes:[
   node('vision','brain-region','genesis.region@1',[
    port('signal_in','neural.spike@1','input','signal'),
    port('signal_out','neural.spike@1','output','signal')]),
   node('association','brain-region','genesis.region@1',[
    port('signal_in','neural.spike@1','input','signal'),
    port('signal_out','neural.spike@1','output','signal')])],
  edges:[edge('forward','vision','signal_out','association','signal_in','signal'),
   edge('feedback','association','signal_out','vision','signal_in','signal',1)]};
}
