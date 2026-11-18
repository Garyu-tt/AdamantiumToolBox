import {layoutRects,fitFloating} from './window_geometry.js';
import {axes,ratios,changeRatio,guides} from './window_ratios.js';
import {createSplitters} from './window_splitter.js';
/** Shared splitters compose with the window registry; ratio data stays browser-local. */
export function windowLayouts(desktop,records,position,geometry,focus){
 const key='mas.window.splits.v1';let preferences={},group=null;
 try{
  const saved=JSON.parse(localStorage.getItem(key)||'{}');
  if(saved&&typeof saved==='object'&&!Array.isArray(saved))preferences=saved;
 }catch{}
 const bounds=()=>({width:desktop.clientWidth,height:desktop.clientHeight});
 const save=()=>{if(group)preferences[group.preset]=group.splits;
  try{localStorage.setItem(key,JSON.stringify(preferences));}catch{}};
 const handles=createSplitters(desktop,(axis,index,fraction)=>{
  if(!group||!changeRatio(group.preset,group.splits,axis,index,fraction))return;
  draw();
 },save);
 function reset(item){
  if(item.mode?.kind!=='tile')return;
  item.mode=null;delete item.win.dataset.mode;
  if(item.normal){const {width,height}=bounds();
   position(item,fitFloating(item.normal,width,height));}
 }
 function draw(){
  if(!group){handles.clear();return;}
  group.items=group.items.filter(item=>records.has(item.key));
  if(group.items.length<2){group.items.forEach(reset);group=null;handles.clear();return;}
  const {width,height}=bounds();
  const rects=layoutRects(width,height,group.preset,group.items.length,group.splits);
  group.items.forEach((item,i)=>{
   item.mode={kind:'tile',preset:group.preset,slot:i};
   item.win.dataset.mode='tile';position(item,rects[i]);
  });
  handles.draw(guides(group.preset,width,height,group.splits));
 }
 function leave(item){
  if(!group||!group.items.includes(item))return;
  group.items=group.items.filter(x=>x!==item);
  draw();
 }
 function arrange(preset,selected){
  axes(preset);
  const count=preset==='focus'?3:preset;
  const shown=[...records.values()].filter(x=>!x.win.hidden)
   .sort((a,b)=>Number(b===selected)-Number(a===selected)).slice(0,count);
  if(!shown.length)return 0;
  for(const item of records.values())if(item.mode?.kind==='tile'&&!shown.includes(item))reset(item);
  for(const item of shown)if(!item.mode)item.normal=geometry(item.win);
  group={preset,items:shown,splits:ratios(preset,preferences[preset])};
  draw();focus(shown[0]);return shown.length;
 }
 function close(){
  handles.dispose();group=null;
 }
 return {arrange,leave,reflow:draw,close};
}
