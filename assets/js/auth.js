// Logique d'authentification — utilisée par index.html (formulaire de login).

import { supabase, roleOf } from './supabase.js';

const form = document.getElementById('loginForm');
const errorBox = document.getElementById('loginError');
const submitBtn = document.getElementById('loginSubmit');

function showError(msg) {
  if (!errorBox) return;
  errorBox.textContent = msg;
  errorBox.classList.add('show');
}
function clearError() {
  if (!errorBox) return;
  errorBox.classList.remove('show');
}

function destinationFor(user) {
  return roleOf(user) === 'member' ? './espace-membre.html' : './accueil.html';
}

// Si l'utilisateur est déjà connecté en arrivant sur index.html, on le redirige.
if (form) {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) window.location.replace(destinationFor(session.user));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    submitBtn.disabled = true;

    const email = form.email.value.trim();
    const password = form.password.value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      showError(error.message === 'Invalid login credentials'
        ? 'Email ou mot de passe incorrect.'
        : `Erreur : ${error.message}`);
      submitBtn.disabled = false;
      return;
    }

    window.location.href = destinationFor(data.user);
  });
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = './index.html';
}
