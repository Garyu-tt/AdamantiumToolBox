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
