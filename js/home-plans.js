import { chargerPlans, PLANS_PAYANTS_OUVERTS, TEXTES_UI } from './plans-cards.js';
import { db, collection, addDoc, getDocs, serverTimestamp } from './firebase-config.js';
import { loginWithGoogle } from './auth.js';

// Identique à la page soumettre
const WORKER_SOUMISSION_URL = 'https://albexia-paiement.leblancroben.workers.dev/soumettre-payant';
const TURNSTILE_SITEKEY = '0x4AAAAAAGFvyQqT8dICX8zc';

const FORM = {
  fr: { title: 'Soumettre un outil', url: "URL de l'outil", name: "Nom de l'outil", cat: 'Catégorie',
        prix: 'Modèle de tarification', desc: 'Description', email: 'Votre email', choose: '— Choisir —',
        gratuit: 'Gratuit', freemium: 'Freemium', payant: 'Payant', cancel: 'Annuler',
        login: 'Continuer avec Google', loginNeeded: 'Connectez-vous pour payer la formule.',
        captcha: 'Validez le captcha avant de continuer.', pay: 'Continuer vers le paiement',
        send: 'Envoyer ma soumission', sending: '…', ok: 'Soumission envoyée. Nous revenons vers vous par email.',
        err: 'Une erreur est survenue, réessayez.', payErr: "Le paiement n'a pas pu démarrer. Réessayez dans un instant.",
        conn: 'Problème de connexion, réessayez.', hint: 'Minimum 30 caractères' },
  en: { title: 'Submit a tool', url: 'Tool URL', name: 'Tool name', cat: 'Category',
        prix: 'Pricing model', desc: 'Description', email: 'Your email', choose: '— Choose —',
        gratuit: 'Free', freemium: 'Freemium', payant: 'Paid', cancel: 'Cancel',
        login: 'Continue with Google', loginNeeded: 'Sign in to pay for this plan.',
        captcha: 'Complete the captcha before continuing.', pay: 'Continue to payment',
        send: 'Send my submission', sending: '…', ok: 'Submission sent. We will get back to you by email.',
        err: 'Something went wrong, please try again.', payErr: 'Checkout could not start. Please try again shortly.',
        conn: 'Connection problem, please try again.', hint: 'Minimum 30 characters' },
  es: { title: 'Enviar una herramienta', url: 'URL de la herramienta', name: 'Nombre de la herramienta', cat: 'Categoría',
        prix: 'Modelo de precio', desc: 'Descripción', email: 'Tu email', choose: '— Elegir —',
        gratuit: 'Gratis', freemium: 'Freemium', payant: 'De pago', cancel: 'Cancelar',
        login: 'Continuar con Google', loginNeeded: 'Inicia sesión para pagar este plan.',
        captcha: 'Completa el captcha antes de continuar.', pay: 'Continuar al pago',
        send: 'Enviar mi solicitud', sending: '…', ok: 'Solicitud enviada. Te responderemos por email.',
        err: 'Algo salió mal, inténtalo de nuevo.', payErr: 'El pago no pudo iniciarse. Inténtalo de nuevo en un momento.',
        conn: 'Problema de conexión, inténtalo de nuevo.', hint: 'Mínimo 30 caracteres' }
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const langueActive = l => (TEXTES_UI[l] ? l : 'fr');

function carte({ tier, cls = '', badge = '', nom, desc, prix, sub, cta, features }) {
  return `
    <article class="hp-card ${cls}">
      ${badge ? `<span class="hp-badge">${esc(badge)}</span>` : ''}
      <h3 class="hp-name">${esc(nom)}</h3>
      <p class="hp-desc">${esc(desc)}</p>
      <div class="hp-price">${esc(prix)}</div>
      <p class="hp-price-sub">${esc(sub)}</p>
      <ul class="hp-features">${features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      <button class="hp-btn" type="button" data-tier="${tier}">${esc(cta)}</button>
    </article>`;
}

/* ───── Modal plein écran ───── */
let modal, form, tierCourant = 'gratuit', langueCourante = 'fr', categoriesChargees = false;
let turnstileId = null, envoiEnCours = false;

function creerModal() {
  if (modal) return;
  modal = document.createElement('div');
  modal.className = 'hp-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) fermerModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) fermerModal(); });
}

function rendreFormulaire() {
  const t = FORM[langueCourante];
  turnstileId = null;
  modal.innerHTML = `
    <div class="hp-modal-inner">
      <div class="hp-modal-top">
        <div>
          <div class="hp-modal-title">${esc(t.title)}</div>
          <div class="hp-modal-tier" id="hp-modal-tier"></div>
        </div>
        <button class="hp-modal-close" type="button" id="hp-modal-close" aria-label="${esc(t.cancel)}">✕</button>
      </div>
      <form id="hp-form" novalidate>
        <div class="hp-field">
          <label for="hp-url">${esc(t.url)} <span class="req">*</span></label>
          <input type="url" id="hp-url" placeholder="https://exemple.com" required>
        </div>
        <div class="hp-field">
          <label for="hp-name">${esc(t.name)} <span class="req">*</span></label>
          <input type="text" id="hp-name" required>
        </div>
        <div class="hp-field">
          <label for="hp-cat">${esc(t.cat)} <span class="req">*</span></label>
          <select id="hp-cat" required><option value="">${esc(t.choose)}</option></select>
        </div>
        <div class="hp-field">
          <label for="hp-prix">${esc(t.prix)} <span class="req">*</span></label>
          <select id="hp-prix" required>
            <option value="">${esc(t.choose)}</option>
            <option value="gratuit">${esc(t.gratuit)}</option>
            <option value="freemium">${esc(t.freemium)}</option>
            <option value="payant">${esc(t.payant)}</option>
          </select>
        </div>
        <div class="hp-field">
          <label for="hp-desc">${esc(t.desc)} <span class="req">*</span></label>
          <textarea id="hp-desc" minlength="30" maxlength="900" required></textarea>
          <span class="hp-hint">${esc(t.hint)}</span>
        </div>
        <div class="hp-field">
          <label for="hp-email">${esc(t.email)} <span class="req">*</span></label>
          <input type="email" id="hp-email" placeholder="contact@votreoutil.com" required>
        </div>

        <div id="hp-login-zone" class="hp-login" hidden>
          <p>${esc(t.loginNeeded)}</p>
          <button class="hp-btn" type="button" id="hp-login-btn">${esc(t.login)}</button>
        </div>
        <div id="hp-turnstile" class="hp-turnstile" hidden></div>

        <div class="hp-msg" id="hp-msg" aria-live="polite"></div>
        <div class="hp-modal-actions">
          <button class="hp-btn" type="button" id="hp-cancel">${esc(t.cancel)}</button>
          <button class="hp-btn hp-btn-primary" type="submit" id="hp-send">${esc(t.send)}</button>
        </div>
      </form>
    </div>`;
  document.getElementById('hp-modal-close').onclick = fermerModal;
  document.getElementById('hp-cancel').onclick = fermerModal;
  document.getElementById('hp-login-btn').onclick = connecterPuisPayer;
  form = document.getElementById('hp-form');
  form.onsubmit = envoyer;
}

async function chargerCategories() {
  if (categoriesChargees) return;
  const select = document.getElementById('hp-cat');
  try {
    const snap = await getDocs(collection(db, 'categories'));
    const cats = snap.docs.map(d => d.data()).filter(c => c.id && c.nom)
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const libelle = c => (window.translateCategory ? window.translateCategory(c.id, langueCourante) : c.nom) || c.nom;
    select.insertAdjacentHTML('beforeend', cats.map(c => `<option value="${esc(c.id)}">${esc(libelle(c))}</option>`).join(''));
    categoriesChargees = true;
  } catch (err) {
    console.error('[home-plans] Catégories indisponibles :', err);
  }
}

/* Captcha Turnstile (même clé que la page soumettre), rendu à la demande */
function rendreTurnstile() {
  const zone = document.getElementById('hp-turnstile');
  if (!zone) return;
  zone.hidden = false;
  const tenter = () => {
    if (window.turnstile && turnstileId === null) {
      turnstileId = window.turnstile.render(zone, { sitekey: TURNSTILE_SITEKEY, theme: 'light' });
    } else if (!window.turnstile) {
      setTimeout(tenter, 300);
    }
  };
  tenter();
}
const tokenTurnstile = () => (window.turnstile && turnstileId !== null ? window.turnstile.getResponse(turnstileId) : null) || null;

function ouvrirModal(tier) {
  creerModal();
  tierCourant = tier;
  rendreFormulaire();
  document.getElementById('hp-modal-tier').textContent = { gratuit: 'Gratuit', starter: 'Starter', featured: 'Featured' }[tier];
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  chargerCategories();
  if (tier !== 'gratuit') rendreTurnstile(); // formules payantes : captcha requis
}

function fermerModal() {
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

function afficherMessage(texte, type = '') {
  const m = document.getElementById('hp-msg');
  if (!m) return;
  m.textContent = texte;
  m.className = `hp-msg ${type}`;
}

// Données envoyées : identiques à la page soumettre (ramasserDonnees)
function ramasserDonnees(tier) {
  return {
    nom_outil: document.getElementById('hp-name').value.trim(),
    url_outil: document.getElementById('hp-url').value.trim(),
    categorie: document.getElementById('hp-cat').value,
    description: document.getElementById('hp-desc').value.trim(),
    email_contact: document.getElementById('hp-email').value.trim(),
    modele_prix: document.getElementById('hp-prix').value,
    tier_demande: tier,
    uid: window._firebaseUser?.uid || null,
    status: 'pending',
    created_at: serverTimestamp()
  };
}

async function connecterPuisPayer() {
  const t = FORM[langueCourante];
  const res = await loginWithGoogle();
  if (!res.ok) return afficherMessage(res.error || t.err, 'err');
  document.getElementById('hp-login-zone').hidden = true;
  payer();
}

async function payer() {
  const t = FORM[langueCourante];
  const send = document.getElementById('hp-send');
  if (!window._firebaseUser) {
    document.getElementById('hp-login-zone').hidden = false;
    return afficherMessage(t.loginNeeded, 'err');
  }
  const token = tokenTurnstile();
  if (!token) return afficherMessage(t.captcha, 'err');

  send.disabled = true;
  afficherMessage(t.sending);
  try {
    const idToken = await window._firebaseUser.getIdToken();
    const res = await fetch(WORKER_SOUMISSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ ...ramasserDonnees(tierCourant), turnstile_token: token }),
    });
    const data = await res.json();
    if (!res.ok || !data.checkout_url) return afficherMessage(data.error || t.payErr, 'err');
    window.location.href = data.checkout_url;
  } catch (err) {
    console.error('[home-plans] Paiement impossible :', err);
    afficherMessage(t.conn, 'err');
  } finally {
    send.disabled = false;
  }
}

