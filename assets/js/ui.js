import { SITE_DATA } from './site-data.js';

// Préférence système « réduire les animations »
const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// ── Injecte les données depuis SITE_DATA dans [data-bind] et [data-bind-href]
export function bindSiteData() {
  const get = (path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), SITE_DATA);
  document.querySelectorAll('[data-bind]').forEach(el => {
    const v = get(el.dataset.bind);
    if (v !== undefined) el.textContent = v;
  });
  document.querySelectorAll('[data-bind-href]').forEach(el => {
    const v = get(el.dataset.bindHref);
    if (v !== undefined) el.setAttribute('href', v);
  });
}

// ── Nav : scroll shadow, hamburger, lien actif
function initNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const hbg = document.getElementById('hbg');
  const navL = document.getElementById('navLinks');
  const sections = [...document.querySelectorAll('section[id]')];
  const links = [...document.querySelectorAll('.nav-links a[href^="#"]')];

  const updateActiveLink = () => {
    if (!sections.length) return;
    let cur = sections[0].id;
    sections.forEach(s => { if (scrollY + 100 >= s.offsetTop) cur = s.id; });
    links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + cur));
  };

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', scrollY > 20);
    updateActiveLink();
  }, { passive: true });

  if (hbg && navL) {
    hbg.addEventListener('click', () => { hbg.classList.toggle('open'); navL.classList.toggle('open'); });
    navL.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      hbg.classList.remove('open'); navL.classList.remove('open');
    }));
  }
}

// ── Reveal au scroll
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => obs.observe(el));
}

// ── B2 — Compteur animé sur les éléments [data-count]
function initCounters() {
  const els = document.querySelectorAll('[data-count]');
  if (!els.length) return;

  // Animations réduites : on laisse la valeur finale (déjà présente dans le HTML).
  if (prefersReducedMotion()) return;

  const animate = (el) => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.countSuffix ?? '';
    const prefix = el.dataset.countPrefix ?? '';
    const duration = 1400;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const val = Math.round(ease * target);
      el.textContent = prefix + val + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animate(e.target);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.3 });
  els.forEach(el => obs.observe(el));
}

// ── B3 — Scope : radial-gradient qui suit le curseur sur les cartes disciplines
function initScopeEffect() {
  document.querySelectorAll('.disc-card:not(.feat)').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
  });
}

// ── B1 — Balle qui frappe la cible dans le hero
function initBulletAnimation() {
  const visual = document.querySelector('.hero-visual');
  if (!visual) return;
  if (prefersReducedMotion()) return; // pas d'animation si l'utilisateur le demande

  const marks = [];
  const MAX_MARKS = 4;

  // Positions légèrement aléatoires autour du centre
  const scatter = () => (Math.random() - 0.5) * 16;

  const createImpact = (cx, cy) => {
    const impact = document.createElement('div');
    impact.className = 'hero-impact';
    impact.style.cssText = `margin-left:${cx - 10}px; margin-top:${cy - 10}px;`;
    visual.appendChild(impact);
    impact.animate([
      { transform: 'scale(0)', opacity: 0.9 },
      { transform: 'scale(3)', opacity: 0 }
    ], { duration: 500, easing: 'ease-out' }).onfinish = () => impact.remove();

    // Point d'impact persistant (disparaît tout seul via CSS)
    if (marks.length >= MAX_MARKS) marks.shift()?.remove();
    const mark = document.createElement('div');
    mark.className = 'hero-mark';
    mark.style.cssText = `margin-left:${cx - 2}px; margin-top:${cy - 2}px;`;
    visual.appendChild(mark);
    marks.push(mark);
    setTimeout(() => mark.remove(), 4000);
  };

  const fireBullet = () => {
    const size = visual.getBoundingClientRect();
    const cx = size.width / 2 + scatter();
    const cy = size.height / 2 + scatter();
    const startX = -60;

    const bullet = document.createElement('div');
    bullet.className = 'hero-bullet';
    bullet.style.cssText = `margin-left:${startX}px; margin-top:0px;`;
    visual.appendChild(bullet);

    const dx = cx - (size.width / 2 + startX);
    const dy = cy - size.height / 2;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    bullet.animate([
      { transform: `translate(0,0) rotate(${angle}deg)`, opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) rotate(${angle}deg) scale(0)`, opacity: 0.8 }
    ], { duration: 250, easing: 'ease-in' }).onfinish = () => {
      bullet.remove();
      createImpact(cx, cy);
    };
  };

  // Lancer 2s après le chargement, puis toutes les 3.5s.
  // On met l'animation en pause quand l'onglet n'est pas visible (économie CPU/batterie).
  let timer = null;
  const start = () => { if (!timer) timer = setInterval(fireBullet, 3500); };
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

  setTimeout(() => {
    if (document.visibilityState === 'visible') { fireBullet(); start(); }
    document.addEventListener('visibilitychange', () => {
      document.visibilityState === 'visible' ? start() : stop();
    });
  }, 2000);
}

document.addEventListener('DOMContentLoaded', () => {
  bindSiteData();
  initNav();
  initReveal();
  initCounters();
  initScopeEffect();
  initBulletAnimation();
});
