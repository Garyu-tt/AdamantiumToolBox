import sample from '../samples/genesis.json';
import { mountRete } from './rete_view';
import './style.css';

const viewport = document.querySelector<HTMLElement>('#graph');
const status = document.querySelector<HTMLElement>('#status');
if (!viewport || !status) throw Error('missing_editor_mount');
mountRete(viewport, sample, draft => {
  // No auto-commit: actor authorization and CAS belong to Graph Manager.
  status.textContent='Draft proposal at revision '+
    draft.baseRevision+'. Not executed or persisted.';
}).then(() => {
  status.textContent='Rete.js v2 view: Graph IR revision 1. Drag to explore.';
}).catch(() => {
  status.textContent='Graph validation failed; no editor actions admitted.';
});