async function envoyer(e) {
  e.preventDefault();
  if (envoiEnCours) return;
  const t = FORM[langueCourante];
  if (!form.reportValidity()) return;

  // Formule payante : connexion + captcha + paiement, comme la page soumettre
  if (tierCourant !== 'gratuit') return payer();

  // Formule gratuite : enregistrement direct, sans paiement
  envoiEnCours = true;
  const send = document.getElementById('hp-send');
  send.disabled = true;
  afficherMessage(t.sending);
  try {
    await addDoc(collection(db, 'soumissions'), ramasserDonnees('gratuit'));
    form.reset();
    afficherMessage(t.ok, 'ok');
  } catch (err) {
    console.error('[home-plans] Envoi impossible :', err);
    afficherMessage(t.err, 'err');
  } finally {
    send.disabled = false;
    envoiEnCours = false;
  }
}

/* ───── Rendu des cartes ───── */
export async function afficherFormulesAccueil(containerId, langue = 'fr') {
  const conteneur = document.getElementById(containerId);
  if (!conteneur) return;
  langueCourante = langueActive(langue);
  const T = TEXTES_UI[langueCourante];
  const plans = await chargerPlans();

  const feat = obj => obj[`features_${langueCourante}`]?.length ? obj[`features_${langueCourante}`] : (obj.features_fr || []);
  const badge = obj => obj[`badge_${langueCourante}`] || obj.badge_fr || '';
  const fermee = !PLANS_PAYANTS_OUVERTS ? 'hp-closed' : '';

  conteneur.innerHTML = `
    <div class="hp-grid">
      ${carte({ tier: 'gratuit', nom: 'Gratuit', desc: T.std.desc, prix: T.std.price, sub: T.std.sub,
        cta: T.std.cta, features: feat(plans.standard) })}
      ${carte({ tier: 'featured', cls: `hp-featured ${fermee}`, badge: badge(plans.featured), nom: 'Featured',
        desc: T.featured.desc, prix: `${plans.featured.prix}$`, sub: T.featured.sub,
        cta: T.featured.cta, features: feat(plans.featured) })}
      ${carte({ tier: 'starter', cls: fermee, nom: 'Starter', desc: T.starter.desc, prix: `${plans.starter.prix}$`,
        sub: T.starter.sub, cta: T.starter.cta, features: feat(plans.starter) })}
    </div>`;

  conteneur.querySelectorAll('.hp-btn').forEach(btn =>
    btn.addEventListener('click', () => ouvrirModal(btn.dataset.tier)));
}
