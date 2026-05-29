# Handoff — Session de travail 03 mai 2026
## Site Victoria Rixheim — Refactor + Auth Supabase + Déploiement

---

## Prise en main rapide (cold start)

### Accès au repo

- **GitHub** : https://github.com/jgrewis/site-victoria-rixheim
- **Compte GitHub** : `jgrewis` (accès SSH configuré sur la machine de JP)
- **Site en ligne** : https://jgrewis.github.io/site-victoria-rixheim/

### Cloner et démarrer en 3 commandes

```bash
git clone git@github.com:jgrewis/site-victoria-rixheim.git
cd site-victoria-rixheim
python3 -m http.server 8000
# → ouvrir http://localhost:8000/index.html
```

> ⚠️ Les modules ES (`<script type="module">`) ne fonctionnent **pas** en double-cliquant les fichiers (`file://`). Le serveur HTTP est obligatoire.

### Chemin local sur la machine de JP

```
/Users/jeanphilippegrewis/Documents/Claude/Projects/Site Victoria/
```

Si le repo est déjà cloné ici, inutile de re-cloner. Vérifier avec `git status` et `git pull` pour être à jour.

### Workflow d'édition

```bash
# 1. Éditer les fichiers dans assets/css/, assets/js/ ou les .html
# 2. Tester en local sur http://localhost:8000/index.html
# 3. Committer et pousser
git add <fichiers modifiés>
git commit -m "Description du changement"
git push
# → GitHub Pages se redéploie automatiquement en ~1 min
```

Suivre le déploiement : https://github.com/jgrewis/site-victoria-rixheim/actions

### Accès Supabase

