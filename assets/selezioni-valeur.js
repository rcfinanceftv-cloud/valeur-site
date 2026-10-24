'use strict';
(() => {
  const grid = document.getElementById('luxury-grid');
  const search = document.getElementById('luxury-search');
  const type = document.getElementById('luxury-category');
  const counter = document.getElementById('luxury-count');
  const empty = document.getElementById('luxury-empty');
  if (!grid || !search || !type || !counter || !empty) return;
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const allowed = value => {
    try {
      const url = new URL(value);
      const destination = new URL(url.searchParams.get('url') || '');
      return url.protocol === 'https:' && url.hostname === 'clk.tradedoubler.com' &&
        url.searchParams.get('p') === '353866' && url.searchParams.get('a') === '3500844' &&
        destination.protocol === 'https:' && destination.hostname === 'www.vinatis.it' ? url.href : '';
    } catch { return ''; }
  };
  const elem = (tag, className, content) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (content) n.textContent = content;
    return n;
  };
  const renderCard = p => {
    const article = elem('article','luxury-card');
    const visual = elem('div','luxury-card-visual');
    const mark = elem('div','luxury-mark',p.category === 'Champagne d’eccezione' ? 'CHAMPAGNE' : p.category === 'Distillati d’eccezione' ? 'COGNAC' : 'GRAND VIN');
    const monogram = elem('span','luxury-visual-monogram',p.category === 'Champagne d’eccezione' ? '15 L' : p.category === 'Distillati d’eccezione' ? 'XO' : '2019');
    visual.append(mark,monogram,elem('span','luxury-visual-maker',p.maker));
    if (p.image) {
      try {
        const i = new URL(p.image);
        const trustedImageHosts = new Set([
          'www.vinatis.it', 'www.vinatis.fr', 'www.vinatis.com', 'www.vinatis.de',
          'www.champagneshop.com', 'www.tannico.it', 'sothebys-md.brightspotcdn.com',
          'www.whiskyshop.com', 'www.theperfectbottle.com'
        ]);
        if (i.protocol === 'https:' && trustedImageHosts.has(i.hostname)) {
          const img = document.createElement('img');
          img.src = i.href;
          img.alt = p.name + ' – fotografia del prodotto';
          img.loading = 'lazy';
          img.decoding = 'async';
          img.referrerPolicy = 'no-referrer';
          img.onerror = () => { img.remove(); visual.classList.remove('has-photo'); };
          visual.append(img);
          visual.classList.add('has-photo');
        }
      } catch {}
    }
    const body = elem('div','luxury-card-body');
    const heading = elem('h2','',p.name);
    const link = allowed(p.affiliateUrl);
    body.append(elem('p','luxury-eyebrow',p.category),heading,
      elem('p','luxury-format',p.format || ''),
      elem('p','luxury-price',Number.isFinite(p.priceEUR) ? '€ ' + new Intl.NumberFormat('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}).format(p.priceEUR) : 'Prezzo su Vinatis'));
    if (p.priceType === 'foreign_reference') body.append(elem('p','luxury-price-origin','Riferimento Vinatis '+p.priceCountry+' · prezzo Italia da verificare'));
    const open = elem('button','luxury-open','Apri scheda');
    open.type = 'button'; open.setAttribute('aria-label','Apri scheda: '+p.name);
    open.onclick = () => {
      let dialog = document.getElementById('valeur-product-detail');
      if (!dialog) { dialog = elem('dialog','luxury-dialog'); dialog.id='valeur-product-detail'; document.body.append(dialog); }
      dialog.replaceChildren();
      const close = elem('button','luxury-close','Chiudi'); close.type='button'; close.onclick=()=>dialog.close();
      const title = elem('h2','',p.name); title.id='valeur-detail-title'; dialog.setAttribute('aria-labelledby',title.id);
      const layout = elem('div','luxury-dialog-layout');
      const imageBox = elem('div','luxury-dialog-image');
      const original = visual.querySelector('img');
      if (original) { const photo=original.cloneNode(true); photo.loading='eager'; imageBox.append(photo); }
      const copy = elem('div','luxury-dialog-copy');
      copy.append(title,elem('p','luxury-tagline',p.tagline),elem('p','luxury-description',p.description),
        elem('p','luxury-meta',[p.region,p.format].filter(Boolean).join(' · ')),
        elem('p','luxury-price',Number.isFinite(p.priceEUR)?'€ '+new Intl.NumberFormat('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}).format(p.priceEUR):'Prezzo su Vinatis'),
        elem('p','luxury-price-origin',p.priceType==='foreign_reference'?'Riferimento Vinatis '+p.priceCountry+' · non è il prezzo per l’Italia':'Prezzo rilevato su Vinatis Italia'),
        elem('p','luxury-availability',p.availabilityNote||'Prezzo e disponibilità finali su Vinatis.'));
      if(link){const order=elem('a','luxury-cta','Ordina su Vinatis ↗');order.href=link;order.target='_blank';order.rel='sponsored noopener noreferrer';copy.append(order);}
      copy.append(elem('p','luxury-price-origin','Link affiliato, senza costi aggiuntivi per te. L’acquisto si completa su Vinatis.'));
      layout.append(imageBox,copy); dialog.append(close,layout); dialog.showModal();
    };
    body.append(open);
    if (link) {
      const cta = elem('a','luxury-cta','Ordina su Vinatis ↗');
      cta.href = link; cta.target = '_blank'; cta.rel = 'sponsored noopener noreferrer';
      cta.setAttribute('aria-label','Ordina su Vinatis: '+p.name);
      body.append(cta);
    }
    article.append(visual,body);
    return article;
  };
  let items = [];
  const update = () => {
    const q = normalize(search.value.trim());
    const selected = type.value;
    const shown = items.filter(p => (!selected || p.category === selected) &&
      normalize([p.name,p.category,p.maker,p.region,p.format].join(' ')).includes(q));
    grid.replaceChildren(...shown.map(renderCard));
    counter.textContent = shown.length + (shown.length === 1 ? ' etichetta selezionata' : ' etichette selezionate');
    empty.hidden = shown.length !== 0;
  };
  search.addEventListener('input',update);
  type.addEventListener('change',update);
  fetch('/data/catalogo.json').then(r => { if (!r.ok) throw Error('feed'); return r.json(); })
    .then(data => {
      if (!data || !Array.isArray(data.products)) throw Error('schema');
      const groups = {"champagne":["84975","84346","73337","65156","81258","85560"],"cremant":["46451","41456","55890","74336","63998","20403"],"bordeaux":["79895","63973","81455","79889","51150","63642"],"cofanetti":["87272","81642","14735","35690","80732","69028"],"mese":["74336","63998","63973","79889","85560","80594"],"offerte":["46451","20403","63642","81455","6554","27809"],"horeca":["74336","63998","63973","81455","16641","80594"]};
      const selectedIds = groups[document.body.dataset.selection] || [];
      items = selectedIds.map(id => data.products.find(p => String(p.id) === id)).filter(Boolean).map(p => {
        const match = p.url.match(/url\(([^)]+)\)$/);
        return {name:p.name,category:p.type,maker:p.brand,region:p.region,format:p.format,
          tagline:p.brand,description:p.description,image:p.image,priceEUR:p.price,priceType:'vinatis_italy',
          availabilityNote:p.available?'Prezzo e disponibilità finali su Vinatis.':'Disponibilità da verificare su Vinatis.',
          affiliateUrl:match?'https://clk.tradedoubler.com/click?p=353866&a=3500844&url='+match[1]:p.url};
      }).filter(p => allowed(p.affiliateUrl));
      [...new Set(items.map(p => p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it')).forEach(c => {
        const option = elem('option','',c); option.value=c;type.append(option);
      });
      update();
    }).catch(() => {
      counter.textContent='Selezione temporaneamente non disponibile';
      empty.hidden=false; empty.textContent='Non è stato possibile caricare le schede. Torna più tardi oppure esplora il catalogo VALEUR.';
    });
})();
