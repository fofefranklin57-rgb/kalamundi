# 🗺️ PLANIFICATION KALAMUNDI
### Feuille de route, décisions et backlog

*Créé le 15 juillet 2026. Source : `BIBLE_KALAMUNDI.md` + `RECONCEPTION_KALAMUNDI.md`.*
*Règle : on met à jour ce fichier à chaque décision tranchée ou tâche terminée — jamais en lot.*

---

## A. Décisions stratégiques (à trancher AVANT de coder)

Statut : ✅ tranché · 🟡 proposé (attente Franklin) · ⬜ ouvert

| # | Décision | Reco Claude | Statut |
|---|---|---|---|
| D0 | Vision « super-app du livre », construite espace par espace | Oui | 🟡 |
| D1 | Persona cœur = **l'étudiant** | Oui | 🟡 |
| D2 | **Numérique d'abord**, papier en pilote plus tard | Oui | 🟡 |
| D3 | Modèle de données **Livre + Offres** (progressif) | Oui | 🟡 |
| D4 | Paiement : **Fapshi à chaque acte** d'abord, « Pièces » plus tard | Oui | 🟡 |
| D5 | Périmètre : **Cameroun + diaspora d'abord**, puis extension aux autres pays africains si ça réussit | Oui | ✅ **validé** |
| D6 | Prêt limité d'abord à **notre fonds d'auteurs** | Oui | 🟡 |
| D7 | C2C occasion : garder dans la vision, **faire en dernier** | Oui | 🟡 |
| **D9** | **Format : accepter TOUS formats → convertisseur normalise en chapitres internes + build EPUB canonique ; lecteur web Readium ; traduction préservée via normalisation ; checklist dépôt auteur (langue orig. obligatoire) ; validation epubcheck** | Oui | ✅ **validé par Franklin** |
| **D10** | **Standards publication (réf. KDP) : EPUB + métadonnées ONIX-like + couverture 1,6:1 + reporting auteur niveau KDP.** Royalties = **50/50** (50 % auteur / 50 % plateforme) — détail dans `ADAPTATION_STANDARDS_KDP.md` | 50/50 | ✅ **validé (50/50)** — option « Select » 70 % gardée en réserve, à confirmer |
| **D11** | **Diaspora** : ouvrir achat/location à la diaspora → **paiement international** (cartes/PayPal) + **multi-devises** (EUR/USD/FCFA) + pattern **gifting** (acheter/offrir un livre livré à un proche au pays) | Oui | ✅ **acté par Franklin** (mise en œuvre à cadrer) |
| **D12** | **Stratégie éducation** : option **(a)** — intégré maintenant, séparable plus tard en PWA dédiée **« Kalamundi Campus »** sur backend partagé — détail dans `PROPOSITION_EDUCATION.md` | (a) | ✅ **validé** (nom « Kalamundi Campus » retenu) |
| **D13** | **Canal maisons d'édition** : comptes catalogue + ingestion **ONIX**/EPUB + revenus **négociés** (≠ 50/50 auteur) ; onboarding via collectifs (African Books Collective, OAPE, Alliance) — détail `VISION_EDITEURS_ET_PATRIMOINE.md` | Oui, Phase 2/3 | ✅ **acté** (mise en œuvre à cadrer) |
| **D14** | **Mission culturelle / bibliothèque numérique** : Fonds patrimoine **« Kalamundi Héritage »** (accès public-bien, distinct du commercial) + **partenariat MINAC/OIF/UNESCO** ; mené en parallèle, sans détourner le socle | Oui | ✅ **acté** (partenariats à initier) |

*(D8 réservé.) Tant que ces lignes sont 🟡, on ne descend pas vers les specs techniques.*

---

## B. Feuille de route par phases

Chaque phase est **livrable seule** et rapporte avant la suivante. Jamais 3 chantiers en parallèle.

### Phase 0 — Socle conceptuel *(en cours)*
- [x] Audit de l'existant
- [x] Benchmark mondial + concurrence CEMAC (`MEMO`)
- [x] Document de reconception (`RECONCEPTION`)
- [x] Bible + Planification + Évolution + Journal d'erreurs
- [ ] Validation des décisions D0–D9 par Franklin
- [ ] Architecture d'information détaillée (navigation, fiche livre unifiée)
- [ ] Modèle de données cible (schéma Livre / Offre / Édition)

