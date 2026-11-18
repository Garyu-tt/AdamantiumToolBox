import {strict as assert} from 'node:assert';
import {layoutRects,snapRect,edgeZone,fitFloating} from '../shell/window_geometry.js';
for(const preset of [2,4,8]){
 const cells=layoutRects(1920,1080,preset);
 assert.equal(cells.length,preset);
 assert.equal(new Set(cells.map(r=>r.x+':'+r.y)).size,preset);
 for(const rect of cells){
  assert(rect.width>0&&rect.height>0);
  assert(rect.x+rect.width<=1920&&rect.y+rect.height<=1080);
 }
 const pixels=cells.reduce((n,r)=>n+r.width*r.height,0);
 assert.equal(pixels,1920*1080);
}
assert.deepEqual(layoutRects(999,777,4,0),[]);
assert.equal(layoutRects(999,777,8,3).length,3);
assert.throws(()=>layoutRects(100,100,3),/invalid_layout/);
assert.deepEqual(snapRect(1000,800,'left'),{x:0,y:0,width:500,height:800});
assert.deepEqual(snapRect(1000,800,'right'),{x:500,y:0,width:500,height:800});
assert.deepEqual(snapRect(1000,800,'bottom-right'),{x:500,y:400,width:500,height:400});
assert.deepEqual(snapRect(1000,800,'max'),{x:0,y:0,width:1000,height:800});
assert.throws(()=>snapRect(1000,800,'unknown'),/invalid_snap/);
assert.equal(edgeZone(5,5,1000,800),'top-left');
assert.equal(edgeZone(500,5,1000,800),'max');
assert.equal(edgeZone(999,500,1000,800),'right');
assert.equal(edgeZone(500,500,1000,800),null);
assert.deepEqual(fitFloating({x:990,y:-20,width:400,height:500},1000,800),
 {x:600,y:0,width:400,height:500});
console.log('WINDOW_GEOMETRY_OK 2/4/8 tiling snapping coordinate constraints');
