// Uses the actual CDN, model revision and worker. No microphone or private audio.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
const page=await browser.newPage();
try{
 await page.goto('http://127.0.0.1:8000');
 const result=await page.evaluate(async()=>{
  const worker=new Worker('/src/phoneme-worker.js',{type:'module'});
  return await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{worker.terminate();reject(new Error('Model smoke timeout'));},480000);
   worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(new Error(e.message));};
   worker.onmessage=({data})=>{
    if(data.type==='error'){clearTimeout(timer);worker.terminate();reject(new Error(data.message));}
    if(data.type==='ready'){
     // Artificial tone tests inference plumbing, NOT recognition accuracy.
     const pcm=Float32Array.from({length:16000},(_,i)=>Math.sin(2*Math.PI*440*i/16000)*.1);
     worker.postMessage({type:'transcribe',pcm},[pcm.buffer]);
    }
    if(data.type==='result'){clearTimeout(timer);worker.terminate();resolve({type:typeof data.text});}
   };
   worker.postMessage({type:'load'});
  });
 });
 assert.equal(result.type,'string');
 console.log('PASS: real model initialization and inference (synthetic tone; accuracy not evaluated).');
}finally{await browser.close();}
