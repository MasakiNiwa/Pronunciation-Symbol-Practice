export function tokenizeIPA(text) {
 const s=text.normalize('NFC').replace(/[\/\[\]ˈˌ.\sːˑ]/gu,'')
 .replace(/ɡ/gu,'g').replace(/ɹ/gu,'r').replace(/ɝ/gu,'ɜr').replace(/ɚ/gu,'ər')
 .replace(/ʤ|d͡ʒ|dʒ/gu,'ʤ').replace(/ʧ|t͡ʃ|tʃ/gu,'ʧ');
 const chars=[...new Intl.Segmenter('en',{granularity:'grapheme'}).segment(s)].map(x=>x.segment),out=[];
 for(let i=0;i<chars.length;i++){
  const pair=chars[i]+(chars[i+1]||'');
  if(['eɪ','aɪ','ɔɪ','aʊ','oʊ','əʊ'].includes(pair)){out.push(pair);i++;}else out.push(chars[i]);
 }
 return out;
}
export function compareIPA(reference,observed){
 const a=tokenizeIPA(reference),b=tokenizeIPA(observed);
 if(!a.length||!b.length)return null;
 const dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
 for(let i=0;i<=a.length;i++)dp[i][0]=i;
 for(let j=0;j<=b.length;j++)dp[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)
 dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]!==b[j-1]));
 const alignment=[];let i=a.length,j=b.length;
 while(i||j){
  if(i&&j&&dp[i][j]===dp[i-1][j-1]+(a[i-1]!==b[j-1])){
   alignment.unshift({expected:a[--i],actual:b[--j],kind:a[i]===b[j]?'match':'substitute'});
  }else if(i&&dp[i][j]===dp[i-1][j]+1)alignment.unshift({expected:a[--i],actual:'—',kind:'missing'});
  else alignment.unshift({expected:'—',actual:b[--j],kind:'extra'});
 }
 return {distance:dp[a.length][b.length],alignment,similarity:Math.round(100*Math.max(0,1-dp[a.length][b.length]/Math.max(a.length,b.length)))};
}
