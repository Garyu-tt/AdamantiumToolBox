import { examples } from './demo';
import { mountRete } from './rete_view';
import { verifiedShape } from './projection';
import './style.css';

const viewport = document.querySelector<HTMLElement>('#graph');
const status = document.querySelector<HTMLElement>('#status');
const chooser = document.querySelector<HTMLSelectElement>('#scenario');
if (!viewport || !status || !chooser) throw Error('missing_editor_mount');

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
