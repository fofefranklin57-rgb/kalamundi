# 📕 BIBLE KALAMUNDI
### Document de référence maître — la source de vérité du produit

*Créé le 15 juillet 2026. Tout le reste (planification, évolution, code) découle d'ici. À maintenir vivant.*

**Fichiers compagnons :**
- `RECONCEPTION_KALAMUNDI.md` — la réflexion stratégique (les 8 décisions)
- `MEMO_MARKETPLACE_LIVRE.md` — benchmark mondial + concurrence CEMAC
- `PLANIFICATION_KALAMUNDI.md` — feuille de route et backlog
- `EVOLUTION_KALAMUNDI.md` — journal daté de ce qui est fait
- `ERROR_LOG.md` — bugs résolus, à ne pas reproduire

---

## 1. Vision (une phrase)

> **Kalamundi = le lieu unique du livre africain : je lis, j'apprends, je publie, j'achète, je revends, j'emprunte — en FCFA / Mobile Money, même hors ligne.**

« Super-app du livre » pour le **Cameroun + la diaspora d'abord**, puis extension aux autres pays africains **si ça réussit**. On construit **espace par espace**, jamais tout à la fois.

**Sous-marque éducation : « Kalamundi Campus »** (D12 option a) — intégrée maintenant dans l'espace Apprendre, détachable plus tard en PWA dédiée sur le backend partagé.

**Double nature (D13/D14)** : Kalamundi n'est pas qu'une super-app commerciale, c'est aussi une **infrastructure culturelle** — canal de vente des **maisons d'édition** ET **bibliothèque numérique patrimoniale** (« Kalamundi Héritage »), en partenariat avec le MINAC/OIF/UNESCO. Détail : `VISION_EDITEURS_ET_PATRIMOINE.md`.

---

## 2. Ce qui nous distingue (nos douves)

1. **Le vertical éducation** (annales, épreuves, examen simulé, répétiteur) — aucun concurrent local ne l'a.
2. **Mobile Money déjà intégré** (Fapshi) — Añdjeun et les libraires doivent encore le résoudre.
3. **Offline-first** (PWA) — adapté au coût de la data.
4. **Un seul objet central : le Livre**, avec toutes les façons de l'obtenir (lire / acheter / emprunter / occasion) sur une fiche unique.

---

## 3. Les utilisateurs (personas)

