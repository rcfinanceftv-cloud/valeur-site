const {mkdir,writeFile}=require('node:fs/promises');
(async()=>{const token=process.env.TRADEDOUBLER_FEED_TOKEN;if(!token)throw Error('Missing configuration');
const r=await fetch('https://api.tradedoubler.com/1.0/productsUnlimited.json;fid=53631?token='+encodeURIComponent(token),{signal:AbortSignal.timeout(120000)});
if(!r.ok)throw Error('Feed HTTP '+r.status);
const raw=await r.json();let prices=[],invalid=[],found=[],miss=0;
for(const p of raw.products||[]){const o=(p.offers||[]).find(o=>String(o.feedId)==='53631');if(!o){miss++;continue;}
const h=[...(o.priceHistory||[])].sort((a,b)=>Number(b.date)-Number(a.date));let v=h[0]?.price?.value;
if(!Number.isFinite(Number(v))||Number(v)<=0)invalid.push({id:o.sourceProductId,price:v,name:p.name});
else prices.push(Number(v));
if(String(o.sourceProductId)==='51957'||/nabucodonosor/i.test(p.name||''))found.push({name:p.name,id:o.sourceProductId,history:o.priceHistory});}
const report=JSON.stringify({keys:Object.keys(raw),metadata:Object.fromEntries(Object.entries(raw).filter(([k,v])=>k!=='products'&&typeof v!=='object')),total:raw.products?.length,max:Math.max(...prices),over:[1000,2000,5000].map(n=>prices.filter(v=>v>n).length),invalid,missingOffer:miss,found}); await mkdir('dist/data',{recursive:true}); await writeFile('dist/data/feed-audit.json',report);
})().catch(e=>{console.error(e.message);process.exitCode=1});