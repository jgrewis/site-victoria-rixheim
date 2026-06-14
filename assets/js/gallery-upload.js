// Formulaire d'ajout de photo (espace membre) — envoie le fichier vers
// le bucket Supabase Storage "galerie", lu ensuite par gallery.js.

import { supabase } from './supabase.js';

const BUCKET = 'galerie';

const form = document.getElementById('photoUploadForm');
const msg = document.getElementById('photoUploadMsg');
const submitBtn = document.getElementById('photoSubmit');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = form.photo.files[0];
    if (!file) return;

    submitBtn.disabled = true;
    msg.textContent = 'Envoi en cours…';
    msg.className = 'photo-upload-msg show';

    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(fileName, file);

    if (error) {
      msg.textContent = `Erreur : ${error.message}`;
      msg.className = 'photo-upload-msg show error';
    } else {
      msg.textContent = 'Photo ajoutée ! Elle apparaîtra dans la galerie du site.';
      msg.className = 'photo-upload-msg show success';
      form.reset();
    }

    submitBtn.disabled = false;
  });
}
