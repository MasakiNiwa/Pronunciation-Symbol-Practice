import test from 'node:test';
import assert from 'node:assert/strict';
import {compareIPA,tokenizeIPA} from '../src/ipa.js';
import {normalizeWord,dictionaryVariants,lookupWord} from '../src/dictionary.js';
import {wavBlob} from '../src/audio.js';
test('notation normalization preserves meaningful distinctions',()=>{
 assert.equal(compareIPA('/ˈɹaɪt/','r aɪ t').similarity,100);
 assert.equal(compareIPA('raɪt','laɪt').distance,1);
 assert.equal(compareIPA('ʃiːp','ʃɪp').distance,1);
 assert.deepEqual(tokenizeIPA('t͡ʃeɪndʒ'),['ʧ','eɪ','n','ʤ']);
 assert.equal(compareIPA('ɚ','ər').distance,0);
});
test('alignment: missing, extra, repeated and empty phonemes',()=>{
 assert.equal(compareIPA('kæt','kt').alignment.filter(x=>x.kind==='missing').length,1);
 assert.equal(compareIPA('kt','kæt').alignment.filter(x=>x.kind==='extra').length,1);
 assert.equal(compareIPA('tt','t').distance,1);
 assert.equal(compareIPA('','a'),null);assert.equal(compareIPA('a',''),null);
});
test('word validation prevents phrase lookup',()=>{
 assert.equal(normalizeWord(' RIGHT '),'right');assert.equal(normalizeWord('don’t'),"don't");
 for(const input of ['two words','<img>','','日本語'])assert.throws(()=>normalizeWord(input));
});
test('dictionary variants, duplicates and absent phonetics',()=>{
 assert.deepEqual(dictionaryVariants([{phonetic:'/a/',phonetics:[{text:'/a/'},{text:'/b/'},{audio:'x'}]},{}]).map(x=>x.ipa),['/a/','/b/']);
});
test('built in vocabulary needs no network',async()=>{
 const original=global.fetch;global.fetch=()=>{throw new Error('network forbidden');};
 try{assert.equal((await lookupWord('right'))[0].ipa,'raɪt');}finally{global.fetch=original;}
});
test('dictionary failures do not manufacture IPA',async()=>{
 const original=global.fetch;
 try{
  global.fetch=async()=>({ok:false,status:404});await assert.rejects(lookupWord('unknown'),/見つかりません/);
  global.fetch=async()=>({ok:true,json:async()=>[{}]});await assert.rejects(lookupWord('unknown'),/未収録/);
 }finally{global.fetch=original;}
});
test('WAV header, rate, clipping and PCM size',async()=>{
 const blob=wavBlob(new Float32Array([-2,0,2]),48000),buffer=await blob.arrayBuffer(),view=new DataView(buffer);
 assert.equal(buffer.byteLength,50);assert.equal(view.getUint32(24,true),48000);
 assert.equal(view.getInt16(44,true),-32768);assert.equal(view.getInt16(48,true),32767);
 assert.equal(new TextDecoder().decode(buffer.slice(0,4)),'RIFF');
});
