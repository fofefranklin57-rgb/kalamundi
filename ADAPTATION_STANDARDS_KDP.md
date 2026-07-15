# 📐 ADAPTATION AUX STANDARDS DES GRANDES PLATEFORMES
### Hisser la publication Kalamundi au niveau d'Amazon KDP, Kobo, Google Play & Apple Books

*Créé le 15 juillet 2026. Objectif : que publier sur Kalamundi respecte les mêmes standards professionnels que les grandes plateformes — formats, métadonnées, royalties transparentes, qualité — adaptés au FCFA / Mobile Money et à l'Afrique. On **adopte leurs standards**, on ne distribue pas (encore) vers eux.*

Compagnons : `BIBLE_KALAMUNDI.md` (§6 données, §8 format), `PLANIFICATION_KALAMUNDI.md`, `MEMO_MARKETPLACE_LIVRE.md`.

---

## 1. Tableau maître — standard → adoption Kalamundi

| Domaine | Référence (KDP / Kobo / Apple) | Ce que Kalamundi adopte |
|---|---|---|
| **Format ebook** | EPUB reflowable (aussi DOCX/KPF chez KDP) | **EPUB canonique** + convertisseur Word/PDF→EPUB (décision D9), validé **epubcheck** |
| **Métadonnées** | Titre, sous-titre, série, contributeurs, description ≤4000, 2 catégories BISAC, 7 mots-clés, langue, ISBN | Schéma métadonnées standard complet (§3) |
| **Couverture** | ~1,6:1, 2560×1600 px, min 1000 px côté long, JPEG | Standard couverture (§4), générateur IA existant conforme |
| **Identifiant** | ISBN (offert pour le papier) / ASIN interne pour ebook | ISBN Cameroun si dispo, sinon **ID Kalamundi unique** (§7) |
| **Royalties** | Ebook 70 % (2,99–9,99 $) ou 35 % ; papier ~60 % ; KU à la page lue | **Grille royalties FCFA transparente** + rémunération à la page lue en abonnement (§5) |
| **Prix** | Prix catalogue avec min/max selon palier | Prix en **FCFA**, gratuit autorisé, seuils par palier (§5) |
| **Exclusivité** | KDP Select (exclusif → +royalties, inclusion KU) | Option **« Kalamundi Select »** (§5.3) |
| **Qualité** | Aperçu obligatoire, métadonnées exactes, pas de contenu trompeur | **Barème qualité + preview + checklist** (§6) |
| **Workflow** | Brouillon → révision → publication (~72 h) | Draft → révision → publication (§6) |
| **Droits/territoires** | Mondial ou territoires choisis | Mondial ou **CEMAC/Afrique** au choix |
| **Reporting auteur** | Ventes, pages lues (KENP), redevances, paiements | **Dashboard auteur niveau KDP** (§8) |
| **Print-on-demand** | Impression à la demande + expédition | **Reporté** (dépend logistique — §9) |

---

## 2. Principe directeur

Un livre publié sur Kalamundi doit être **aussi propre** qu'un livre KDP : fichier valide, métadonnées complètes, couverture aux normes, prix et royalties clairs. Mais **adapté** : monnaie FCFA, paiement Mobile Money, barrière d'entrée basse (conversion automatique), et pensé mobile/offline.

---

## 3. Schéma de métadonnées standard (à implémenter)

Aligné sur l'industrie (ONIX/KDP). Champs **obligatoires** en gras.

- **Titre** · Sous-titre · Série + numéro
- **Contributeurs** : **Auteur** (au moins un), co-auteur, **traducteur**, illustrateur, préface…
- **Langue originale** (obligatoire — sert aussi à la traduction, cf. BIBLE §8.2)
- **Description** (≤ 4000 caractères, HTML simple autorisé)
- **Catégories** : 1 à 2, référentiel type BISAC (adapter un référentiel FR/Afrique)
- **Mots-clés** : jusqu'à 7
- **Couverture** (§4)
- **Identifiant** : ISBN ou ID Kalamundi (§7)
- **Édition / format** : sérialisé natif · EPUB · audio · papier
- **Date de publication** · Éditeur (optionnel, défaut « Auto-édition »)
- **Public** : tout public / ado / adulte (contrôle contenu)
- **Droits & territoires** : mondial / CEMAC / pays choisis
- **DRM / protection** : optionnel (pour le prêt → Readium LCP)

> Règle : la publication est **bloquée** tant que les champs obligatoires ne sont pas remplis (= la checklist de dépôt auteur, BIBLE §8.3).

---

## 4. Standards de fichier & couverture

**EPUB** : EPUB 3, valide epubcheck, images optimisées (offline/data), table des matières (nav), langue déclarée.
**Couverture** : ratio **1,6:1** (hauteur/largeur), cible **1600×2560 px**, min 1000 px côté long, JPEG/PNG, < 5 Mo, texte lisible en vignette. Le générateur de couverture IA existant (`cover-generator.js`) doit produire ce ratio.
**Audio** (plus tard) : chapitres, qualité mini, durée.

