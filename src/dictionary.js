// Original broad General American practice transcriptions.
export const examples={right:'raɪt',light:'laɪt',ship:'ʃɪp',sheep:'ʃiːp',think:'θɪŋk',this:'ðɪs',very:'ˈvɛri',berry:'ˈbɛri',cat:'kæt',cut:'kʌt',hello:'həˈloʊ',world:'wɜrld'};
export function normalizeWord(input){
 const word=input.trim().toLowerCase().replace(/[’]/g,"'");
 if(!/^[a-z]+(?:['-][a-z]+)*$/.test(word))throw new Error('英単語を1語入力してください（例: right）。');
 return word;
}
export function dictionaryVariants(entries){
 const result=[];
 for(const entry of entries)for(const p of [...(entry.phonetics||[]),...(entry.phonetic?[{text:entry.phonetic}]:[])])
 if(typeof p.text==='string'&&p.text.trim()&&!result.some(r=>r.ipa===p.text))result.push({ipa:p.text,source:'Free Dictionary API（地域・品詞は出典で確認）'});
 return result;
}
export async function lookupWord(input,{signal}={}){
 const word=normalizeWord(input);
 if(examples[word])return [{ipa:examples[word],source:'内蔵練習データ・米語の広い表記'}];
 const response=await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(word),{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error(response.status===404?'辞書に見つかりません。基準IPAを手入力できます。':'辞書を取得できません。基準IPAを手入力できます。');
 const result=dictionaryVariants(await response.json());
 if(!result.length)throw new Error('発音記号は未収録です。基準IPAを手入力してください。');
 return result;
}
