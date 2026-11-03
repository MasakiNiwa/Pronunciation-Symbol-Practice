// npm install --no-save playwright; npx playwright install chromium
// Start npm start in another terminal, then node tests/browser.mjs
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1280,height:1000}});
await context.addInitScript(()=>{
 window.__stopped=0;window.__inferred=0;
 class FakeWorker{
  postMessage(data){
   if(data.type==='load')setTimeout(()=>this.onmessage?.({data:{type:'ready'}}),20);
   if(data.type==='transcribe'){
    if(!(data.pcm instanceof Float32Array)||data.pcm.length<4000)throw new Error('Invalid PCM input');
    window.__inferred++;setTimeout(()=>this.onmessage?.({data:{type:'result',text:'l aɪ t'}}),20);
   }
  }
  terminate(){}
 }
 window.Worker=FakeWorker;
 navigator.mediaDevices.getUserMedia=async()=>{
  const c=new AudioContext(),osc=c.createOscillator(),dest=c.createMediaStreamDestination();
  osc.connect(dest);osc.start();await c.resume();
  for(const track of dest.stream.getTracks()){
   const original=track.stop.bind(track);
   track.stop=()=>{window.__stopped++;osc.stop();c.close();original();};
  }
  return dest.stream;
 };
 class FakeRecognition{
  start(){this.onstart?.();setTimeout(()=>{
   this.onresult?.({results:[[{transcript:'right'}]]});this.onend?.();
  },20);}
  stop(){this.onend?.();}abort(){}
 }
 window.SpeechRecognition=FakeRecognition;
});
const page=await context.newPage(),errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>requests.push(r.url()));
try{
 await page.goto('http://127.0.0.1:8000');
 await page.locator('#source').filter({hasText:'内蔵'}).waitFor();
 assert.equal(await page.locator('#record').isDisabled(),true);
 await page.locator('#load-model').click();
 await page.waitForFunction(()=>!document.querySelector('#record').disabled);
 await page.locator('#record').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('録音中'));
 await page.waitForTimeout(600);
 await page.locator('#stop').click();
 await page.waitForFunction(()=>document.querySelector('#observed').textContent==='[l aɪ t]');
 assert.equal(await page.locator('.substitute').count(),1);
 assert.equal(await page.locator('#similarity').textContent(),'記号の一致度 67%');
 assert.equal(await page.evaluate(()=>window.__stopped),1);
 assert.equal(await page.evaluate(()=>window.__inferred),1);
 await page.locator('#clear-audio').click();
 assert.equal(await page.locator('#playback').isHidden(),true);
 await page.locator('#word-mode').click();
 await page.locator('#record').click();
 await page.waitForFunction(()=>document.querySelector('#result-note').textContent.includes('実測IPAではありません'));
 assert.equal(await page.locator('#observed').textContent(),'right');
 assert.equal(await page.locator('.sound').count(),0);
 await page.locator('#word').fill('different');
 assert.equal(await page.locator('#reference').inputValue(),'');
 await page.locator('#word').fill('two words');
 await page.locator('#lookup').click();
 await page.locator('#dict-status').filter({hasText:'1語'}).waitFor();
 await page.locator('#ipa-mode').click();
 await page.getByRole('button',{name:'right',exact:true}).click();
 await page.locator('#reference').fill('raɪt');
 await page.screenshot({path:'/tmp/pronunciation-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'/tmp/pronunciation-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('#cancel-model').click();
 assert.equal(await page.locator('#record').isDisabled(),true);
 assert.deepEqual(errors,[]);
 assert.equal(requests.some(u=>!u.startsWith('http://127.0.0.1')&&!u.startsWith('blob:')),false);
 console.log('PASS: capture/worklet, PCM inference boundary (mock model), alignment, recognition labels, clearing, validation, model release, responsive layout, no audio upload.');
}finally{await browser.close();}
