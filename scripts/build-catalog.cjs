const fs = require('node:fs/promises');
const path = require('node:path');
const FEED = '53631';
function normalize(p) {
 const f=Object.fromEntries((p.fields||[]).map(x=>[x.name,x.value]));
 const o=(p.offers||[]).find(x=>String(x.feedId)===FEED);if(!o)return null;
 const history=[...(o.priceHistory||[])].sort((a,b)=>Number(b.date)-Number(a.date));
 const price=Number(history[0]?.price?.value);if(!Number.isFinite(price)||price<=0||!o.sourceProductId)return null;
 const url=o.productUrl;try{const u=new URL(url);if(u.protocol!=='https:'||!['pdt.tradedoubler.com','clk.tradedoubler.com'].includes(u.hostname))return null;}catch{return null;}
 const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 const raw=clean(f.beverage_type);const color=clean(f.wine_color);
 let type=raw||'Altro';
 if(raw.toLowerCase().includes('champagne'))type='Champagne';
 else if(raw==='Vini')type=({Rosso:'Vini rossi',Bianco:'Vini bianchi',Rosato:'Vini rosati'})[color]||'Vini';
 return {id:String(o.sourceProductId),name:clean(p.name),description:clean(p.description),brand:clean(p.brand),type,country:clean(f.beverage_country),region:clean(f.beverage_region),appellation:clean(f.wine_appellation),format:clean(f.bottle_capacity),price,currency:history[0]?.price?.currency||'EUR',available:o.availability==='in stock'||Number(o.inStock)>0,url,image:p.productImage?.url||'',modified:o.modified||null};
}
async function build() {
 const token=process.env.TRADEDOUBLER_FEED_TOKEN;if(!token)throw Error('Missing server-side feed configuration');
 const suffix=`;fid=${FEED}?token=${encodeURIComponent(token)}`;
 let version=null;
 try{const r=await fetch('https://api.tradedoubler.com/1.0/productsUnlimited/lastUpdated.json'+suffix,{signal:AbortSignal.timeout(45000)});if(r.ok)version=(await r.json()).lastUpdatedTime||null;}catch{}
 let previous=null;
 try{const r=await fetch('https://www.valeuritalia.it/data/catalogo.json',{signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache'}});if(r.ok)previous=await r.json();}catch{}
 let data;
 if(version&&previous?.feedVersion===version&&previous?.products?.length>0){data={...previous,checkedAt:new Date().toISOString()};console.log('Feed unchanged; reusing complete catalog');}
 else {
  const r=await fetch('https://api.tradedoubler.com/1.0/productsUnlimited.json'+suffix,{signal:AbortSignal.timeout(120000)});
  if(!r.ok)throw Error('Feed unavailable: HTTP '+r.status);
  const raw=await r.json();if(!Array.isArray(raw.products)||!raw.products.length)throw Error('Complete feed not ready; previous deployment remains live');
  const products=[...new Map(raw.products.map(normalize).filter(Boolean).map(p=>[p.id,p])).values()];
  if(products.length<raw.products.length*.95)throw Error('Feed validation failed: too many incomplete records');
  data={updatedAt:new Date().toISOString(),checkedAt:new Date().toISOString(),feedVersion:version,feedId:FEED,total:products.length,products};
  console.log('Validated '+products.length+' catalog products');
 }
 const out=path.resolve('dist');await fs.mkdir(path.join(out,'data'),{recursive:true});
 for(const name of await fs.readdir('.')){
  if(/\.(html|png|jpg|jpeg|svg|ico|webp|txt|xml)$/.test(name)||['champagne','assets'].includes(name))await fs.cp(name,path.join(out,name),{recursive:true});
 }
 await fs.writeFile(path.join(out,'data/catalogo.json'),JSON.stringify(data));
}
module.exports={normalize};if(require.main===module)build().catch(()=>{console.error('Catalog update failed. Check feed availability/configuration; current site is not replaced.');process.exitCode=1});
