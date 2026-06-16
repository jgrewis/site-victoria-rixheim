// Formulaire d'ajout de photos (espace membre) — envoie un ou plusieurs
// fichiers vers le bucket Supabase Storage "galerie", lu ensuite par gallery.js.

import { supabase } from './supabase.js';

const BUCKET = 'galerie';

const form = document.getElementById('photoUploadForm');
const msg = document.getElementById('photoUploadMsg');
const submitBtn = document.getElementById('photoSubmit');

function safeExt(name) {
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : 'jpg';
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : 'jpg';
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const files = Array.from(form.photo.files);
    if (!files.length) return;

    submitBtn.disabled = true;
    msg.className = 'photo-upload-msg show';

    let ok = 0;
    const failed = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      msg.textContent = `Envoi en cours… (${i + 1}/${files.length})`;

      const fileName = `${Date.now()}-${crypto.randomUUID()}.${safeExt(file.name)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(fileName, file);

      if (error) failed.push(`${file.name} : ${error.message}`);
      else ok++;
    }

    if (!failed.length) {
      const word = ok > 1 ? `${ok} photos ajoutées` : 'Photo ajoutée';
      msg.textContent = `${word} ! Elles apparaîtront dans la galerie du site.`;
      msg.className = 'photo-upload-msg show success';
      form.reset();
    } else if (ok) {
      msg.textContent = `${ok} photo(s) ajoutée(s), mais ${failed.length} en erreur : ${failed.join(' — ')}`;
      msg.className = 'photo-upload-msg show error';
    } else {
      msg.textContent = `Erreur : ${failed.join(' — ')}`;
      msg.className = 'photo-upload-msg show error';
    }

    submitBtn.disabled = false;
  });
}
