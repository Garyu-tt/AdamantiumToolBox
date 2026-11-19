import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../../../standards/universal-graph/graph-ir-v1.schema.json';
import type { DraftProposal, Edge, Graph } from './types';

const ajv = new Ajv2020({ allErrors: false, strict: true });
const valid = ajv.compile(schema);

export function verifiedShape(input: unknown): Graph {
  if (!valid(input)) throw Error('universal_graph_schema_rejected');
  const graph = structuredClone(input) as Graph;
  if (graph.nodes.length > 4096 || graph.edges.length > 8192)
    throw Error('editor_projection_budget');
  return graph;
}

// Candidate edits are never permission grants or executable commands.
// The Graph Manager must validate structure, actor and revision on commit.
export function proposeEdge(graph: Graph, edge: Edge): DraftProposal {
  const source = graph.nodes.find(n => n.id === edge.fromNode);
  const target = graph.nodes.find(n => n.id === edge.toNode);
  const from = source?.ports.find(p => p.id === edge.fromPort);
  const to = target?.ports.find(p => p.id === edge.toPort);
  if (!from || !to || from.direction !== 'output' ||
      to.direction !== 'input' || from.semantics !== edge.semantics ||
      to.semantics !== edge.semantics || from.dataType !== to.dataType)
    throw Error('incompatible_typed_ports');
  const next = verifiedShape({...graph,edges:[...graph.edges,edge]});
  return {baseRevision:graph.revision, proposedGraph:next,
          authorized:false,executable:false};
}
