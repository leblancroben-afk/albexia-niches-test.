/* Fond « fibres de neurones » de la section Écosystème : mouvement lent,
   dessiné sur canvas, mis en pause hors écran et figé si l'utilisateur
   préfère moins d'animations. Remplace l'aurore CSS. */
(function () {
  const hote = document.querySelector('.ecosystem-section');
  if (!hote) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'eco-neurons';
  canvas.setAttribute('aria-hidden', 'true');
  hote.insertBefore(canvas, hote.firstChild);
  const ctx = canvas.getContext('2d');

  const reduire = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0, noeuds = [], visible = true, derniere = 0, raf = null;

  function creer() {
    const n = Math.round(Math.min(24, Math.max(12, (W * H) / 40000)));
    noeuds = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.12,
      p: Math.random() * Math.PI * 2
    }));
  }

  function dimensionner() {
    const r = hote.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    creer();
    if (reduire) dessiner();
  }

  function dessiner() {
    ctx.clearRect(0, 0, W, H);
    for (const n of noeuds) {
      n.x += n.vx; n.y += n.vy; n.p += 0.006;
      if (n.x < -20) n.x = W + 20; if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20; if (n.y > H + 20) n.y = -20;
    }
    for (let i = 0; i < noeuds.length; i++) {
      for (let j = i + 1; j < noeuds.length; j++) {
        const a = noeuds[i], b = noeuds[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 170) continue;
        const alpha = (1 - d / 170) * 0.4;
        const mx = (a.x + b.x) / 2 + Math.sin(a.p + b.p) * 18;
        const my = (a.y + b.y) / 2 + Math.cos(a.p - b.p) * 18;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.strokeStyle = `rgba(255,107,157,${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
    for (const n of noeuds) {
      const pulse = 0.5 + 0.5 * Math.sin(n.p);
      ctx.beginPath();
      ctx.arc(n.x, n.y, 1.6 + pulse * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(52,211,153,${(0.35 + pulse * 0.35).toFixed(3)})`;
      ctx.fill();
    }
  }

  function boucle(t) {
    raf = requestAnimationFrame(boucle);
    if (!visible || t - derniere < 40) return; // ~25 images/s : fluide et léger
    derniere = t;
    dessiner();
  }

  dimensionner();
  if (!reduire) raf = requestAnimationFrame(boucle);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(hote);
  }
  let t = null;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(dimensionner, 200); });
})();
