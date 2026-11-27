/* FAQ de l'accueil : questions dépliables, liens vers les fiches des outils
   et vers la page de soumission. Les textes viennent de i18n.js (clés home.faq.*). */
(function () {
  const OUTILS_CITES = ['ChatGPT', 'Midjourney', 'FineVoice', 'SE Ranking'];
  let langue = null;
  let timer = null;

  const lang = () => langue || (window.detecterLangue ? window.detecterLangue() : 'fr');
  const tr = k => (window.t ? window.t(k, lang()) : k);
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Texte → HTML : liens sur les noms d'outils et sur « {soumettre} »
  function formater(texte) {
    let h = esc(texte);
    h = h.replace('{soumettre}',
      `<a class="faq-link" href="/soumettre/">${esc(tr('home.faq.submitLink'))}</a>`);
    OUTILS_CITES.forEach(nom => {
      const re = new RegExp(nom.replace(/ /g, '\\s?'), 'g');
      h = h.replace(re, m => `<a class="faq-tool" data-tool="${esc(nom)}">${m}</a>`);
    });
    return h;
  }

  function rendre() {
    const liste = document.getElementById('faq-list');
    if (!liste) return;
    liste.innerHTML = [1, 2, 3, 4, 5, 6, 7].map(i => `
      <details class="faq-item">
        <summary>${i}. ${esc(tr('home.faq.q' + i))}</summary>
        <div class="faq-a">${formater(tr('home.faq.a' + i))}</div>
      </details>`).join('');
  }

  // Les liens n'ont pas d'adresse tant que les outils ne sont pas chargés :
  // ils ne sont donc pas cliquables avant d'être résolus.
  function resoudreLiens() {
    const outils = (window.state && state.tools) || [];
    if (!outils.length) return false;
    document.querySelectorAll('#faq-list a.faq-tool').forEach(a => {
      const cible = norm(a.dataset.tool);
      const outil = outils.find(o => norm(o.name) === cible);
      const url = outil && window.buildToolPageUrl ? window.buildToolPageUrl(outil) : null;
      if (url) {
        a.href = url;
      } else {
        const span = document.createElement('span');
        span.className = 'faq-tool-plain';
        span.textContent = a.textContent;
        a.replaceWith(span);
      }
    });
    return true;
  }

  function attendreOutils() {
    clearInterval(timer);
    let essais = 0;
    timer = setInterval(() => {
      essais++;
      if (resoudreLiens() || essais > 150) clearInterval(timer);
    }, 100);
  }

  document.addEventListener('DOMContentLoaded', () => {
    rendre();
    attendreOutils();
  });

  const precedent = window.onLangueChange;
  window.onLangueChange = function (code) {
    if (typeof precedent === 'function') precedent(code);
    langue = code;
    rendre();
    attendreOutils();
  };
})();
