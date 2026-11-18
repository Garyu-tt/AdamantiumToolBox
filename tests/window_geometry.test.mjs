import {strict as assert} from 'node:assert';
import settings from '../shell/window-layouts.js';
import {dragPosition,snapTarget,snapBounds,tileBounds,restoreBounds} from '../shell/window_geometry.js';
const start={left:60,top:40,width:500,height:330,x:310,y:90};
const area={left:216,top:42,width:1100,height:700};
const moved=dragPosition(start,{x:400,y:142},area);
assert.equal(moved.left,150);assert.equal(moved.top,92);
assert.equal(dragPosition(start,{x:310,y:90},area).top,40);
assert.equal(dragPosition(start,{x:-5000,y:-5000},area).top,0);
assert.equal(snapTarget({x:218,y:330},area,settings.snapThresholdPx),'left');
assert.equal(snapTarget({x:1300,y:330},area,settings.snapThresholdPx),'right');
assert.equal(snapTarget({x:500,y:43},area,settings.snapThresholdPx),'maximize');
assert.equal(snapTarget({x:220,y:44},area,settings.snapThresholdPx),'top-left');
assert.equal(snapTarget({x:220,y:739},area,settings.snapThresholdPx),'bottom-left');
assert.equal(snapTarget({x:150,y:500},area,settings.snapThresholdPx),null);
assert.equal(snapBounds('maximize',1100,700).height,700);
assert.equal(restoreBounds({left:900,top:800,width:500,height:330},area).top,370);
for(const layout of settings.layouts){
 for(let n=1;n<=settings.maxTiled;n++){
  const boxes=tileBounds(n,layout.id,area,settings.ratio.default,settings);
  assert.equal(boxes.length,n,layout.id);
  for(let i=0;i<n;i++){
   const b=boxes[i];assert(b.width>0&&b.height>0&&b.left>=0&&b.top>=0,layout.id);
   assert(b.left+b.width<=area.width&&b.top+b.height<=area.height,layout.id);
   for(let j=0;j<i;j++){
    const other=boxes[j];
    assert(b.left>=other.left+other.width||other.left>=b.left+b.width||
     b.top>=other.top+other.height||other.top>=b.top+b.height,
     layout.id+' windows overlap');
   }
  }
 }
}
const narrow=tileBounds(3,'main-left',area,0.25,settings);
const wide=tileBounds(3,'main-left',area,0.75,settings);
assert(wide[0].width>narrow[0].width*2);
const eight=tileBounds(8,'grid',area,0.62,settings);
assert(eight.every(b=>b.width>240&&b.height>300));
console.log('WINDOW_GEOMETRY_OK viewport-offset drag, snap zones, presets and eight-tile gaps');
