let recognizer;
self.onmessage=async({data})=>{
 try{
  if(data.type==='load'){
   const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
   env.allowLocalModels=false;
   env.backends.onnx.wasm.numThreads=1;
   recognizer=await pipeline('automatic-speech-recognition','robg/speako-phoneme-recognizer',{
    device:'wasm',dtype:'q8',revision:'ad0f63c',
    progress_callback:p=>self.postMessage({type:'progress',file:p.file,status:p.status,progress:p.progress})
   });
   self.postMessage({type:'ready'});
  }else if(data.type==='transcribe'){
   if(!recognizer)throw new Error('モデルを準備してください。');
   const result=await recognizer(data.pcm);self.postMessage({type:'result',text:result.text});
  }
 }catch(error){self.postMessage({type:'error',message:error.message||String(error)});}
};