- **Dashboard** : https://supabase.com/dashboard/project/giccgdabfwxkgdzzvgva
- **Project ID** : `giccgdabfwxkgdzzvgva`
- **URL** : `https://giccgdabfwxkgdzzvgva.supabase.co`
- **Anon key** (publique, déjà dans le code) : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpY2NnZGFiZnd4a2dkenp2Z3ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3Njg4ODUsImV4cCI6MjA5MzM0NDg4NX0.BlAwLtPESVTF7CRv6Nrqs1VpGgApPqYlOTM7SH3vCrY`
- Gestion des utilisateurs : **Authentication > Users** dans le dashboard
- Modifier un rôle utilisateur via SQL Editor si l'UI ne permet pas l'édition :
  ```sql
  update auth.users
  set raw_user_meta_data = raw_user_meta_data || '{"role": "member"}'::jsonb
  where email = 'adresse@email.com';
  ```

### Fichiers clés à connaître

| Fichier | Rôle | À modifier pour... |
|---|---|---|
| `assets/js/site-data.js` | Source unique de vérité | Changer horaires, téléphone, email, tarifs |
| `assets/css/tokens.css` | Variables CSS (couleurs, typo) | Changer la palette ou la police |
| `assets/css/main.css` | Styles du site vitrine | Modifier le layout, les cartes, la nav |
| `assets/css/auth.css` | Styles login + espace membre | Modifier les pages auth |
| `assets/js/ui.js` | Animations et interactions | Modifier/ajouter des animations |
| `assets/js/guard.js` | Protection des pages | Modifier la logique d'accès par rôle |
| `accueil.html` | Site vitrine | Modifier le contenu public |
| `espace-membre.html` | Espace membre | Modifier le contenu réservé aux membres |
| `index.html` | Page de login | Modifier le formulaire de connexion |

---

## Ce qui a été fait

### Étape 1 — Audit & Refactor du fichier monolithique

**Problèmes identifiés sur `victoria-rixheim.html` (fichier original) :**
- 260 lignes de CSS dans une balise `<style>` inline + styles `style=""` sur certains éléments
- JS inline en bas de page
- Contenu dupliqué : horaires (×3), téléphone (×2), email (×3), tarif découverte (×3), affiliation FFTir (×3)
- Pas de `meta description`, pas de favicon, pas de `aria-label` sur le logo
- Emojis décoratifs sans `aria-hidden="true"`

**Refactor effectué :**
- Extraction CSS → `/assets/css/tokens.css` + `main.css` + `auth.css`
- Extraction JS → `/assets/js/ui.js`
- Source unique de vérité → `/assets/js/site-data.js` (horaires, contact, tarifs, localisation)
- Binding automatique via `data-bind="..."` et `data-bind-href="..."` dans le HTML
- Suppression de `victoria-rixheim.html`, remplacé par la structure ci-dessous

---

### Étape 2 — Architecture 3 pages + Auth double niveau

**Structure finale du projet :**
```
/
├── index.html              ← page de connexion (publique)
├── accueil.html            ← site vitrine (protégé : tout user connecté)
├── espace-membre.html      ← espace membre complet (protégé : role = "member" uniquement)
├── assets/
│   ├── css/
│   │   ├── tokens.css      ← variables CSS + reset
│   │   ├── main.css        ← styles du site vitrine + animations
│   │   └── auth.css        ← login, espace membre, banner brouillon
│   └── js/
│       ├── site-data.js    ← source unique de vérité (horaires, contact…)
│       ├── ui.js           ← nav, scroll, reveal, data-bind, 3 animations
│       ├── supabase.js     ← client Supabase (clés en dur, OK car publiques)
│       ├── auth.js         ← signIn / signOut + redirection selon rôle
│       └── guard.js        ← garde de session sur pages protégées
├── HANDOFF_AUTH_SITE_VITRINE.md   ← handoff technique auth (existant)
├── HANDOFF_SESSION_03-05-2026.md  ← ce fichier
├── README.md               ← guide complet étapes 1 à 4
└── .gitignore
```

**Logique d'auth double niveau (Supabase `user_metadata.role`) :**

| Rôle | Page accessible | Cas d'usage |
|---|---|---|
| `visitor` | `accueil.html` uniquement | Président du club, invités démo |
| `member` | `accueil.html` + `espace-membre.html` | Membres actifs du club |

- Redirection depuis `index.html` : `role === "member"` → `espace-membre.html`, sinon → `accueil.html`
- `guard.js` → `requireAuth()` : redirige vers `index.html` si pas de session
- `guard.js` → `requireAuth('member')` : redirige vers `accueil.html` si role insuffisant

---

### Étape 3 — Setup Supabase

**Projet Supabase créé :**
- Nom : `tir-victoria`
- Project ID : `giccgdabfwxkgdzzvgva`
- URL : `https://giccgdabfwxkgdzzvgva.supabase.co`
- Anon key : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpY2NnZGFiZnd4a2dkenp2Z3ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3Njg4ODUsImV4cCI6MjA5MzM0NDg4NX0.BlAwLtPESVTF7CRv6Nrqs1VpGgApPqYlOTM7SH3vCrY`

**Configuration Supabase :**
- Provider Email activé
- Inscriptions publiques : **désactivées** (comptes créés manuellement)
- Utilisateur créé : `freezer68@gmail.com` avec `role: "member"` (accès complet)
- Le `raw_user_meta_data` a été mis à jour via SQL Editor (le champ n'était pas éditable depuis l'UI) :
  ```sql
  update auth.users
  set raw_user_meta_data = raw_user_meta_data || '{"role": "member"}'::jsonb
  where email = 'freezer68@gmail.com';
  ```

**Redirect URLs autorisées dans Supabase (Authentication > URL Configuration) :**
- `https://jgrewis.github.io/site-victoria-rixheim/**`
- `http://localhost:8000/**`

---

### Étape 4 — Déploiement GitHub Pages

**Repo :** https://github.com/jgrewis/site-victoria-rixheim  
**Site :** https://jgrewis.github.io/site-victoria-rixheim/  
**Branche :** `main` / root  

Déploiement via `gh` CLI :
```bash
gh repo create jgrewis/site-victoria-rixheim --public --source=. --remote=origin --push
gh api -X POST repos/jgrewis/site-victoria-rixheim/pages -f 'source[branch]=main' -f 'source[path]=/'
```

---

### Étape 5 — Audit responsive + Améliorations

