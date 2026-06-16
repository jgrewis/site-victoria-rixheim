// Classement partagé du simulateur — pseudos + scores par catégorie,
// stocké dans la table Supabase "scores". Chargé sur jeu.html (vue 2D) et
// jeu-fps.html (vue 3D) ; la vue est lue depuis data-view du panneau.
//
// Catégories : `${view}-${mode}` → 2d-20, 2d-50, 3d-20, 3d-50.
// Les jeux signalent la fin d'un carton via l'événement `carton:fini`
// ({ detail: { mode, score } }).

import { supabase } from './supabase.js';

const TABLE = 'scores';
const PSEUDO_KEY = 'victoria_pseudo';

const panel = document.getElementById('leaderboard');
if (panel) initLeaderboard(panel);

function initLeaderboard(panel) {
  const view = panel.dataset.view;                 // '2d' | '3d'
  const listEl = document.getElementById('lbList');
  const tabs = [...panel.querySelectorAll('.lb-tab')];
  const pseudoInput = document.getElementById('pseudoInput');
  const publishBtn = document.getElementById('publishBtn');
  const publishMsg = document.getElementById('publishMsg');

  let activeMode = '20';
  let lastCarton = null;                            // { mode, score }

  // ── Pseudo mémorisé ──────────────────────────────────────
  if (pseudoInput) {
    pseudoInput.value = localStorage.getItem(PSEUDO_KEY) || '';
    pseudoInput.addEventListener('input', () => {
      localStorage.setItem(PSEUDO_KEY, pseudoInput.value.trim());
    });
  }

  // ── Lecture + rendu du tableau ───────────────────────────
  async function render(mode) {
    activeMode = mode;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    listEl.innerHTML = '<li class="lb-empty">Chargement…</li>';

    let rows;
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('pseudo,score,created_at')
        .eq('category', `${view}-${mode}`)
        .order('score', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      rows = bestPerPseudo(data).slice(0, 10);
    } catch {
      listEl.innerHTML = '<li class="lb-empty">Classement bientôt disponible.</li>';
      return;
    }

    if (!rows.length) {
      listEl.innerHTML = '<li class="lb-empty">Aucun score pour le moment. Soyez le premier !</li>';
      return;
    }

    listEl.innerHTML = rows.map((r, i) =>
      `<li class="lb-row${i < 3 ? ' top' : ''}">` +
        `<span class="lb-rank">${i + 1}</span>` +
        `<span class="lb-name">${escapeHtml(r.pseudo)}</span>` +
        `<span class="lb-score">${r.score}<span class="lb-max">/50</span></span>` +
      `</li>`
    ).join('');
  }

  // Les données arrivent déjà triées (meilleur score d'abord) :
  // on garde la première occurrence de chaque pseudo.
  function bestPerPseudo(data) {
    const seen = new Map();
    for (const r of data ?? []) {
      const key = r.pseudo.toLowerCase();
      if (!seen.has(key)) seen.set(key, r);
    }
    return [...seen.values()];
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  tabs.forEach(t => t.addEventListener('click', () => render(t.dataset.mode)));

  // ── Publication d'un score ───────────────────────────────
  document.addEventListener('carton:fini', (e) => {
    lastCarton = { mode: e.detail.mode, score: e.detail.score };
    if (publishBtn) {
      publishBtn.disabled = false;
      publishBtn.textContent = 'Publier mon score';
    }
    if (publishMsg) { publishMsg.textContent = ''; publishMsg.className = 'lb-publish-msg'; }
  });

  publishBtn?.addEventListener('click', async () => {
    if (!lastCarton) return;
    const pseudo = (pseudoInput?.value || '').trim();
    if (pseudo.length < 2) {
      if (publishMsg) { publishMsg.textContent = 'Choisis un pseudo (2 caractères minimum).'; publishMsg.className = 'lb-publish-msg error'; }
      pseudoInput?.focus();
      return;
    }
    localStorage.setItem(PSEUDO_KEY, pseudo);

    publishBtn.disabled = true;
    publishBtn.textContent = 'Envoi…';

    const { error } = await supabase.from(TABLE).insert({
      pseudo: pseudo.slice(0, 20),
      category: `${view}-${lastCarton.mode}`,
      score: lastCarton.score,
    });

    if (error) {
      publishBtn.disabled = false;
      publishBtn.textContent = 'Publier mon score';
      if (publishMsg) { publishMsg.textContent = 'Échec de l’envoi, réessaie.'; publishMsg.className = 'lb-publish-msg error'; }
      return;
    }

    publishBtn.textContent = 'Score publié ✓';
    if (publishMsg) { publishMsg.textContent = 'Ton score est dans le classement !'; publishMsg.className = 'lb-publish-msg success'; }
    render(lastCarton.mode);
  });

  // Premier rendu
  render('20');
}
