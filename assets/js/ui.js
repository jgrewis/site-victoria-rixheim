import { SITE_DATA } from './site-data.js';

// ── Injecte les données depuis SITE_DATA dans tout élément [data-bind="chemin.cle"]
//    et [data-bind-href="..."] pour les attributs href.
function bindSiteData() {
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

// ── Nav scroll shadow + hamburger
function initNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const hbg = document.getElementById('hbg');
  const navL = document.getElementById('navLinks');

  const onScroll = () => {
    nav.classList.toggle('scrolled', scrollY > 20);
    if (sections.length) updateActiveLink();
  };

  if (hbg && navL) {
    hbg.addEventListener('click', () => {
      hbg.classList.toggle('open');
      navL.classList.toggle('open');
    });
    navL.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => {
        hbg.classList.remove('open');
        navL.classList.remove('open');
      })
    );
  }

  const sections = [...document.querySelectorAll('section[id]')];
  const links = [...document.querySelectorAll('.nav-links a[href^="#"]')];
  const updateActiveLink = () => {
    if (!sections.length) return;
    let cur = sections[0].id;
    sections.forEach(s => { if (scrollY + 100 >= s.offsetTop) cur = s.id; });
    links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + cur));
  };

  window.addEventListener('scroll', onScroll, { passive: true });
}

// ── Reveal au scroll
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => obs.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
  bindSiteData();
  initNav();
  initReveal();
});
