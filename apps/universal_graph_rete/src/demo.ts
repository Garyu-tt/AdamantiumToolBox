import type { Graph, Node, Port, Edge } from './types';

const port = (id: string, dataType: string,
  direction: Port['direction'], semantics: Port['semantics'] = 'data'): Port =>
  ({id, dataType, direction, semantics});
const node = (id: string, kind: string, typeRef: string, ports: Port[]): Node =>
  ({id, kind, typeRef, graphRef:'', graphRefRevision:0, ports});
const link = (id:string, fromNode:string, fromPort:string, toNode:string,
  toPort:string, semantics:Edge['semantics']='data', delayTicks=0): Edge =>
  ({id, fromNode, fromPort, toNode, toPort, semantics, delayTicks});
const graph = (id:string, domain:string, nodes:Node[], edges:Edge[]):Graph =>
  ({schema:'mechanicus.universal-graph/1', id, schemaVersion:1,
    revision:1, domain, interfacePorts:[], nodes, edges});
const value='mas.value@1', spike='neural.spike@1', genome='genome.ref@1';
const tensor='tensor.handle@1', device='runtime.device@1';

export const examples: Record<string,Graph> = {
  selfhost:graph('genesis.selfhost','program',[
    node('original_genome','resource','adamantium.genome.store@1',[
      port('genome','genome.ref@1','output')]),
    node('genesis_n','capability','adamantium.genome.compiler@1',[
      port('genome','genome.ref@1','input'),
      port('graph','graph.ref@1','output')]),
    node('g0_verifier','capability','mechanicus.graph.verify@1',[
      port('graph','graph.ref@1','input'),
      port('receipt','verification.receipt@1','output')]),
    node('signed_catalog','resource','mechanicus.artifact.registry@1',[
      port('catalog','artifact.catalog@1','output')]),
    node('artifact_attest','capability','adamantium.genome.attest@1',[
      port('receipt','verification.receipt@1','input'),
      port('catalog','artifact.catalog@1','input'),
      port('candidate','candidate.ref@1','output')]),
    node('genesis_next','capability','mechanicus.lifecycle.proposal@1',[
      port('candidate','candidate.ref@1','input')])
  ],[
    link('gene.expression','original_genome','genome','genesis_n','genome'),
    link('structural.verification','genesis_n','graph','g0_verifier','graph'),
    link('verification.receipt','g0_verifier','receipt','artifact_attest','receipt'),
    link('artifact.catalog','signed_catalog','catalog','artifact_attest','catalog'),
    link('successor.proposal','artifact_attest','candidate','genesis_next','candidate')
  ]),
  program:graph('mas.program','program',[
    node('loader','capability','mas.source.read@1',[port('data',value,'output')]),
    node('processor','capability','mas.transform@1',[
      port('data',value,'input'),port('result',value,'output')]),
    node('writer','capability','mas.output.write@1',[port('result',value,'input')])
  ],[
    link('stage.one','loader','data','processor','data'),
    link('stage.two','processor','result','writer','result')
  ]),
  genesis:graph('genesis.pipeline','genesis',[
    node('genome','resource','genesis.genome.lookup@1',[port('genome',genome,'output')]),
    node('restore','capability','genesis.weight.restore@1',[
      port('genome',genome,'input'),port('tensor',tensor,'output'),
      port('device',device,'input','route')]),
    node('consumer','capability','genesis.tensor.consume@1',[port('tensor',tensor,'input')]),
    node('cpu','device','hardware.cpu@1',[port('device',device,'output','route')])
  ],[
    link('genome.ref','genome','genome','restore','genome'),
    link('tensor.handle','restore','tensor','consumer','tensor'),
    link('cpu.route','cpu','device','restore','device','route')
  ]),
  brain:graph('dante.brain','neural',[
    node('left','brain-region','neural.region@1',[
      port('signal',spike,'input','signal'),port('signal_out',spike,'output','signal')]),
    node('right','brain-region','neural.region@1',[
      port('signal',spike,'input','signal'),port('signal_out',spike,'output','signal')])
  ],[
    link('forward','left','signal_out','right','signal','signal'),
    link('feedback','right','signal_out','left','signal','signal',1)
  ])
};