---

## 5. Royalties — grille transparente (le vrai aimant à auteurs)

La transparence des royalties est ce qui attire les auteurs sur KDP et Bibook. Proposition Kalamundi (à valider — **D10**) :

### 5.1 Vente à l'unité (achat direct)
✅ **Décidé (Franklin, 15/07/2026) : 50/50.**
| Palier | Condition | Royalté auteur | Part Kalamundi |
|---|---|---|---|
| **Standard** | tout prix | **50 %** | 50 % (héberge frais Fapshi + plateforme) |
| **Select** *(en réserve, à confirmer)* | exclusivité Kalamundi (§5.3) | 70 % | 30 % |

*(Repères : KDP 35 %/70 % ; Bibook 30 %→50 %. 50/50 retenu : généreux, lisible, cohérent avec l'existant « 50 % à l'auteur ». L'option Select 70 % reste proposée mais non actée.)*

### 5.2 Lecture en abonnement (analogue Kindle Unlimited / KENP)
- L'auteur est payé **à la page (ou au chapitre) lu(e)** depuis un **fonds mensuel** partagé, au prorata de la lecture totale.
- Nécessite de mesurer les **pages/chapitres lus** (le lecteur suit déjà la progression → base existante).

### 5.3 « Kalamundi Select » (analogue KDP Select)
- L'auteur choisit l'**exclusivité** (le livre n'est vendu que sur Kalamundi) →
  - royalté **70 %** au lieu de 50 %,
  - inclusion dans l'**abonnement** (donc revenus à la page lue),
  - mise en avant merchandising.
- Non exclusif = 50 %, pas d'inclusion abonnement.

### 5.4 Prix
- En **FCFA**, gratuit autorisé, seuil mini pour les paliers payants (ex. 100 FCFA), pas de plafond.

---

## 6. Barème qualité & workflow de publication

**Workflow** : `Brouillon → Révision → Publié` (statuts déjà proches de l'existant `publication programmée`).
1. **Dépôt** : upload (tout format) → conversion EPUB → chapitres normalisés.
2. **Checklist obligatoire** remplie (métadonnées §3).
3. **Aperçu obligatoire** : l'auteur relit le rendu (surtout si source PDF — qualité moindre).
4. **Validation epubcheck** automatique.
5. **Modération** : contenu (public, légalité, non-plagiat), métadonnées exactes.
6. **Publication** (immédiate ou programmée).

**Barème qualité (refus si non respecté)** : fichier invalide, métadonnées trompeuses, couverture hors normes, contenu illégal/plagié, description vide.

---

## 7. Identifiants

- **ISBN** : si l'auteur en a un (agence ISBN Cameroun), on le stocke.
- Sinon **ID Kalamundi unique** (analogue ASIN) généré à la publication — sert de clé produit dans tout le commerce et le catalogue.
- Objectif moyen terme : devenir **point d'attribution ISBN** local (partenariat agence nationale).

---

## 8. Reporting auteur (niveau KDP)

Le dashboard auteur (`author-dashboard`) doit afficher, façon KDP :
- Ventes (nombre, montant, par titre, par période).
- **Pages/chapitres lus** en abonnement (analogue KENP) + estimation du gain fonds.
- Redevances cumulées, seuil de paiement, **historique des payouts Mobile Money**.
- Suivis, ajouts « à lire », notes/avis, taux de complétion.

---

## 9. Ce qu'on N'adopte PAS tout de suite (et pourquoi)

- **Print-on-demand** (papier imprimé à la commande) : dépend d'un partenaire d'impression + logistique → **après** l'espace Acheter numérique (cf. PLANIFICATION Phase 2/3).
- **Distribution externe** vers KDP/Kobo/Apple (modèle agrégateur) : hors périmètre actuel — mais les standards adoptés ici (EPUB, ISBN, métadonnées) en sont **le prérequis**, donc on ne se ferme pas la porte.

---

## 10. Impact sur le code existant

- `pages/publish.html` + `assets/js/publish.js` : refondre le formulaire → schéma métadonnées complet + checklist bloquante + upload multi-format.
- `assets/js/cover-generator.js` : imposer le ratio 1,6:1 et la résolution mini.
- `pages/author-dashboard.html` + `.js` : reporting niveau KDP (ventes + pages lues + payouts).
- `pages/contrat-auteur.html` : intégrer les paliers royalties + l'option « Kalamundi Select » (exclusivité).
- `migrations/` : nouvelles tables/colonnes (métadonnées étendues, identifiants, paliers royalties, mesure des pages lues) — versionnées `V0XX__*.sql`.

---

## 11. Décision à trancher
- **D10 — Grille de royalties** : valider 50 % standard / 70 % Select + rémunération à la page lue en abonnement ? Ajuster les taux ?
