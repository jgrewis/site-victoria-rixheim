// Galerie photo — charge les images du bucket Supabase Storage "galerie".
// Selon la page, rend soit un carousel (accueil : #carouselTrack),
// soit une grille complète (page dédiée : #galleryGrid). Gère le lightbox.

import { supabase } from './supabase.js';

const BUCKET = 'galerie';

async function fetchImages() {
  const { data: files, error } = await supabase.storage.from(BUCKET).list('', {
    sortBy: { column: 'created_at', order: 'desc' },
  });

  if (error) throw error;

  return (files ?? [])
    .filter(f => f.name && !f.name.startsWith('.'))
    .map(f => ({
      name: f.name,
      url: supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
    }));
}

function makeItem({ url }) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'gallery-item';
  item.setAttribute('aria-label', 'Agrandir la photo');

  const img = document.createElement('img');
  img.src = url;
  img.loading = 'lazy';
  img.alt = 'Photo du club Victoria Rixheim';

  item.appendChild(img);
  item.addEventListener('click', () => openLightbox(url));
  return item;
}

function renderInto(container, images, emptyMsg) {
  if (!images.length) {
    container.innerHTML = `<p class="gallery-empty">${emptyMsg}</p>`;
    return;
  }
  container.innerHTML = '';
  images.forEach(im => container.appendChild(makeItem(im)));
}

async function loadGallery() {
  const track = document.getElementById('carouselTrack');
  const grid = document.getElementById('galleryGrid');
  const container = track || grid;
  if (!container) return;

  let images;
  try {
    images = await fetchImages();
  } catch {
    container.innerHTML = '<p class="gallery-empty">Impossible de charger la galerie pour le moment.</p>';
    return;
  }

  renderInto(container, images, 'Aucune photo pour le moment. Revenez bientôt !');

  if (track) initCarousel(track);
}

/* ── Carousel (défilement horizontal + flèches) ─── */
function initCarousel(track) {
  const prev = document.getElementById('carouselPrev');
  const next = document.getElementById('carouselNext');
  if (!prev || !next) return;

  const step = () => {
    const first = track.querySelector('.gallery-item');
    return first ? first.getBoundingClientRect().width + 12 : track.clientWidth * 0.8;
  };

  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));

  const updateNav = () => {
    const max = track.scrollWidth - track.clientWidth - 1;
    const overflowing = track.scrollWidth > track.clientWidth + 1;
    prev.disabled = track.scrollLeft <= 0;
    next.disabled = track.scrollLeft >= max;
    [prev, next].forEach(b => b.style.display = overflowing ? '' : 'none');
  };

  track.addEventListener('scroll', updateNav, { passive: true });
  window.addEventListener('resize', updateNav);
  // Laisse le temps aux images de poser leur taille avant le premier calcul.
  requestAnimationFrame(updateNav);
  setTimeout(updateNav, 300);
}

/* ── Lightbox ─── */
function openLightbox(url) {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  if (!lightbox || !img) return;
  img.src = url;
  lightbox.classList.add('open');
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  if (!lightbox || !img) return;
  lightbox.classList.remove('open');
  img.src = '';
}

function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  const closeBtn = document.getElementById('lightboxClose');
  if (!lightbox) return;
  closeBtn?.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initLightbox();
  loadGallery();
});
