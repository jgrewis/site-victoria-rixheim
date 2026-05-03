// Garde de session — à inclure en haut de chaque page protégée.
//   requireAuth()           → page protégée, tous rôles
//   requireAuth('member')   → page protégée, membres uniquement

import { supabase, roleOf } from './supabase.js';

export async function requireAuth(requiredRole = null) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.replace('./index.html');
    return null;
  }

  const role = roleOf(session.user);

  if (requiredRole === 'member' && role !== 'member') {
    window.location.replace('./accueil.html');
    return null;
  }

  return { user: session.user, role };
}

export function bindUserUI(session) {
  if (!session) return;
  document.querySelectorAll('[data-user-email]').forEach(el => {
    el.textContent = session.user.email;
  });
  document.querySelectorAll('[data-user-role]').forEach(el => {
    el.textContent = session.role;
  });
}
