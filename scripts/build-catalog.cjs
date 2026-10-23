const fs = require('node:fs/promises');
const path = require('node:path');
const FEED = '53631';
const SCHEMA = 2;
function validate(products) {
 if(!Array.isArray(products)||!products.length)throw Error('Empty catalog');
 const ids=new Set();
 for(const p of products){
  if(!p||!p.id||ids.has(p.id)||!p.name||!p.description||!Number.isFinite(p.price)||p.price<=0||p.currency!=='EUR')throw Error('Incomplete or duplicate catalog record');
  ids.add(p.id);
  const image=new URL(p.image),link=new URL(p.url);
  if(image.protocol!=='https:'||!/^(www\.)?vinatis\.(it|com|fr)$/.test(image.hostname)||link.protocol!=='https:'||!['pdt.tradedoubler.com','clk.tradedoubler.com'].includes(link.hostname)||!decodeURIComponent(link.href).includes(`product(${FEED}-${p.id})`))throw Error('Invalid product image or affiliate link');
 }
 return {maxPrice:Math.max(...products.map(p=>p.price)),above1000:products.filter(p=>p.price>1000).length,above2000:products.filter(p=>p.price>2000).length,above5000:products.filter(p=>p.price>5000).length};
}
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
 if(version&&previous?.feedVersion===version&&previous?.schemaVersion===SCHEMA&&previous?.sourceTotal===previous?.total&&previous?.products?.length===previous?.total){const stats=validate(previous.products);data={...previous,stats,checkedAt:new Date().toISOString()};console.log('Feed unchanged; reusing validated complete catalog');}
 else {
  const r=await fetch('https://api.tradedoubler.com/1.0/productsUnlimited.json'+suffix,{signal:AbortSignal.timeout(120000)});
  if(!r.ok)throw Error('Feed unavailable: HTTP '+r.status);
  const raw=await r.json();if(!Array.isArray(raw.products)||!raw.products.length)throw Error('Complete feed not ready; previous deployment remains live');
  const products=raw.products.map(normalize);
  const stats=validate(products);
  if(previous?.total&&products.length<previous.total*.9)throw Error('Catalog unexpectedly shrank; manual review required');
  if(version){const check=await fetch('https://api.tradedoubler.com/1.0/productsUnlimited/lastUpdated.json'+suffix,{signal:AbortSignal.timeout(45000)});if(!check.ok||(await check.json()).lastUpdatedTime!==version)throw Error('Feed changed during import; retry later');}
  data={schemaVersion:SCHEMA,updatedAt:new Date().toISOString(),checkedAt:new Date().toISOString(),feedVersion:version,feedId:FEED,sourceTotal:raw.products.length,total:products.length,stats,products};
  console.log('Validated '+products.length+' catalog products');
 }
 const out=path.resolve('dist');await fs.mkdir(path.join(out,'data'),{recursive:true});
 for(const name of await fs.readdir('.')){
  if(/\.(html|png|jpg|jpeg|svg|ico|webp|txt|xml|webmanifest)$/.test(name)||['champagne','assets'].includes(name))await fs.cp(name,path.join(out,name),{recursive:true});
 }
 await fs.writeFile(path.join(out,'data/catalogo.json'),JSON.stringify(data));
}
module.exports={normalize,validate,build};if(require.main===module)build().catch(()=>{console.error('Catalog update failed. Check feed availability/configuration; current site is not replaced.');process.exitCode=1});
