import { examples } from './demo';
import { mountRete } from './rete_view';
import { verifiedShape } from './projection';
import './style.css';

function requiredElement<T extends Element>(selector:string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw Error('missing_editor_mount: '+selector);
  return element;
}
const viewport = requiredElement<HTMLElement>('#graph');
const status = requiredElement<HTMLElement>('#status');
const chooser = requiredElement<HTMLSelectElement>('#scenario');

let current: {destroy():void} | null = null;
let transition = Promise.resolve();
function selectScenario(name:string) {
  transition = transition.then(async () => {
    current?.destroy();
    current = null;
    viewport.replaceChildren();
    const chosen = examples[name];
    if (!chosen) throw Error('unknown_graph_scenario');
    const graph = verifiedShape(chosen);
    const mounted = await mountRete(viewport, graph, draft => {
      // This emits only a proposal; Graph Manager alone may authorize/commit.
      status.textContent = 'DRAFT proposal based on revision '+
        draft.baseRevision+' — not executed or saved.';
    });
    current = mounted;
    status.textContent = graph.id+' · '+graph.nodes.length+' nodes · '+
      graph.edges.length+' typed edges · read-only authoritative data';
  }).catch(() => {
    status.textContent='Graph rejected. No execution or write attempted.';
  });
}
chooser.addEventListener('change', () => selectScenario(chooser.value));
selectScenario(chooser.value);
window.addEventListener('pagehide',()=>current?.destroy(),{once:true});
