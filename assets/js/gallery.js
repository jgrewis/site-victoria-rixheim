// Galerie photo — charge les images du bucket Supabase Storage "galerie"
// et gère le lightbox (clic pour agrandir).

import { supabase } from './supabase.js';

const BUCKET = 'galerie';

async function loadGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  const { data: files, error } = await supabase.storage.from(BUCKET).list('', {
    sortBy: { column: 'created_at', order: 'desc' },
  });

  if (error) {
    grid.innerHTML = '<p class="gallery-empty">Impossible de charger la galerie pour le moment.</p>';
    return;
  }

  const images = (files ?? []).filter(f => f.name && !f.name.startsWith('.'));

  if (!images.length) {
    grid.innerHTML = '<p class="gallery-empty">Aucune photo pour le moment. Revenez bientôt !</p>';
    return;
  }

  grid.innerHTML = '';
  images.forEach(file => {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(file.name);
    const url = data.publicUrl;

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
    grid.appendChild(item);
  });
}

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
