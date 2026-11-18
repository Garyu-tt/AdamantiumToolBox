import {strict as assert} from 'node:assert';
/** Real Chromium pointer input, not synthetic JS events, verifies saved icon movement. */
export async function dragFolder(evaluate,send,pause){
 const point=await evaluate('(()=>{const b=[...document.querySelectorAll(".ada-canvas>.ada-shortcut")].find(x=>x.textContent.includes("QA Folder"));if(!b)return null;const r=b.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),id:b.dataset.id}})()');
 assert(point,'folder_shortcut_missing');
 send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
 await pause(75);
 send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});
 await pause(75);
 send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+130,y:point.y+105,button:'left',buttons:1});
 await pause(75);
 send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+130,y:point.y+105,button:'left',buttons:0,clickCount:1});
 await pause(130);
 const saved=await evaluate('JSON.parse(localStorage.getItem("mas.desktop.layout.v1")).positions['+JSON.stringify(point.id)+']||null');
 assert(saved&&saved.x>12,'drag_position_not_persisted');
 console.log('DESKTOP_POINTER_OK real pointer drag and shortcut placement saved');
}
