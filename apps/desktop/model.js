/** Pure LinkFS projection: never invent applications that are missing from the graph. */
export function availableViews(views){
 return new Map(views.filter(v=>v.type==='view'&&v.surface!=='workspace').map(v=>[v.id,v]));
}
export function visibleTree(tree,views){
 const permitted=availableViews(views);
 function visit(items=[]){
  return items.flatMap(item=>{
   if(item.type==='folder'){
    const children=visit(item.children);
    return children.length?[{type:'folder',name:item.name,children}]:[];
   }
   if(item.type!=='app'||!permitted.has(item.view))return [];
   return [{type:'app',name:item.name,view:item.view}];
  });
 }
 return visit(tree?.children);
}
export function flatten(items,prefix=''){
 return items.flatMap(item=>item.type==='folder'
  ?flatten(item.children,prefix+item.name+'/')
  :[{...item,path:prefix+item.name}]);
}
export function findItem(items,view){
 return flatten(items).find(item=>item.view===view)||null;
}
