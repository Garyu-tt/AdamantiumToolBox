import { ClassicPreset, NodeEditor, type GetSchemes } from 'rete';
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin';
import { ConnectionPlugin, Presets as ConnPresets } from 'rete-connection-plugin';
import { ReactArea2D, ReactPlugin, Presets } from 'rete-react-plugin';
import { createRoot } from 'react-dom/client';
import { proposeEdge, verifiedShape } from './projection';
import type { DraftProposal, Edge, Graph, Port } from './types';

type Schemes = GetSchemes<
  ClassicPreset.Node,
  ClassicPreset.Connection<ClassicPreset.Node, ClassicPreset.Node>>;
type AreaExtra = ReactArea2D<Schemes>;
export type GraphProposal = (draft: DraftProposal) => void | Promise<void>;

// Rete visual state is disposable; no JS execution engine or MAS invocation.
export async function mountRete(
  container: HTMLElement, input: unknown, onProposal?: GraphProposal
) {
  const graph: Graph = verifiedShape(input);
  const editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, AreaExtra>(container);
  const render = new ReactPlugin<Schemes, AreaExtra>({ createRoot });
  const connections = new ConnectionPlugin<Schemes, AreaExtra>();
  const socketTypes = new Map<string, ClassicPreset.Socket>();
  const viewNodes = new Map<string, ClassicPreset.Node>();
  let loading = true, seq = 0;

  editor.addPipe(ctx => {
    if (loading) return ctx;
    if (ctx.type === 'connectioncreate') {
      const conn = ctx.data;
      const from = graph.nodes.find(n => n.id === conn.source);
      const port = from?.ports.find(p => p.id === conn.sourceOutput);
      if (port && onProposal) {
        const edge: Edge = {id:'proposal.edge.'+(++seq),
          fromNode:conn.source, fromPort:conn.sourceOutput,
          toNode:conn.target, toPort:conn.targetInput,
          semantics:port.semantics, delayTicks:0};
        try {
          const draft = proposeEdge(graph, edge);
          void Promise.resolve(onProposal(draft)).catch(() => {});
        } catch { /* Host must reject bad proposals; do not mutate preview. */ }
      }
      return undefined; // never persist editor-created edges locally
    }
    if (ctx.type === 'connectionremove' ||
        ctx.type === 'nodecreate' || ctx.type === 'noderemove') return undefined;
    return ctx;
  });
  render.addPreset(Presets.classic.setup());
  connections.addPreset(ConnPresets.classic.setup());
  editor.use(area);
  area.use(render);
  area.use(connections);

  const socket = (p: Port) => {
    const key = p.dataType+':'+p.semantics;
    const known = socketTypes.get(key);
    if (known) return known;
    const added = new ClassicPreset.Socket(key);
    socketTypes.set(key,added);
    return added;
  };
  for (const [i, item] of graph.nodes.entries()) {
    const name = item.typeRef || item.graphRef || item.id;
    const node = new ClassicPreset.Node(name);
    node.id = item.id; // stable IR identity, never Rete-generated authority
    for (const port of item.ports) {
      if (port.direction === 'input')
        node.addInput(port.id,new ClassicPreset.Input(socket(port),port.id));
      else node.addOutput(port.id,new ClassicPreset.Output(socket(port),port.id));
    }
    viewNodes.set(item.id,node);
    await editor.addNode(node);
    await area.translate(node.id,{x:(i%5)*290,y:Math.floor(i/5)*205});
  }
  for (const edge of graph.edges) {
    const from = viewNodes.get(edge.fromNode), to = viewNodes.get(edge.toNode);
    if (!from || !to) throw Error('invalid_editor_edge_endpoint');
    const conn = new ClassicPreset.Connection(from,edge.fromPort,to,edge.toPort);
    conn.id = edge.id;
    await editor.addConnection(conn);
  }
  loading = false;
  await AreaExtensions.zoomAt(area, editor.getNodes());
  return {destroy:()=>area.destroy(), graphId:graph.id,
          revision:graph.revision, executable:false as const};
}
