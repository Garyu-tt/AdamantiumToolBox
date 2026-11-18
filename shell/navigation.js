export function drawNavigation(target,tree,available,openApp){
 target.replaceChildren();
 const views=new Map(available.nodes.filter(n=>n.type==='view').map(n=>[n.id,n]));
 function draw(items,container){
  for(const item of items){
   if(item.type==='folder'){
    const details=document.createElement('details');details.className='nav-folder';details.open=true;
    const summary=document.createElement('summary');summary.textContent=item.name;
    details.append(summary);container.append(details);
    const inner=document.createElement('div');inner.className='nav-children';details.append(inner);
    draw(item.children||[],inner);
   }else if(item.type==='app'&&views.has(item.view)){
    const b=document.createElement('button');b.className='app-tile';b.type='button';
    b.textContent=item.name;b.title=item.view;b.onclick=()=>openApp(views.get(item.view));
    container.append(b);
   }
  }
 }
 draw(tree.children||[],target);
}
