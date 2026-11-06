# Cuizinote

Application Web (ordinateur et mobile, installable sur l'écran d'accueil) pour :

- gérer une banque de recettes avec photo, étiquettes, note et commentaires ;
- importer une recette et ses valeurs nutritives depuis un lien ;
- tenir une banque d'aliments et scanner des codes-barres (Open Food Facts) ;
- calculer les calories d'une recette à partir de ses ingrédients ;
- suivre l'inventaire du frigo, du congélateur et du garde-manger (alertes d'expiration) ;
- planifier les repas de la semaine avec objectif calorique ;
- générer la liste d'épicerie à partir du planificateur (en ignorant ce qui est déjà en inventaire) ;
- demander des idées de repas à une IA gratuite (Groq) et les ajouter en un clic ;
- suivre son poids (import CSV VeSync) et ses pas (import CSV Samsung Health).

## Pile technique

- Next.js 16 (pages et API) hébergé sur Vercel
- PostgreSQL Neon pour toutes les données, y compris les photos
- lucide-react pour les icônes, CSS en BEM avec variables `:root`

## Sécurité

- Aucune donnée dans le navigateur : pas de localStorage, sessionStorage ni IndexedDB.
- Session : cookie `__Host-` httpOnly, Secure, SameSite=Lax ; seule l'empreinte SHA-256 du jeton est en base.
- Mots de passe hachés avec bcrypt (coût 12), 12 caractères minimum.
- Inscriptions limitées aux courriels listés dans `INSCRIPTIONS_AUTORISEES`.
- Limitation des tentatives (connexion, inscription, IA, imports) stockée en base.
- Protection CSRF : vérification de l'en-tête Origin sur toute requête qui modifie des données.
- CSP stricte avec nonce par requête, HSTS, X-Frame-Options, Permissions-Policy.
- Toutes les requêtes SQL sont paramétrées et filtrées par utilisateur.
- Import par lien protégé contre le SSRF (adresses internes bloquées à chaque redirection, délai et taille plafonnés).
- Photos vérifiées par leurs octets réels (JPEG, PNG, WebP), 2,5 Mo maximum.

## Variables d'environnement

Voir `.env.example`.

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Chaîne de connexion Neon |
| `INSCRIPTIONS_AUTORISEES` | Courriels autorisés à créer un compte, séparés par des virgules |
| `GROQ_API_KEY` | Clé gratuite Groq pour l'assistant (https://console.groq.com/keys) |
| `GROQ_MODELE` | Facultatif, `llama-3.3-70b-versatile` par défaut |

## Démarrage local

```bash
npm install
cp .env.example .env.local   # puis remplir les valeurs
npm run db:migrate          # lit .env.local ou .env
npm run dev
```

## Base de données

Le schéma est dans `sql/schema.sql`. `npm run db:migrate` l'applique ; il peut être relancé sans risque.

## Santé : VeSync et Samsung Health

Ni VeSync ni Samsung Health n'offrent d'API publique accessible depuis un site Web. Cuizinote importe
donc leurs fichiers d'export CSV (instructions dans la page Santé). Les doublons sont mis à jour, jamais dupliqués.