### Phase 1 — Enrichir l'existant (peu risqué, gros effet)
> 🎨 **Priorité transverse : moderniser TOUTES les interfaces clés** — auteur (dashboard, publication), lecteur (confort de lecture), boutique, éducation. Cf. direction design `BIBLE §10`.
- [x] **Reskin design (tokens)** — ✅ Codex 16/07 (`464131e`) : webfonts Fraunces/Inter auto-hébergées, base crème `#FBF8F2`, bordures neutres `#E7E0D2`, rayons/ombres, composants adoucis, SW `kala-v10`
- [x] **Interface AUTEUR modernisée** — ✅ Codex 16/07 (`kala-v15`) : dashboard standard auteur + formulaire publication modernisé (cockpit qualité, résumé obligatoire, validation fichier, royalties 50/50 visibles, rappel couverture 1,6:1)
- [x] **Interface LECTEUR modernisée** : offline soigné ✅ Codex 16/07 (`f43ddee`, biblio locale + démarrage IndexedDB) ; lecteur premium ✅ Codex 16/07 (polices de lecture, thèmes robustes, repagination des réglages, surlignage/note exposés)
- [x] **Shell mobile** — ✅ Codex 16/07 (`a28a36d`) : barre d'onglets basse (Accueil · Explorer · Apprendre · Biblio · Profil), SW `kala-v11`
- [ ] **Home en rails de merchandising** + carte/fiche livre unifiée (offres lire/acheter/emprunter/occasion) — *entrée Campus ajoutée (`fa8ff9b`), rails commerce pas encore*
- [x] Lecteur premium (réglages typo, thèmes jour/nuit/sépia, surlignage couleur) — ✅ Codex 16/07, SW `kala-v14`
- [ ] **Lecteur EPUB web** (Readium/foliate-js) en parallèle du lecteur actuel
- [ ] **Convertisseur « égalisateur »** : Word/PDF/EPUB → chapitres normalisés + build EPUB (epubcheck), avec relecture auteur pour le PDF
- [ ] Checklist de dépôt auteur (langue originale obligatoire) au formulaire de publication
- [ ] Traduction : traiter les nœuds de texte + lire la langue source depuis les métadonnées
- [ ] Couche sociale : notes, avis, étagères « à lire », stats à la Wattpad
- [ ] Publier : royalties transparentes côté auteur
- [ ] **Standards KDP** : formulaire de publication au schéma métadonnées complet (§3 `ADAPTATION_STANDARDS_KDP.md`) + checklist bloquante + couverture 1,6:1
- [ ] **Reporting auteur niveau KDP** : ventes + pages lues (analogue KENP) + payouts Mobile Money
- [ ] Option **« Kalamundi Select »** (exclusivité → 70 % + inclusion abonnement)

### Phase 2 — Espace Acheter (numérique, sans logistique)
- [ ] Entité Livre/produit + offres
- [ ] Panier + checkout multi-articles (Fapshi)
- [ ] Store à rails (nouveautés, promos, catégories), prix FCFA barré/soldé
- [ ] Historique de commandes, bibliothèque achetée

### Phase 3 — Espace Vendre / occasion (le plus dur)
- [ ] Listing vendeur (scan ISBN, état, photos, prix)
- [ ] Profil + notes vendeur
- [ ] Escrow + payout Mobile Money + commission
- [ ] Logistique v1 (main propre géolocalisée / points relais, COD) — pilote une ville

