/* ═══════════════════════════════════════════════════════════
   HERO SHOWCASE — Albexia  (à coller dans js/app.js,
   par ex. juste après renderHome())
   Construit les compositions du hero avec les VRAIES données
   Firestore (state.tools) : sélection, comparateur, fiche.
   ═══════════════════════════════════════════════════════════ */

(function () {
  const MAX_COMPS   = 3;   // nombre de compositions dans le carrousel
  const ROTATE_MS   = 6000;
  let   _scTimer    = null;
  let   _scIndex    = 0;

  const PRICE_LABEL = {
    fr: { free: 'Gratuit', freemium: 'Freemium', paid: 'Payant' },
    en: { free: 'Free',    freemium: 'Freemium', paid: 'Paid'    },
    es: { free: 'Gratis',  freemium: 'Freemium', paid: 'De pago' },
  };

  function scLogo(t) {
    if (t.favicon) {
      return `<span class="sc-logo"><img src="${t.favicon}" alt="" loading="lazy"
        onerror="this.parentNode.textContent='${(t.emoji || '✨').replace(/'/g, '')}'"></span>`;
    }
    return `<span class="sc-logo">${t.emoji || '✨'}</span>`;
  }

  function scPrice(t, lang) {
    const labels = PRICE_LABEL[lang] || PRICE_LABEL.fr;
    return `<span class="price-tag price-${t.price || 'freemium'}">${labels[t.price] || labels.freemium}</span>`;
  }

  // Carte arrière : 4 outils (logo, nom, catégorie, prix)
  function scBackCard(tools, lang) {
    return `
      <div class="showcase-card sc-back">
        <div class="sc-head">
          <span class="sc-title">${t('home.showcaseSelection', lang)}</span>
          <span class="sc-count">${tools.length} ${t('idx.toolsCountSuffix', lang)}</span>
        </div>
        ${tools.map(t => `
          <div class="sc-row">
            ${scLogo(t)}
            <div class="sc-row-txt"><b>${t.name}</b><small>${catLabel(t.category, lang)}</small></div>
            ${scPrice(t, lang)}
          </div>`).join('')}
      </div>`;
  }

  // Carte centrale : comparateur 2 outils (VS + prix + note + barres)
  function scCenterCard(a, b, ratings, lang) {
    const ra = ratings.get(slugify(a.name)) || {};
    const rb = ratings.get(slugify(b.name)) || {};
    const fmt = r => (r.ratingCount
      ? `★ ${r.ratingAverage.toFixed(1)}`
      : `<span style="color:var(--sh-muted);font-weight:400">—</span>`);
    return `
      <div class="showcase-card sc-center">
        <div class="sc-head">
          <span class="sc-title">${t('home.showcaseCompare', lang)}</span>
          <span class="sc-vs">VS</span>
        </div>
        <div class="sc-duel">
          <div class="sc-duel-side">${scLogo(a)}<b>${a.name}</b>${scPrice(a, lang)}<span class="sc-note">${fmt(ra)}</span></div>
          <span class="sc-duel-vs">⚖</span>
          <div class="sc-duel-side">${scLogo(b)}<b>${b.name}</b>${scPrice(b, lang)}<span class="sc-note">${fmt(rb)}</span></div>
        </div>
        <div class="sc-bar"><i style="width:${ra.ratingCount ? 40 + ra.ratingAverage * 12 : 45}%"></i></div>
        <div class="sc-bar"><i class="alt" style="width:${rb.ratingCount ? 40 + rb.ratingAverage * 12 : 55}%"></i></div>
        <small class="sc-foot-note">${t('home.showcaseCompareSub', lang)}</small>
      </div>`;
  }

  // Carte avant : fiche détaillée (cliquable → vraie page de l'outil)
  function scFrontCard(tool, ratings, lang) {
    const r    = ratings.get(slugify(tool.name)) || {};
    const href = buildToolPageUrl(tool) || tool.url || '#';
    const ext  = !buildToolPageUrl(tool) && tool.url ? ' target="_blank" rel="noopener"' : '';
    const desc = (tool.description || '').slice(0, 140);
    const note = r.ratingCount
      ? `<span class="sc-note">★ ${r.ratingAverage.toFixed(1)} (${r.ratingCount} ${t('idx.ratingReviewsSuffix', lang) || 'avis'})</span>`
      : '';
    return `
      <a class="showcase-card sc-front" href="${href}"${ext}>
        <div class="sc-front-head">
          ${scLogo(tool)}
          <div><b>${tool.name}</b><small>${catLabel(tool.category, lang)}</small></div>
        </div>
        <p class="sc-front-desc">${desc}${(tool.description || '').length > 140 ? '…' : ''}</p>
        <div class="sc-front-foot">${scPrice(tool, lang)}${note}</div>
        <div class="sc-front-cta">${buildToolPageUrl(tool)
          ? (t('quiz.viewSheet', lang) || 'Guide complet →')
          : (t('home.showcaseOfficial', lang) || 'Site officiel →')}</div>
      </a>`;
  }

  async function renderHeroShowcase() {
    const zone = document.getElementById('hero-showcase');
    if (!zone) return;

    const lang  = window.detecterLangue ? window.detecterLangue() : 'fr';
    const pool  = filtrerParLangue(state.tools)
      .filter(x => x.status !== 'offline' && x.status !== 'a_enrichir');
    if (pool.length < 3) return; // données insuffisantes : skeleton conservé

    // Notes Firestore (même source que les badges des cartes outils)
    const ratings = new Map();
    if (typeof window._getRatingSummaries === 'function') {
      try {
        const sums = await window._getRatingSummaries(pool.map(x => slugify(x.name)));
        if (sums) sums.forEach((v, k) => ratings.set(k, v));
      } catch (e) { /* notes indisponibles : badges "—" */ }
    }
    const noteOf = x => (ratings.get(slugify(x.name)) || {}).ratingCount || 0;

    // Outils à la une en premier, puis les mieux notés
    const ordered = [...pool].sort((a, b) =>
      ((b.plan === 'featured') - (a.plan === 'featured')) || (noteOf(b) - noteOf(a)));

    // Construit MAX_COMPS compositions décalées d'un cran dans la liste
    const comps = [];
    for (let i = 0; i < Math.min(MAX_COMPS, ordered.length); i++) {
      const picks = [0, 1, 2, 3].map(k => ordered[(i + k) % ordered.length]);
      comps.push(`
        <div class="showcase-comp${i === 0 ? ' active' : ''}" data-comp="${i}">
          ${scBackCard(picks, lang)}
          ${scCenterCard(picks[0], picks[1], ratings, lang)}
          ${scFrontCard(picks[2], ratings, lang)}
        </div>`);
    }

    const stage = zone.querySelector('.showcase-stage');
    stage.classList.remove('is-loading');
    stage.innerHTML = comps.join('');

    // Pastilles
    const dots = document.getElementById('showcase-dots');
    dots.innerHTML = comps.map((_, i) =>
      `<button type="button" role="tab" aria-label="Composition ${i + 1}"${i === 0 ? ' class="active"' : ''}></button>`
    ).join('');
    const dotEls = [...dots.children];

    function go(i) {
      _scIndex = i;
      stage.querySelectorAll('.showcase-comp').forEach((c, k) => c.classList.toggle('active', k === i));
      dotEls.forEach((d, k) => d.classList.toggle('active', k === i));
    }
    dotEls.forEach((d, i) => d.addEventListener('click', () => { go(i); restart(); }));

    function restart() {
      clearInterval(_scTimer);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      _scTimer = setInterval(() => go((_scIndex + 1) % comps.length), ROTATE_MS);
    }
    zone.addEventListener('mouseenter', () => clearInterval(_scTimer));
    zone.addEventListener('mouseleave', restart);
    // Pause quand le hero sort de l'écran (perf)
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        entries[0].isIntersecting ? restart() : clearInterval(_scTimer);
      }, { threshold: .2 }).observe(zone);
    }
    restart();
  }

  window.renderHeroShowcase = renderHeroShowcase;

  // Re-rendu après changement de langue (hook existant onLangueChange)
  const prevOnLangueChange = window.onLangueChange;
  window.onLangueChange = function (code) {
    if (typeof prevOnLangueChange === 'function') prevOnLangueChange(code);
    renderHeroShowcase();
  };
})();

/* Appel : ajouter dans le DOMContentLoaded existant,
   juste après loadAllData(); — ou à la fin de renderHome(). */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('hero-showcase')) {
    // différé : attendre que loadAllData() ait rempli state.tools
    const tryRender = setInterval(() => {
      if (state.tools && state.tools.length) {
        clearInterval(tryRender);
        renderHeroShowcase();
      }
    }, 300);
    setTimeout(() => clearInterval(tryRender), 15000); // garde-fou
  }
});