export default function render(root,state={}) {
 const outer=document.createElement('section');outer.setAttribute('aria-label','Audit Anchor Transport');
 const title=document.createElement('h2');title.textContent='Audit Anchor Transport';outer.append(title);
 const p=document.createElement('p');p.textContent=state?.configured?'Read-only status and delivery planning':'Not configured';outer.append(p);
 const note=document.createElement('small');note.textContent='Audit proof transport only. No network enforcement.';outer.append(note);
 root.replaceChildren(outer);
}
