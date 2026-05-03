# Handoff — Authentification site vitrine

## Contexte

Site vitrine statique destiné à GitHub Pages, avec un mur de connexion Supabase Auth pour limiter l'accès au grand public. Contenu actuellement non sensible. Évolution prévue à terme vers une section membres.

## Architecture retenue

```
[Visiteur] → [GitHub Pages (HTML/CSS/JS)] → [Supabase Auth API]
                                          ↘ [Supabase DB + RLS]  (plus tard)
```

- **Hébergement** : GitHub Pages (repo public ou privé, peu importe — l'URL reste publique)
- **Auth** : Supabase Auth, email + mot de passe
- **Données** : Supabase Postgres (utilisé seulement quand on ajoutera la partie membres)

## Frontière de sécurité — à garder en tête

| Élément | Protégé ? |
|---|---|
| Fichiers HTML/CSS/JS du site | ❌ Toujours téléchargeables publiquement |
| Données stockées dans Supabase | ✅ Protégées par Auth + RLS |

**Règle d'or** : tout ce qui doit rester confidentiel doit vivre dans Supabase, jamais dans le code source du site.

---

## Prérequis

- [ ] Compte Supabase actif (déjà OK)
- [ ] Projet Supabase créé pour ce site (séparé du projet Licorne)
- [ ] Repo GitHub pour le site
- [ ] GitHub Pages activé sur le repo

## Phase 1 — Mise en place du login (objectif court terme)

### 1. Configuration Supabase
- [ ] Créer un nouveau projet Supabase dédié au site vitrine
- [ ] Récupérer `SUPABASE_URL` et `SUPABASE_ANON_KEY` (clé publique, OK dans le code front)
- [ ] Dans **Authentication > Providers** : activer Email
- [ ] Dans **Authentication > Settings** : décider si on autorise l'inscription publique ou si on crée les comptes manuellement
  - Pour un site vitrine fermé : **désactiver les inscriptions publiques**, créer les comptes à la main dans le dashboard
- [ ] Dans **Authentication > URL Configuration** : ajouter l'URL GitHub Pages dans les redirect URLs

### 2. Structure du site
```
/
├── index.html          ← page de connexion (publique)
├── app.html            ← contenu protégé (visible après login)
├── assets/
│   ├── auth.js         ← logique Supabase Auth
│   └── guard.js        ← vérifie la session, redirige si non connecté
└── README.md
```

### 3. Intégration Supabase (CDN, pas de build)
```html
<script type="module">
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
</script>
```

### 4. Logique minimale à implémenter
- [ ] `auth.js` : fonction `signIn(email, password)` + `signOut()`
- [ ] `guard.js` : au chargement de chaque page protégée, vérifier `supabase.auth.getSession()`, rediriger vers `index.html` si null
- [ ] `index.html` : formulaire login + redirection vers `app.html` après succès
- [ ] Bouton "Se déconnecter" sur les pages protégées

### 5. Déploiement
- [ ] Push sur la branche configurée pour GitHub Pages (`main` ou `gh-pages`)
- [ ] Vérifier que l'URL Pages est bien ajoutée dans les redirect URLs Supabase
- [ ] Tester le flow complet en navigation privée

---

## Phase 2 — Section membres (quand le besoin viendra)

### Côté Supabase
- [ ] Créer table `profiles` (id uuid PK = auth.users.id, display_name, role, etc.)
- [ ] Créer trigger qui crée un profil automatiquement à l'inscription
- [ ] Activer RLS sur toutes les tables sensibles
- [ ] Politiques RLS : `auth.uid() = user_id` pour les données personnelles
- [ ] Si rôles : ajouter colonne `role` dans `profiles` et politiques basées dessus

### Côté site
- [ ] Page `/membres` qui charge les données via `supabase.from('...').select()`
- [ ] Page profil utilisateur (modification nom, mot de passe)
- [ ] Si inscriptions ouvertes : page d'inscription + email de confirmation

### Point de bascule potentiel
Si la section membres devient riche (formulaires complexes, contenu personnalisé lourd), envisager une migration vers **Vercel** ou **Netlify** pour avoir des redirections serveur et une meilleure DX. Supabase reste tel quel — pas de refonte.

---

## Limites assumées

- Le HTML de `app.html` est techniquement téléchargeable même sans login (un curieux qui connaît l'URL peut voir le code source). C'est OK tant que le contenu n'est pas sensible.
- Si un jour le contenu devient confidentiel : passer à **Cloudflare Pages + Cloudflare Access** (gratuit jusqu'à 50 utilisateurs) pour bloquer au niveau réseau.

## Décisions ouvertes à valider avant Phase 1

1. Le projet Supabase doit-il être séparé de "Licorne" ou partagé ? (recommandé : séparé)
2. Inscriptions ouvertes au public ou comptes créés manuellement ?
3. Une seule page protégée ou plusieurs ?
4. Contenu en dur dans le HTML ou déjà préparer le chargement depuis Supabase ?

---

*Document de base — à faire évoluer au fil de l'implémentation.*
