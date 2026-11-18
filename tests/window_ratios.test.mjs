import {strict as assert} from 'node:assert';
import {axes,ratios,changeRatio,guides} from '../shell/window_ratios.js';
import {layoutRects} from '../shell/window_geometry.js';
const scenarios=[2,4,8,'focus'];
for(const preset of scenarios){
 const defaults=axes(preset),state=ratios(preset);
 assert.deepEqual(state,defaults);
 const next=layoutRects(1400,860,preset,undefined,state);
 assert(next.every(r=>r.x>=0&&r.y>=0&&r.width>0&&r.height>0));
 assert.equal(next.reduce((total,r)=>total+r.width*r.height,0),1400*860);
 const edges=guides(preset,1400,860,state);
 assert.equal(edges.length,defaults.xs.length+defaults.ys.length);
 if(defaults.xs.length){
  assert(changeRatio(preset,state,'xs',0,.64));
  assert(state.xs[0]<=1&&state.xs[0]>=.1);
 }
 if(defaults.ys.length)assert(changeRatio(preset,state,'ys',0,.7));
 const resized=layoutRects(1400,860,preset,undefined,state);
 assert.equal(resized.reduce((total,r)=>total+r.width*r.height,0),1400*860);
 assert(!changeRatio(preset,state,'bad',0,.2));
 assert(!changeRatio(preset,state,'xs',50,.2));
}
const custom=ratios(8,{xs:[.2,.55,.8],ys:[.7]});
assert.deepEqual(custom.xs,[.2,.55,.8]);
assert.deepEqual(ratios(8,{xs:[.9,.1,.4]}).xs,[.25,.5,.75]);
assert(changeRatio(8,custom,'xs',1,1));
assert(custom.xs[1]<custom.xs[2]);
assert.equal(guides('focus',1000,600,axes('focus')).at(-1).x,600);
console.log('WINDOW_RATIOS_OK independent fractional guides and complete coverage');