**Fixes responsive appliqués :**
- Pills hero (`pill-1/2/3`) : offsets réduits entre 820–1100px (plus de rognes)
- `hero-left` : `padding-bottom` augmenté sur mobile pour dégager les `.hero-stats` absolus
- Page login : `min-height: calc(100svh - 28px)` pour tenir compte du bandeau brouillon

**Améliorations de style :**
- **Balle → cible** : animation périodique (toutes les 3,5s) — balle qui frappe la cible SVG du hero avec onde de choc et impacts persistants (CSS keyframes + JS `Web Animations API`)
- **Compteurs animés** : pills hero (6 disciplines, 15€, 50m) et scores de l'espace membre comptent de 0 à leur valeur au viewport entry (`IntersectionObserver` + `requestAnimationFrame`)
- **Scope hover** : halo rouge radial-gradient qui suit le curseur sur les cartes disciplines (CSS `--mx`/`--my` + JS mousemove)

**Améliorations générales :**
- **Favicon SVG** : cible bleu marine / rouge dans tous les onglets (data URI inline)
- **Open Graph** : `og:title`, `og:description`, `og:url` sur `accueil.html`
- **Espace membre complet** (mockup statique pour la démo) :
  - Section Convocations : 4 événements avec dates, lieux, tags (Obligatoire / Libre / Rentrée)
  - Section Résultats : 4 cards avec scores animés et classements
  - Section Documents : 6 fiches téléchargeables (liens placeholder)

---

## État actuel

| Élément | Statut |
|---|---|
| Refactor HTML/CSS/JS | ✅ Fait |
| Source unique de vérité (site-data.js) | ✅ Fait |
| Page de login | ✅ Opérationnelle |
| Site vitrine protégé (accueil.html) | ✅ Opérationnel |
| Espace membre (maquette) | ✅ Fait — contenu mockup |
| Auth Supabase branchée | ✅ Fonctionnelle |
| Déploiement GitHub Pages | ✅ En ligne |
| Responsive corrigé | ✅ Fait |
| Animations (balle, compteurs, scope) | ✅ Faites |
| Favicon + Open Graph | ✅ Faits |

---

## Ce qu'il reste à faire (suite de projet)

### Court terme
- [ ] Créer le compte `visitor` dans Supabase pour la démo président (email + `role: "visitor"`)
- [ ] Tester le flow complet en navigation privée depuis l'URL GitHub Pages

### Phase 2 — Espace membre réel (quand le club valide)
- [ ] Créer table `profiles` dans Supabase (uuid PK = auth.users.id, display_name, role)
- [ ] Activer RLS sur les tables sensibles
- [ ] Remplacer le contenu mockup de l'espace membre par de vraies données Supabase
- [ ] Brancher les documents sur un vrai storage Supabase (bucket protégé)

### Améliorations futures identifiées
- [ ] Vraie carte Google Maps (adresse précise du stand à confirmer)
- [ ] Image Open Graph 1200×630 (photo du stand ou visuel aux couleurs du club)
- [ ] Mentions légales / RGPD (obligatoire quand formulaire de contact actif)
- [ ] Si contenu vraiment confidentiel : migrer vers Cloudflare Pages + Cloudflare Access (voir HANDOFF_AUTH_SITE_VITRINE.md)

---

## Test local

```bash
cd "/Users/jeanphilippegrewis/Documents/Claude/Projects/Site Victoria"
python3 -m http.server 8000
# → http://localhost:8000/index.html
```

Les modules ES (`<script type="module">`) ne fonctionnent pas en `file://` — le serveur HTTP est obligatoire.

---

## Rappel sécurité

- La clé `anon` Supabase dans le code est **publique par design** — pas de secret à protéger là.
- La clé `service_role` (dashboard Supabase) ne doit **jamais** entrer dans le code front.
- Le HTML/CSS/JS sur GitHub Pages est techniquement téléchargeable — tout contenu confidentiel doit vivre dans Supabase (Auth + RLS), jamais dans le code source.

---

*Handoff généré le 03 mai 2026 — session Claude Code.*
