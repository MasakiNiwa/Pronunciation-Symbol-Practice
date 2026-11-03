import {compareIPA} from './ipa.js';
import {examples,lookupWord,normalizeWord} from './dictionary.js';
import {Recorder,resample,wavBlob} from './audio.js';
const $=id=>document.getElementById(id);
let micStarting=false;
let mode='ipa',busy=false,ready=false,worker=null,recording=null,recognition=null,url=null,observed='',lookupId=0,dictController=null,recTimer=null,wordJob=0;
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
const micSupported=!!(window.isSecureContext&&navigator.mediaDevices?.getUserMedia&&window.AudioWorkletNode);
function status(message){$('status').textContent=message;}
function controls(){
 $('record').disabled=busy||(mode==='ipa'?(!ready||!micSupported):!SpeechRecognition);
 $('stop').disabled=micStarting||(!recording&&!recognition);
 for(const id of ['ipa-mode','word-mode','word','lookup','variants','reference','speak','locale'])$(id).disabled=busy;
 for(const button of $('examples').children)button.disabled=busy;
 $('load-model').disabled=!!worker;
}
function setBusy(value){busy=value;controls();}
function clearAudio(){
 if(url)URL.revokeObjectURL(url);url=null;
 $('playback').pause();$('playback').removeAttribute('src');$('playback').load();
 $('playback').hidden=true;$('clear-audio').hidden=true;
}
function clearResult(){
 observed='';$('observed').textContent='—';$('result-note').textContent='ここにあなたの音が表示されます。';renderComparison();
}
function renderComparison(){
 const host=$('alignment');host.replaceChildren();
 const result=mode==='ipa'?compareIPA($('reference').value,observed):null;
 $('reference-display').textContent='/'+$('reference').value.replace(/^\//,'').replace(/\/$/,'')+'/';
 $('similarity').textContent=result?'記号の一致度 '+result.similarity+'%':'比較待ち';
 if(!result){
  const p=document.createElement('p');
  p.textContent=mode==='word'?'単語認識では発音を採点しません。音声 → IPA モードで比較できます。':'音声からIPAを推定すると、音ごとの比較が表示されます。';
  host.append(p);return;
 }
 for(const item of result.alignment){
  const chip=document.createElement('div');chip.className='sound '+item.kind;
  const names={match:'一致',substitute:'置換',missing:'欠落',extra:'追加'};
  chip.title=names[item.kind];
  const expected=document.createElement('span'),arrow=document.createElement('small'),actual=document.createElement('span'),label=document.createElement('small');
  expected.textContent=item.expected;arrow.textContent='↓';actual.textContent=item.actual;label.textContent=names[item.kind];
  chip.append(expected,arrow,actual,label);host.append(chip);
 }
}
async function loadReference(){
 const id=++lookupId;dictController?.abort();dictController=new AbortController();
 clearResult();clearAudio();$('reference').value='';$('variants').replaceChildren();$('source').textContent='';renderComparison();
 $('dict-status').textContent='辞書を確認中…';
 try{
  const word=normalizeWord($('word').value);$('word').value=word;
  const variants=await lookupWord(word,{signal:dictController.signal});
  if(id!==lookupId)return;
  for(const p of variants){const option=new Option(p.ipa,p.ipa);option.dataset.source=p.source;$('variants').add(option);}
  $('reference').value=variants[0].ipa;$('source').textContent=variants[0].source;
  $('dict-status').textContent='基準IPAを準備しました。';renderComparison();
 }catch(error){
  if(id===lookupId){$('dict-status').textContent=error.message;$('source').textContent='基準IPAを手入力して実験を続けられます。';}
 }
}
function changeMode(next){
 if(busy)return;
 mode=next;clearResult();clearAudio();
 $('ipa-mode').setAttribute('aria-pressed',String(mode==='ipa'));
 $('word-mode').setAttribute('aria-pressed',String(mode==='word'));
 $('ipa-panel').hidden=mode!=='ipa';$('word-panel').hidden=mode!=='word';
 $('result-label').textContent=mode==='ipa'?'YOUR SOUND / 音声から推定したIPA':'RECOGNIZED WORD / 認識された単語';
 $('record').textContent=mode==='ipa'?'● 録音してみる':'● 単語を認識する';
 status(mode==='ipa'?(micSupported?'モデルを準備すると録音できます。1語ずつ、最大8秒。':'この環境は録音に非対応です。HTTPSと対応ブラウザをご確認ください。'):(SpeechRecognition?'開始するとブラウザの音声認識を利用します。':'このブラウザは単語認識に非対応です。音声 → IPA をお試しください。'));
 if(ready&&mode==='ipa')status('準備できました。1語ずつ、最大8秒で録音してみましょう。');
 controls();renderComparison();
}
function releaseModel(){
 const keepBusy=mode==='word'&&busy;
 worker?.terminate();worker=null;ready=false;recording?.dispose();recording=null;micStarting=false;
 $('cancel-model').hidden=true;$('model-status').textContent='モデルを解放しました。キャッシュはブラウザ設定から消去できます。';
 setBusy(keepBusy);if(mode==='ipa')status('再び準備するか、ブラウザ標準の単語認識を試せます。');
}
function startModel(){
 if(worker)return;
 $('model-status').textContent='ライブラリとモデルを準備中… 初回は数分かかる場合があります。';
 $('cancel-model').hidden=false;
 try{
  worker=new Worker(new URL('./phoneme-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
   if(data.type==='progress'){
    $('model-status').textContent=(data.file||'モデル')+' · '+(Number.isFinite(data.progress)?Math.round(data.progress)+'%':data.status||'準備中');
   }else if(data.type==='ready'){
    ready=true;$('model-status').textContent='モデル準備完了 · 音声は端末内で処理';controls();
    if(mode==='ipa')status('準備できました。1語を録音してみましょう。');
   }else if(data.type==='result'){
    observed=data.text?.trim()||'';$('observed').textContent=observed?'['+observed+']':'—';
    $('result-note').textContent=observed?'音声モデルの推定です。誤認識や表記差も含みます。':'音素を認識できませんでした。静かな場所でもう一度お試しください。';
    setBusy(false);renderComparison();status('解析が終わりました。録音を聞き直して比べられます。');
   }else if(data.type==='error')failModel(data.message);
  };
  worker.onerror=()=>failModel('ライブラリ・モデルを読み込めませんでした。通信状況、空きメモリ、対応ブラウザをご確認ください。');
  worker.postMessage({type:'load'});controls();
 }catch(error){failModel(error.message);}
}
function failModel(message){
 releaseModel();$('model-status').textContent='処理に失敗: '+message;if(mode==='ipa')status('モデルを再準備して試せます。録音がある場合は再生できます。');
}
function microphoneError(error){
 const messages={NotAllowedError:'マイクの許可が必要です。ブラウザのサイト設定から許可してください。',NotFoundError:'マイクが見つかりません。',NotReadableError:'マイクを使用できません。他のアプリの利用状況をご確認ください。'};
 return messages[error.name]||'録音できませんでした: '+error.message;
}
async function startRecording(){
 if(busy||!ready)return;
 window.speechSynthesis?.cancel();clearResult();clearAudio();setBusy(true);
 const instance=new Recorder();recording=instance;micStarting=true;status('マイクを準備中…');controls();
 try{
  await instance.start(level=>{$('level').value=level;},()=>stopRecording());
  if(recording!==instance){await instance.dispose();return;}
  micStarting=false;status('録音中… 単語を1つ話して停止してください（最大8秒）。');controls();
 }catch(error){if(recording!==instance)return;recording=null;micStarting=false;setBusy(false);status(microphoneError(error));}
}
async function stopRecording(){
 if(!recording)return;
 const instance=recording,activeWorker=worker;recording=null;controls();status('音声を解析中…');
 try{
  const {pcm,rate}=await instance.stop();
  if(worker!==activeWorker)return;
  $('level').value=0;
  if(pcm.length/rate<0.25)throw new Error('録音が短すぎます。もう一度お試しください。');
  const rms=Math.sqrt(pcm.reduce((s,x)=>s+x*x,0)/pcm.length);
  if(rms<0.003)throw new Error('音声が小さいか、無音でした。マイクに近づいてお試しください。');
  clearAudio();url=URL.createObjectURL(wavBlob(pcm,rate));$('playback').src=url;$('playback').hidden=false;$('clear-audio').hidden=false;
  const samples=await resample(pcm,rate);
  if(worker!==activeWorker)return;
  worker.postMessage({type:'transcribe',pcm:samples},[samples.buffer]);
 }catch(error){setBusy(false);status(error.message);}
}
function startWordRecognition(){
 if(busy||!SpeechRecognition)return;
 window.speechSynthesis?.cancel();clearResult();clearAudio();setBusy(true);
 const job=++wordJob;
 const sr=new SpeechRecognition();recognition=sr;let gotResult=false;let failure=false;
 sr.lang=$('locale').value;sr.interimResults=false;sr.continuous=false;sr.maxAlternatives=1;
 sr.onstart=()=>{status('単語を話してください（音声はブラウザ提供元へ送られる場合があります）。');controls();};
 sr.onresult=async event=>{
  if(job!==wordJob)return;
  gotResult=true;const text=event.results[0][0].transcript.trim();
  $('observed').textContent=text;$('result-note').textContent='認識された単語の辞書IPAを確認中…';status('辞書IPAを確認中…');
  try{
   const variants=await lookupWord(text.replace(/[.,!?]+$/,''));
   if(job!==wordJob)return;
   $('result-note').textContent='認識単語の辞書IPA: '+variants.map(v=>v.ipa).join(' / ')+'（実測IPAではありません）';
   status('単語を認識しました。これは発音の正誤判定ではありません。');
  }catch(error){if(job===wordJob){$('result-note').textContent='辞書IPA: '+error.message;status('単語認識が終わりました。');}}
  finally{if(job===wordJob)setBusy(false);}
 };
 sr.onerror=event=>{failure=true;status('単語認識エラー: '+({ 'not-allowed':'マイクの使用を許可してください。',network:'認識サービスへ接続できません。','no-speech':'音声を検出できませんでした。'}[event.error]||event.error));};
 sr.onend=()=>{
  clearTimeout(recTimer);recognition=null;
  if(!gotResult){setBusy(false);if(!failure)status('認識結果がありません。もう一度お試しください。');}
  controls();
 };
 try{sr.start();recTimer=setTimeout(()=>sr.stop(),8000);controls();}
 catch(error){recognition=null;setBusy(false);status(error.message);}
}
$('word-form').addEventListener('submit',e=>{e.preventDefault();loadReference();});
for(const word of Object.keys(examples)){
 const button=document.createElement('button');button.type='button';button.textContent=word;
 button.onclick=()=>{$('word').value=word;loadReference();};$('examples').append(button);
}
$('variants').onchange=()=>{$('reference').value=$('variants').value;$('source').textContent=$('variants').selectedOptions[0]?.dataset.source||'';renderComparison();};
$('reference').oninput=()=>{$('source').textContent='手入力・編集した基準IPA';renderComparison();};
// Changing the word invalidates the old reference, including an in-flight dictionary response.
$('word').oninput=()=>{++lookupId;dictController?.abort();$('reference').value='';$('variants').replaceChildren();$('source').textContent='単語を変更しました。「調べる」で基準を更新してください。';clearResult();clearAudio();};
$('ipa-mode').onclick=()=>changeMode('ipa');$('word-mode').onclick=()=>changeMode('word');
$('load-model').onclick=startModel;$('cancel-model').onclick=releaseModel;
$('record').onclick=()=>mode==='ipa'?startRecording():startWordRecognition();
$('stop').onclick=()=>{if(recording)stopRecording();if(recognition){status('認識を終了中…');recognition.stop();}};
$('clear-audio').onclick=clearAudio;
$('speak').onclick=()=>{
 try{
  const word=normalizeWord($('word').value);
  if(!window.speechSynthesis){status('このブラウザは読み上げに非対応です。');return;}
  speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(word);utterance.lang=$('locale').value;utterance.rate=0.8;
  utterance.onerror=()=>status('読み上げできませんでした。端末の英語音声設定をご確認ください。');
  speechSynthesis.speak(utterance);
 }catch(error){status(error.message);}
};
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){if(recording)stopRecording();recognition?.stop();window.speechSynthesis?.cancel();}
});
window.addEventListener('pagehide',()=>{recording?.dispose();recognition?.abort();worker?.terminate();clearAudio();});
loadReference();changeMode('ipa');
