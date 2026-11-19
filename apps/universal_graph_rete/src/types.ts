export type Port = {
  id: string; dataType: string; direction: 'input' | 'output';
  semantics: 'data' | 'control' | 'event' | 'signal' |
    'dependency' | 'permission' | 'route';
};
export type Node = {
  id: string; kind: string; typeRef: string;
  graphRef: string; graphRefRevision: number; ports: Port[];
};
export type Edge = {
  id: string; fromNode: string; fromPort: string;
  toNode: string; toPort: string; semantics: Port['semantics'];
  delayTicks: number;
};
export type Graph = {
  schema: 'mechanicus.universal-graph/1';
  id: string; schemaVersion: 1; revision: number;
  domain: string; interfacePorts: Port[];
  nodes: Node[]; edges: Edge[];
};
export type DraftProposal = {
  baseRevision: number;
  proposedGraph: Graph;
  authorized: false;
  executable: false;
};
