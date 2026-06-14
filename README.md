# Site Victoria Rixheim

Site vitrine du Club de Tir Victoria Rixheim. Statique, hébergé sur **GitHub Pages**, protégé par **Supabase Auth**.

> ⚠️ Brouillon — version de démonstration destinée au président du club. Pas encore le site public officiel.

## Structure

```
/
├── index.html              ← page de connexion (publique)
├── accueil.html            ← site vitrine (protégé : tout user connecté)
├── espace-membre.html      ← espace réservé (protégé : role = "member")
├── assets/
│   ├── css/
│   │   ├── tokens.css      ← variables, reset
│   │   ├── main.css        ← styles du site vitrine
│   │   └── auth.css        ← styles login + espace membre
│   └── js/
│       ├── site-data.js    ← source unique de vérité (horaires, contact…)
│       ├── ui.js           ← nav, scroll, reveal, data binding
│       ├── supabase.js     ← client Supabase (TODO clés)
│       ├── auth.js         ← logique signIn / signOut
│       └── guard.js        ← garde de session sur pages protégées
├── HANDOFF_AUTH_SITE_VITRINE.md
└── README.md
```

## Avancement

- [x] **Étape 1** — Refactor : extraction CSS/JS, dédoublonnage, 3 pages prêtes
- [ ] **Étape 2** — Setup Supabase (manuel, voir ci-dessous)
- [ ] **Étape 3** — Branchement Auth (remplacer les `TODO` dans `supabase.js`, `auth.js`, `guard.js`)
- [ ] **Étape 4** — Déploiement GitHub Pages

## Étape 2 — À faire dans Supabase

1. Créer un projet Supabase dédié (séparé du projet Licorne).
2. **Authentication > Providers** : activer **Email**.
3. **Authentication > Settings** : **désactiver** les inscriptions publiques.
4. **Authentication > Users > Add user** — créer 2 comptes manuellement :
   - Compte "visiteur" (président) — dans **User Metadata** (raw JSON) :
     ```json
     { "role": "visitor" }
     ```
   - Compte "membre" (démo espace membre) — dans **User Metadata** :
     ```json
     { "role": "member" }
     ```
5. **Authentication > URL Configuration** : ajouter l'URL GitHub Pages dans les redirect URLs (ex. `https://<user>.github.io/<repo>/`).
6. Récupérer **Project URL** et **anon public key** (dans Settings > API), et les coller dans `assets/js/supabase.js`.

## Étape 3 — Branchement (à faire après l'étape 2)

Dans `assets/js/supabase.js`, `auth.js` et `guard.js`, remplacer les blocs `// TODO Étape 3` par les vraies lignes Supabase indiquées en commentaire.

Logique de redirection :
- **`index.html`** : login → si `role === "member"` → `espace-membre.html`, sinon → `accueil.html`
- **`accueil.html`** (`requireAuth()`) : si pas de session → redirige vers `index.html`
- **`espace-membre.html`** (`requireAuth('member')`) : si pas connecté → `index.html` ; si connecté mais pas membre → `accueil.html`

## Étape 4 — Déploiement GitHub Pages

```bash
git init
git add .
git commit -m "Init site Victoria"
git branch -M main
git remote add origin git@github.com:<user>/<repo>.git
git push -u origin main
```

Puis sur GitHub : **Settings > Pages > Source = main / root**. Vérifier que l'URL est bien autorisée dans Supabase (étape 2.5).

## Galerie photo — configuration Supabase Storage

La galerie (section `#galerie` de `accueil.html`) et le formulaire d'ajout de photo (`espace-membre.html`) lisent/écrivent dans un bucket Supabase Storage nommé **`galerie`**. À créer manuellement dans le dashboard Supabase :

1. **Storage > Buckets > New bucket** : nom `galerie`, cocher **Public bucket** (pour que `getPublicUrl` fonctionne et que les images s'affichent sur le site).
2. **Storage > Policies** sur le bucket `galerie` :
   - Lecture (`SELECT`) : autorisée pour tous (`anon` + `authenticated`) — nécessaire car le bucket est public.
   - Ajout (`INSERT`) : autorisé uniquement pour `authenticated` (les membres connectés via le formulaire d'ajout de photo).
3. Aucune clé supplémentaire à coller dans le code : le client `assets/js/supabase.js` existant est réutilisé.

Une fois le bucket créé, toute photo ajoutée via l'espace membre apparaît automatiquement dans la galerie publique.

## Test en local

Il faut un serveur HTTP (les modules ES ne marchent pas avec `file://`). Le plus simple :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000/index.html
```

## Limites de sécurité (rappel handoff)

Le HTML/CSS/JS est **toujours téléchargeable publiquement** sur GitHub Pages. La protection Auth empêche un visiteur lambda de tomber sur le site, mais quelqu'un qui connaît l'URL du repo pourra lire le code source. C'est OK pour un brouillon non sensible. Tout ce qui devra être confidentiel (données membres, etc.) devra vivre dans Supabase, jamais dans le code source.
