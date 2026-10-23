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
    body.append(elem('p','luxury-eyebrow',p.category),heading,elem('p','luxury-tagline',p.tagline),
      elem('p','luxury-description',p.description),elem('p','luxury-meta',[p.region,p.format].filter(Boolean).join(' · ')),
      elem('p','luxury-price',p.priceNote || 'Prezzo su Vinatis'),
      elem('p','luxury-availability',p.availabilityNote || 'Verifica disponibilità sul sito del partner.'));
    if (link) {
      const cta = elem('a','luxury-cta','Verifica su Vinatis ↗');
      cta.href = link; cta.target = '_blank'; cta.rel = 'sponsored noopener noreferrer';
      cta.setAttribute('aria-label','Verifica su Vinatis: '+p.name);
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
  fetch('/assets/grandi-vini-selezione.json').then(r => { if (!r.ok) throw Error('feed'); return r.json(); })
    .then(data => {
      if (!data || !Array.isArray(data.products)) throw Error('schema');
      items = data.products.filter(p => p && p.name && allowed(p.affiliateUrl));
      [...new Set(items.map(p => p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it')).forEach(c => {
        const option = elem('option','',c); option.value=c;type.append(option);
      });
      update();
    }).catch(() => {
      counter.textContent='Selezione temporaneamente non disponibile';
      empty.hidden=false; empty.textContent='Non è stato possibile caricare le schede. Torna più tardi oppure esplora il catalogo VALEUR.';
    });
})();
