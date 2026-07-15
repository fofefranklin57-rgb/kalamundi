# AGENTS.md — Règles de travail sur Kalamundi
### À LIRE EN PREMIER par tout agent (Codex, Claude, autre) avant d'écrire une seule ligne

Kalamundi = **super-app du livre africain** (lire · apprendre · publier · acheter · vendre · emprunter), Cameroun + diaspora d'abord. Ce fichier est **impératif** : il prime sur toute habitude par défaut.

---

## 1. ⛔ RÈGLE D'OR — La documentation d'abord

**Avant toute modification, lire la documentation nécessaire dans le dossier.** Ne jamais coder « de mémoire » ou en devinant l'intention.

| Fichier | À lire pour… |
|---|---|
| `BIBLE_KALAMUNDI.md` | **La référence maître** : vision, personas, 6 espaces, archi réelle, modèle de données, règles métier, direction design (§10) |
| `PLANIFICATION_KALAMUNDI.md` | Les **décisions validées (D0–D12)** et la feuille de route par phases. **Ne rien faire qui contredise une décision validée.** |
| `RECONCEPTION_KALAMUNDI.md` | Le raisonnement stratégique derrière les choix |
| `ADAPTATION_STANDARDS_KDP.md` | Standards de publication (EPUB, métadonnées, royalties **50/50**, reporting auteur) |
| `PROPOSITION_EDUCATION.md` | Stratégie éducation = sous-marque **« Kalamundi Campus »** (intégrée, séparable plus tard) |
| `DESIGN_SYSTEM_KALAMUNDI.md` | **Les nouveaux tokens exacts** à appliquer dans `base.css` (couleurs, typo, rayons, composants) |
| `INTERFACES_KALAMUNDI.md` | **Inventaire de tous les écrans** par rôle + priorité de modernisation |
| `MEMO_MARKETPLACE_LIVRE.md` | Benchmark mondial + concurrence CEMAC |
| `ERROR_LOG.md` | Bugs déjà résolus — **ne pas les reproduire** |

Si une tâche n'est pas couverte par la doc, **demander / documenter d'abord**, coder ensuite.

---

## 2. 📝 Journalisation OBLIGATOIRE (à chaque intervention)

1. **Toute évolution significative** (fonctionnalité, décision, correctif majeur) → une entrée dans **`EVOLUTION_KALAMUNDI.md`**, datée, la plus récente en haut. **Jamais en lot rétroactif** — on note au moment où on fait.
2. **Tout bug corrigé** → une entrée dans **`ERROR_LOG.md`** (format : Symptôme / Cause / Correctif / Fichiers / Leçon), **dans le même commit que la correction**, jamais en lot.
3. **Toute décision produit tranchée** → mettre à jour le tableau des décisions de `PLANIFICATION_KALAMUNDI.md`.

Ces trois réflexes ne sont pas optionnels.

---

## 3. 🎨 Design & interfaces (moderniser)

- **Objectif : moderniser toutes les interfaces clés** — auteur (dashboard, publication), lecteur, boutique, éducation.
- Suivre la **direction design de `BIBLE §10`** : typo de marque **Fraunces (titres) + Inter (UI)**, **base crème** `#FBF8F2`, **plus de bordures vertes** (séparer par l'espace/l'ombre), arrondis 12–16px, boutons pleins, skeletons de chargement.
- **Toujours passer par les variables CSS** de `assets/css/base.css` (jamais de couleur hardcodée). Réutiliser les composants BEM de `components.css`.
- Conserver les 3 thèmes (light/dark/sepia) et l'accessibilité (focus-visible).
- Mobile-first : viser la nav à onglets + la **fiche livre unifiée** (toutes les offres : lire/acheter/emprunter/occasion).

---

## 4. 🧱 Règles de code

- **Migrations DB versionnées uniquement** : `migrations/V0XX__description.sql`. Jamais de SQL direct en prod.
- **Secrets** : jamais en dur dans le dépôt (peut être public). Ils vivent dans les secrets Cloudflare Pages / `.env.example`.
- Opérations sensibles (suppression, écriture privilégiée) → **Pages Function serveur** (clé service), jamais côté client soumis au RLS (cf. `ERROR_LOG` 2026-06-23).
- **PWA** : si des assets changent, bumper la version du Service Worker (`sw.js`, `kala-vX`).
- **Format contenu (D9)** : accepter tous formats → convertisseur qui normalise en **chapitres internes** + build **EPUB** (valider epubcheck). La traduction opère par chapitre → préserver un `chapitreId` stable et traduire les **nœuds de texte** (pas le HTML brut) ; lire la **langue source** depuis les métadonnées.

---

## 5. 💰 Règles métier à respecter

- **Ne pas casser ce qui gagne déjà de l'argent** : l'éducation et les abonnements financent la structure ; le commerce vient **au-dessus**, jamais à la place.
- **Royalties = 50/50** (50 % auteur). Option « Kalamundi Select » 70 % en réserve, non actée.
- **Un espace se livre seul** et rapporte avant d'ouvrir le suivant (ordre : enrichir l'existant → Acheter numérique → Vendre occasion → Emprunter).
- **Diaspora (D11)** : prévoir paiement international (cartes/PayPal) + multi-devises (EUR/USD/FCFA) + gifting, en plus de Fapshi/Mobile Money.

---

## 6. ⚠️ Ne jamais confondre les projets

Kalamundi ≠ ImmoGest. Backends Supabase **différents** : Kalamundi = `iobieffnaauecyukecds.supabase.co`. Ne jamais mélanger les credentials, tables ou déploiements des deux projets.

---

## 7. Rappel de commit

Format : `type: description courte` (feat / fix / refactor / docs / style). Un commit de correction **doit** inclure la mise à jour d'`ERROR_LOG.md`.