### Phase 4 — Espace Emprunter + différenciation
- [ ] Prêt numérique via Readium **LCP** (accès temporel + files d'attente), fonds maison
- [ ] Partenariats écoles / bibliothèques (B2B2C)
- [ ] Libraire IA (Anthropic), audiolivres langues locales
- [ ] Expansion CEMAC

---

## B-bis. Points d'attention identifiés (15/07/2026)

- **Éducation** : ~~débranchée~~ → **entrée « Kalamundi Campus » rebranchée sur l'accueil** ✅ Codex 16/07 (`fa8ff9b`, accès annales/examens/répétiteur/institutions). **Reste** : moderniser et repenser les pages éducation elles-mêmes (offre étudiant vs écoles, lien achat de manuels).
- **Logo** : piste visuelle retenue le 16/07 : monogramme **KM** + plume + petit livre, wordmark `KalaMundi`, signature `La Plume du Monde`, asset `assets/img/logo-kalamundi-km-plume.png`. Intégration P0 livrée : mark `assets/img/logo-mark-km.png`, favicon/icônes PWA régénérés, emojis remplacés dans nav/footer/owner. **Reste amélioration future** : vectorisation SVG fine et déclinaisons print/brandbook.

## C. Backlog transverse (à faire tôt)
- [ ] Confiance : avis, garantie acheteur, badge vendeur vérifié
- [ ] Optimisation offline pour catalogues lourds
- [ ] Vérifier capacités **payout Fapshi** (bloquant Phase 3)
- [ ] Cadre juridique droits/prêt (étendre `contrat-auteur.html`)

---

## D. Prochaine action
→ Codex exécute dans l'**ordre priorisé** de la section E ci-dessous. Un seul tier à la fois, du haut vers le bas.

---

## E. Ordre d'exécution priorisé (hiérarchie)

**Règle : traiter les tiers dans l'ordre. Ne pas ouvrir un tier tant que le précédent n'est pas livré.** `⟶` = dépend de.

### 🟥 P0 — Finir le socle Phase 1 (peu risqué, visible, en cours)
1. ✅ **Lecteur premium** — réglages typo, bascule thèmes jour/nuit/sépia, surlignage. *(livré 16/07, SW `kala-v14`)*
2. ✅ **Interface auteur modernisée** — dashboard + formulaire de publication au nouveau design. *(livré 16/07, SW `kala-v15`)*
3. ✅ **Hygiène** — test régression lecture en ligne (après refonte offline), retrait des polices Roboto mortes. *(livré 16/07, contrôle `check-reader-regression`, SW `kala-v18`)*
4. ✅ **Logo** — remplacer l'emoji 📚, décliner favicon + icônes PWA (`generate-icons.mjs`). *(livré 16/07, SW `kala-v19`)*

### 🟧 P1 — Fondations structurantes (prérequis de TOUT le commerce)
5. **Modèle de données « Livre + Offres »** (D3) — ⚠️ **le pivot** : plusieurs tâches P1/P2/P3 en dépendent. Invisible mais prioritaire.
6. **Pipeline EPUB** — convertisseur (Word/PDF/EPUB → chapitres normalisés + build EPUB, epubcheck) + **lecteur EPUB web** (Readium/foliate). `⟶ 5`
7. **Standards publication** — formulaire métadonnées complet + checklist bloquante + couverture 1,6:1. `⟶ 5`
8. **Traduction** — nœuds de texte + langue source depuis métadonnées. `⟶ 6`

### 🟨 P2 — Engagement & monétisation auteur
9. **Home en rails + fiche livre unifiée** (offres lire/acheter/emprunter/occasion). `⟶ 5`
10. **Couche sociale** — notes, avis, étagères « à lire », stats.
11. **Royalties 50/50 + reporting auteur niveau KDP + option Kalamundi Select.** `⟶ 5`

### 🟩 P3 — Espace Acheter (Phase 2, numérique, sans logistique)
12. Entité produit/offres → **panier** → **checkout Fapshi** → store à rails → historique de commandes. `⟶ 5`
13. **Diaspora (D11)** — paiement international (cartes/PayPal) + multi-devises + **gifting**. `⟶ 12`

### 🟦 P4 — Espaces avancés (chacun livré seul, dans l'ordre)
14. **Vendre / occasion** (Phase 3) — listing ISBN, escrow, payout, logistique pilote. *(le plus dur)*
15. **Emprunter** (Phase 4) — Readium **LCP** (accès temporel + files d'attente), fonds maison.

### 🟪 P5 — Piliers partenariats (en parallèle, au rythme des accords — PAS bloquants)
16. **Canal éditeurs** (D13) — comptes catalogue, ONIX/EPUB, revenus négociés.
17. **Fonds patrimoine « Kalamundi Héritage »** (D14) — accès public-bien + partenariat MINAC/OIF/UNESCO.
18. **Libraire IA** (Anthropic) + **audiolivres langues locales** + **expansion africaine**.

> Note dépendances : le **n°5 (modèle Livre+Offres)** débloque 6, 7, 9, 11, 12 → à faire tôt même s'il est « invisible ».
