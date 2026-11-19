import {strict as assert} from 'node:assert';
import {chromium} from 'playwright-core';
import {preview} from 'vite';

const server=await preview({
  preview:{host:'127.0.0.1',port:0,strictPort:false},
  logLevel:'silent'
});
const address=server.httpServer.address();
if (!address || typeof address==='string') throw Error('invalid_preview_address');
const base='http://127.0.0.1:'+address.port;
let browser;
try {
  browser=await chromium.launch({
    executablePath:process.env.MAS_CHROME_BIN||'/usr/bin/google-chrome',
    headless:true,args:['--no-sandbox','--disable-gpu']
  });
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    if(!route.request().url().startsWith(base+'/'))
      return route.abort('blockedbyclient');
    return route.continue();
  });
  await page.goto(base+'/',{waitUntil:'networkidle',timeout:20000});
  const scenarios=[
    ['genesis','genesis.pipeline','genesis.weight.restore@1'],
    ['program','mas.program','mas.transform@1'],
    ['brain','dante.brain','neural.region@1']
  ];
  for(const [key,id,label] of scenarios){
    await page.locator('#scenario').selectOption(key);
    await page.waitForFunction(([graphId,typeRef])=>{
      const status=document.querySelector('#status')?.textContent||'';
      const canvas=document.querySelector('#graph')?.textContent||'';
      return status.includes(graphId) && canvas.includes(typeRef);
    },[id,label],{timeout:15000});
    const status=await page.locator('#status').innerText();
    assert.match(status,/read-only authoritative data/);
  }
  assert.deepEqual(errors,[]);
  assert.equal(await page.locator('#graph').count(),1);
  assert.equal(await page.locator('#scenario').inputValue(),'brain');
  console.log('UGRAPH_RETE_BROWSER_OK: MAS/GENESIS/Dante rendered, no runtime calls');
}finally{
  await browser?.close();
  await new Promise((resolve,reject)=>
    server.httpServer.close(error=>error?reject(error):resolve()));
}
