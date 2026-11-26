import { chargerPlans, PLANS_PAYANTS_OUVERTS } from './plans-cards.js';

const TXT = {
  fr: {
    free: 'Gratuit', freeSub: 'pour toujours', freeDesc: 'Pour essayer Albexia', freeCta: 'Commencer gratuitement',
    starter: 'Starter', starterSub: 'paiement unique', starterDesc: 'Plus de visibilité pour votre outil',
    featured: 'Featured', featuredSub: 'par mois', featuredDesc: 'Mise en avant maximale',
    cta: 'Choisir cette formule', unavailable: 'Bientôt disponible'
  },
  en: {
    free: 'Free', freeSub: 'forever', freeDesc: 'To try Albexia', freeCta: 'Start for free',
    starter: 'Starter', starterSub: 'one-time payment', starterDesc: 'More visibility for your tool',
    featured: 'Featured', featuredSub: 'per month', featuredDesc: 'Maximum promotion',
    cta: 'Choose this plan', unavailable: 'Coming soon'
  },
  es: {
    free: 'Gratis', freeSub: 'para siempre', freeDesc: 'Para probar Albexia', freeCta: 'Empezar gratis',
    starter: 'Starter', starterSub: 'pago único', starterDesc: 'Más visibilidad para tu herramienta',
    featured: 'Featured', featuredSub: 'al mes', featuredDesc: 'Máxima promoción',
    cta: 'Elegir este plan', unavailable: 'Próximamente'
  }
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function carte({ cls = '', badge = '', nom, desc, prix, sub, features, action }) {
  return `
    <article class="hp-card ${cls}">
      ${badge ? `<span class="hp-badge">${esc(badge)}</span>` : ''}
      <h3 class="hp-name">${esc(nom)}</h3>
      <p class="hp-desc">${esc(desc)}</p>
      <div class="hp-price">${prix}</div>
      <p class="hp-price-sub">${esc(sub)}</p>
      <ul class="hp-features">${features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      ${action}
    </article>`;
}

export async function afficherFormulesAccueil(containerId, langue = 'fr') {
  const conteneur = document.getElementById(containerId);
  if (!conteneur) return;

  const L = TXT[langue] ? langue : 'fr';
  const t = TXT[L];
  const plans = await chargerPlans();

  const features = obj => obj[`features_${L}`]?.length ? obj[`features_${L}`] : (obj.features_fr || []);
  const badge = obj => obj[`badge_${L}`] || obj.badge_fr || '';
  const ouvert = PLANS_PAYANTS_OUVERTS;

  const lienSoumettre = label => `<a class="hp-btn" href="soumettre/">${esc(label)}</a>`;
  const actionPayante = ouvert
    ? lienSoumettre(t.cta)
    : `<button class="hp-btn" type="button" disabled>${esc(t.unavailable)}</button>`;

  conteneur.innerHTML = `
    <div class="hp-grid">
      ${carte({ nom: t.free, desc: t.freeDesc, prix: '0 $', sub: t.freeSub,
        features: features(plans.standard), action: lienSoumettre(t.freeCta) })}
      ${carte({ cls: ouvert ? '' : 'hp-closed', nom: t.starter, desc: t.starterDesc,
        prix: `${Number(plans.starter.prix)} $`, sub: t.starterSub,
        features: features(plans.starter), action: actionPayante })}
      ${carte({ cls: `hp-featured ${ouvert ? '' : 'hp-closed'}`, badge: badge(plans.featured),
        nom: t.featured, desc: t.featuredDesc,
        prix: `${Number(plans.featured.prix)} $`, sub: t.featuredSub,
        features: features(plans.featured), action: actionPayante })}
    </div>`;
}