| Persona | Besoin | Priorité |
|---|---|---|
| **Étudiant** | Réviser, trouver/revendre manuels pas chers | ⭐ Cœur de cible |
| **Lecteur-plaisir** | Fiction africaine, offline, petit prix | Haute |
| **Auteur** | Être lu et **payé** | Haute |
| **Vendeur particulier** | Vider sa bibliothèque, gagner un peu | Moyenne |
| **Libraire / éditeur** | Écouler du stock via le mobile | Moyenne |
| **École / bibliothèque** | Donner accès à des fonds | B2B (revenu récurrent) |
| **Diaspora** (D11) | Acheter/louer des livres africains ; **offrir un livre/abonnement à un proche resté au pays** (gifting) | Haute (pouvoir d'achat en devises) |
| **Maison d'édition** (D13) | Vendre tout son **catalogue** (numérique + papier) via un canal mobile | Haute (profondeur + légitimité du catalogue) |
| **Institution culturelle / MINAC** (D14) | Numériser, préserver, donner accès au **patrimoine** | Partenaire (financement non commercial) |

---

## 4. Les 6 espaces

| Espace | État | Modèle éco | Difficulté |
|---|---|---|---|
| 📖 **Lire** | Existe (à enrichir : social, confort) | Abonnement + micro-achat | 2 |
| 🎓 **Apprendre** | Existe (la douve) | Abonnement + licences écoles | 1 |
| ✍️ **Publier** | Existe (à professionnaliser : royalties) | Commission ventes | 3 |
| 🛒 **Acheter** | À créer (grand manque n°1) | Marge ventes | 4 |
| 💸 **Vendre / occasion** | À créer (grand manque n°2) | Commission C2C | 5 |
| 🔄 **Emprunter / prêt** | À créer (le plus subtil) | Abonnement institutionnel | 5 |
| 🏛️ **Kalamundi Héritage** (D14) | À créer (mission culturelle) | Public-bien : subventions/partenariats (hors commercial) | 4 |

Principe d'unité : l'utilisateur ne « change pas d'espace », il **agit sur un livre**. La fiche livre affiche toutes les offres disponibles.

---

## 5. Architecture technique (état réel)

- **Frontend** : Vanilla JS SPA (pas Next.js/Flutter — le README public est aspirationnel), pages statiques dans `pages/`, JS dans `assets/js/`.
- **Backend** : Cloudflare Pages Functions (`functions/api/`).
- **DB** : Supabase PostgreSQL — projet `iobieffnaauecyukecds.supabase.co` (**DIFFÉRENT d'ImmoGest**).
- **Storage** : Supabase Storage, buckets `couvertures`, `oeuvres-privees`.
- **Paiement** : Fapshi (Mobile Money) — `fapshi-pay.js`, `fapshi-webhook.js`. ⚠️ **Diaspora (D11)** : prévoir en plus un **paiement international** (cartes/PayPal) + **multi-devises** (EUR/USD/FCFA) + **gifting** (offrir un livre livré à un proche au pays).
- **Cron** : Cloudflare Worker `kalamundi-cron` (publication programmée, `0 * * * *`).
- **PWA** : Service Worker `sw.js` (`kala-v9`), offline-first, cache-first assets.
- **Lecture actuelle** : `pdfjs-dist` présent → contenu servi en **PDF** + contenu sérialisé en base. ⚠️ *Le PDF est mal adapté au mobile — voir décision format §8.*
- **IA** : `ANTHROPIC_API_KEY` configurée (corrigés IA, génération couverture) → base pour un « libraire IA ».
- **Deploy** : Cloudflare Pages, auto sur push GitHub `fofefranklin57-rgb/kalamundi`.
- **i18n** : FR / EN.

**Credentials & secrets** : NE JAMAIS écrire les clés dans ce dépôt. Elles vivent dans les **secrets Cloudflare Pages** et `.env.example` (gabarit). Voir la mémoire projet locale pour la liste. *(Sécurité : ce fichier peut finir sur GitHub public.)*

---

## 6. Modèle de données — cible (à valider)

Décision structurante (RECONCEPTION §6) : viser le modèle **Livre + Offres**.

- **Livre** (abstrait) : titre, auteur(s), langue, couverture, description, tags, ISBN si applicable.
- **Éditions / formats** : sérialisé natif, ePub, audio, papier.
- **Offres** attachées à un livre : offre-lecture (abonnement), offre-achat-numérique, offre-papier, offres-occasion (par vendeur), offre-prêt (accès temporel).
- L'**Œuvre** actuelle (contenu sérialisé écrit sur la plateforme) devient un **cas particulier** de Livre.

Introduction **progressive** pour ne pas casser l'existant.

---

## 7. Règles métier (à compléter au fil de l'eau)

- Ne JAMAIS confondre les credentials Kalamundi et ImmoGest (projets Supabase différents).
- La refonte commerce vient **au-dessus** de l'existant, jamais à la place (l'éducation et les abonnements financent déjà).
- Migrations versionnées `migrations/V00X__*.sql` uniquement — jamais de SQL direct en prod.
- Un espace se livre **seul** et rapporte avant d'ouvrir le suivant.

---

## 8. Décision format de lecture — EPUB & lecteur type Thorium

**Constat :** aujourd'hui = PDF (via `pdfjs-dist`). Le PDF est à taille fixe → mauvaise expérience sur téléphone (zoom, pas de reflow, pas de thème nuit, accessibilité faible).

**Orientation retenue (à confirmer) :** adopter **EPUB** comme format canonique des « vrais livres » + un **lecteur web de type Thorium**.

- Thorium Reader lui-même est une **app de bureau** (EDRLab, basée sur **Readium**) → non embarquable telle quelle dans une web-app.
- Mais on peut obtenir une **expérience équivalente dans le navigateur** avec la même famille standard : **Readium Web Toolkit**, ou `foliate-js`, ou `epub.js`.
- **Argument stratégique fort** : l'écosystème **Readium** fournit **LCP** (Licensed Content Protection), le standard des **bibliothèques pour le prêt à durée limitée** → c'est exactement la brique dont l'**espace Emprunter** a besoin. Choisir EPUB+Readium, c'est préparer le prêt en même temps que le confort de lecture.

**Nuance importante — ne pas EXIGER l'EPUB de façon exclusive :**
- Le modèle actuel = l'auteur **écrit** des chapitres dans l'app (barrière faible = beaucoup d'auteurs). Exiger un fichier EPUB **relèverait la barrière** (peu d'auteurs savent en fabriquer) — c'est ce qui fait la force de Bibook/Okada (« upload et vends »).
- **Solution recommandée** : modèle **double** →
  1. **Contenu sérialisé natif** conservé (web-novel, faible barrière) — lecteur actuel amélioré.
  2. **Upload EPUB** pour les livres finis / le commerce / le prêt — nouveau lecteur web Readium.
  3. Accepter **Word/PDF** et **convertir en EPUB côté serveur** → on garde la barrière basse ET on gagne les bénéfices EPUB.

### 8.1 Le convertisseur, « égalisateur »
On accepte **tous les formats** (éditeur natif, Word, PDF, EPUB). À l'ingestion, on **normalise tout dans un modèle interne unique : des chapitres (titre + contenu)**. Chaque livre est stocké **deux fois, liés** :
1. l'**EPUB** (lecteur premium, commerce, prêt) ;
2. les **chapitres normalisés** (traduction, annotations, progression, recherche).
→ Le reste de l'app (dont la traduction) ne voit aucune différence selon le format d'origine.

### 8.2 Traduction préservée (voir `assets/js/translate.js`)
La traduction opère **par chapitre** (`traduire(chapitreId, contenu, langueCible, langueSource)`), avec cache Supabase par chapitre+langue. Elle continue de fonctionner tant que la normalisation §8.1 fournit un `chapitreId` stable + un contenu. **Deux vigilances :**
- **Balisage** : ne pas envoyer le HTML brut au traducteur (casse les balises) → traduire les **nœuds de texte** / extraire le texte propre.
- **Langue source** : le code met `langueSource='fr'` par défaut → la **langue originale doit être déclarée** (et lue depuis l'EPUB), sinon traduction fausse.

### 8.3 Checklist de dépôt auteur (bloque la publication si incomplet)
Obligatoire : **Titre**, **Langue originale** (sert à l'EPUB *et* à la traduction), **Auteur**, **Couverture** (ou générée par l'IA existante), **Chapitres titrés en ordre**, **Description**.
Optionnel : ISBN (sinon identifiant unique généré), tags, éditeur, date, licence/droits.
Difficulté d'entrée par format : **EPUB** (direct) > **Word** (styles de titre = chapitres) > **PDF** (maillon faible : extraction bruitée, OCR si scanné → relecture auteur obligatoire).
Sortie validée par **epubcheck** avant publication.

→ Voir décision **D9** dans `PLANIFICATION_KALAMUNDI.md`.

---

## 10. Direction design (refonte visuelle)

**Diagnostic :** le CSS est bien architecturé (tokens dans `base.css`, composants BEM dans `components.css`, 3 thèmes light/dark/sepia, focus accessibles). Le « vieux jeu » vient de l'application, pas de la structure → **reskin au niveau des tokens**, pas de réécriture.

**Ce qui date (à corriger) :**
1. Typo `Calibri`/`Segoe UI` sans webfont (n°1) → sans personnalité.
2. `--border-color: #A8D5B5` (vert visible) sur tout → look « carte 2014 ».
3. Boutons `border: 2px solid`.
4. Vert en aplats → effet institutionnel.
5. Arrondis petits/inégaux ; pas de skeletons ni micro-interactions.

**Direction retenue (mockup validé le 15/07/2026) :**
- **Typographie de marque** : *Fraunces* (serif) pour les titres + *Inter* pour l'UI (auto-hébergées, sous-ensemblées, `font-display:swap`).
- **Base crème chaude** (`#FBF8F2`), **zéro bordure verte** : séparation par l'espace + ombres douces + fonds teintés ; `--border-color` devient un neutre quasi invisible.
- **Vert + or en accents/dégradés subtils**, plus en aplats.
- **Arrondis 12–16px cohérents**, boutons pleins sans bordure 2px, skeletons de chargement, transitions fluides.
- Migration progressive `px → rem`.

**Réorganisation (architecture d'information) :**
- **Mobile-first : barre d'onglets basse** — Accueil · Explorer · Apprendre · Biblio · Profil (remplace les ~24 pages en silos).
- **Home en rails de merchandising** (façon Kobo).
- **Carte/fiche livre unifiée** : affiche toutes les façons d'obtenir le livre (lire / acheter / emprunter / occasion) — c'est l'ADN « super-app ».
- Shell de page cohérent (en-tête, largeurs de conteneur).

**Atout clé :** tout passant par les variables CSS, changer ~15 tokens transforme toute l'app d'un coup → gros effet, faible coût.

---

## 9. Concurrence (rappel — détail dans MEMO §9)

Tous mono-modèle. Menace n°1 : **Añdjeun** (ITGStore, Douala, mai 2026, bibliothèque panafricaine). Aucun ne combine tout + Mobile Money. Leçon **Okadabooks** (fermé 2023) : ne pas dépendre de la seule vente d'eBooks → diversifier.
