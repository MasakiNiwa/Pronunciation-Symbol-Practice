export function wavBlob(pcm,rate){
 const bytes=new ArrayBuffer(44+pcm.length*2),v=new DataView(bytes);
 const str=(offset,s)=>[...s].forEach((c,i)=>v.setUint8(offset+i,c.charCodeAt(0)));
 str(0,'RIFF');v.setUint32(4,36+pcm.length*2,true);str(8,'WAVE');str(12,'fmt ');
 v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);
 v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,pcm.length*2,true);
 pcm.forEach((x,i)=>v.setInt16(44+i*2,Math.max(-1,Math.min(1,x))*(x<0?32768:32767),true));
 return new Blob([bytes],{type:'audio/wav'});
}
export async function resample(pcm,rate){
 const ctx=new OfflineAudioContext(1,Math.ceil(pcm.length*16000/rate),16000);
 const buffer=ctx.createBuffer(1,pcm.length,rate);buffer.copyToChannel(pcm,0);
 const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);source.start();
 return (await ctx.startRendering()).getChannelData(0);
}
export class Recorder{
 async start(onLevel,onEnded){
  this.chunks=[];this.length=0;this.finished=false;
  try{
   this.context=new AudioContext();await this.context.resume();
   this.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
   if(this.finished){this.stream.getTracks().forEach(t=>t.stop());throw new Error('録音を中止しました。');}
   await this.context.audioWorklet.addModule(new URL('./capture-worklet.js',import.meta.url));
   if(this.finished)throw new Error('録音を中止しました。');
   this.source=this.context.createMediaStreamSource(this.stream);this.node=new AudioWorkletNode(this.context,'pcm-capture');
   this.gain=this.context.createGain();this.gain.gain.value=0;
   this.node.port.onmessage=({data})=>{
    if(this.finished)return;
    this.chunks.push(data);this.length+=data.length;
    onLevel(Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length));
   };
   this.source.connect(this.node).connect(this.gain).connect(this.context.destination);
   this.stream.getTracks().forEach(t=>t.onended=onEnded);this.timer=setTimeout(onEnded,8000);
  }catch(error){await this.dispose();throw error;}
 }
 async stop(){
  this.finished=true;const rate=this.context.sampleRate;await this.dispose();
  const pcm=new Float32Array(this.length);let offset=0;
  for(const chunk of this.chunks){pcm.set(chunk,offset);offset+=chunk.length;}
  this.chunks=[];return {pcm,rate};
 }
 async dispose(){
  clearTimeout(this.timer);this.finished=true;
  this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});
  this.node?.disconnect();this.source?.disconnect();this.gain?.disconnect();
  if(this.context&&this.context.state!=='closed')await this.context.close();
 }
}
