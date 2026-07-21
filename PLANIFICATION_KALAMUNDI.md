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
| **D3** | Modèle de données **Livre + Offres** (progressif) : `livres` + `livre_editions` + `livre_offres`, reliés à `oeuvres` sans casser la lecture actuelle | Oui | ✅ **validé par Franklin** — migration `V007__livres_offres.sql` |
| D4 | Paiement : **Fapshi à chaque acte** d'abord, « Pièces » plus tard | Oui | 🟡 |
| D5 | Périmètre : **Cameroun + diaspora d'abord**, puis extension aux autres pays africains si ça réussit | Oui | ✅ **validé** |
| D6 | Prêt limité d'abord à **notre fonds d'auteurs** | Oui | 🟡 |
| D7 | C2C occasion : garder dans la vision, **faire en dernier** | Oui | 🟡 |
| **D9** | **Format : accepter TOUS formats → convertisseur normalise en chapitres internes + build EPUB canonique ; lecteur web Readium ; traduction préservée via normalisation ; checklist dépôt auteur (langue orig. obligatoire) ; validation epubcheck** | Oui | ✅ **validé par Franklin** |
| **D10** | **Standards publication (réf. KDP) : EPUB + métadonnées ONIX-like + couverture 1,6:1 + reporting auteur niveau KDP.** Royalties = **50/50** (50 % auteur / 50 % plateforme) — détail dans `ADAPTATION_STANDARDS_KDP.md` | 50/50 | ✅ **validé (50/50)** — option « Select » 70 % gardée en réserve, à confirmer |
| **D11** | **Diaspora** : ouvrir achat/location à la diaspora → **paiement international** (cartes/PayPal) + **multi-devises** (EUR/USD/FCFA) + pattern **gifting** (acheter/offrir un livre livré à un proche au pays) | Oui | ✅ **acté par Franklin** (mise en œuvre à cadrer) |
| **D15** | **Commission occasion** = **20 %** (niveau PangoBooks) ; la plateforme porte les frais Fapshi ; répartition documentée pour le vendeur (CGU §5.5) | 20 % | ✅ **validé (Franklin)** |
| **D16** | **Prise en charge des frais Fapshi (3 % encaissement, 0 % payout)** : la **plateforme absorbe seule** les frais → l'auteur touche sa part pleine. Documenté côté auteur (publish, contrat-auteur, dashboard). | `plateforme` | ✅ **validé (Franklin)** |
| **D17** | **Promo / campagne de vente** : livre mis en avant sur période donnée, page publique partageable, prix campagne/prix barré, conditions admin-auteur et tracking vues/clics/intention d'achat | Oui | ✅ **validé par Franklin** — migration `V017__campagnes_vente.sql` |
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
- [x] Architecture d'information détaillée (navigation, fiche livre unifiée) — ✅ Codex 16/07 : fiche œuvre unifiée autour des offres lire/acheter/hors ligne/emprunter/occasion
- [x] Modèle de données cible (schéma Livre / Offre / Édition) — ✅ Codex 16/07 (`V007__livres_offres.sql`)

### Phase 1 — Enrichir l'existant (peu risqué, gros effet)
> 🎨 **Priorité transverse : moderniser TOUTES les interfaces clés** — auteur (dashboard, publication), lecteur (confort de lecture), boutique, éducation. Cf. direction design `BIBLE §10`.
- [x] **Reskin design (tokens)** — ✅ Codex 16/07 (`464131e`) : webfonts Fraunces/Inter auto-hébergées, base crème `#FBF8F2`, bordures neutres `#E7E0D2`, rayons/ombres, composants adoucis, SW `kala-v10`
- [x] **Interface AUTEUR modernisée** — ✅ Codex 16/07 (`kala-v15`) : dashboard standard auteur + formulaire publication modernisé (cockpit qualité, résumé obligatoire, validation fichier, royalties 50/50 visibles, rappel couverture 1,6:1)
- [x] **Interface LECTEUR modernisée** : offline soigné ✅ Codex 16/07 (`f43ddee`, biblio locale + démarrage IndexedDB) ; lecteur premium ✅ Codex 16/07 (polices de lecture, thèmes robustes, repagination des réglages, surlignage/note exposés)
- [x] **Shell mobile** — ✅ Codex 16/07 (`a28a36d`) : barre d'onglets basse (Accueil · Explorer · Apprendre · Biblio · Profil), SW `kala-v11`
- [x] **Home en rails de merchandising** + carte/fiche livre unifiée (offres lire/acheter/emprunter/occasion) — ✅ Codex 16/07 : rails commerce accueil + bloc offres sur fiche œuvre, achat Fapshi visible, offline exposé
- [x] **Accueil réorganisé — auteurs au centre** — ✅ 20/07 : maquette validée (Artifact) puis codée. Un seul rail « À découvrir — nos auteurs » (jamais mélangé au patrimoine, tuile « Ta place est ici »), sections Occasion (vrai état vide) et Bibliothèque patrimoine (séparée), 6 sections coupées/fusionnées (Pourquoi Kalamundi, 4 rails commerce, genres, nouveautés, spotlight). Bug corrigé au passage : `exclureSysteme` ne filtrait rien (0/288). SW `kala-v33`, `npm run check` 24/24. Détails `ERROR_LOG.md`/`EVOLUTION_KALAMUNDI.md`.
- [x] Lecteur premium (réglages typo, thèmes jour/nuit/sépia, surlignage couleur) — ✅ Codex 16/07, SW `kala-v14`
- [x] **Lecteur EPUB web** (Readium/foliate-js) en parallèle du lecteur actuel — ✅ Codex 16/07 : mode EPUB via `epub.js`, fichier `.epub`/`livre_editions`, URL signée, thèmes/réglages, fallback lecteur chapitres, SW `kala-v21`
- [ ] **Convertisseur « égalisateur »** : Word/PDF/EPUB → chapitres normalisés + build EPUB (epubcheck), avec relecture auteur pour le PDF — *socle livré 16/07 : `V008`, normaliseur, build EPUB local + navigateur, upload `canonique.epub`, synchronisation `livre_editions` ; reste import serveur robuste + epubcheck strict*
- [x] Checklist de dépôt auteur (langue originale obligatoire) au formulaire de publication — ✅ Codex 16/07 : score bloquant, mots-clés, catégories, couverture 1,6:1
- [x] Traduction : traiter les nœuds de texte + lire la langue source depuis les métadonnées — ✅ Codex 16/07 : texte propre, `chapitre_ref` stable, `langue_source`, `source_hash`
- [x] Couche sociale : notes, avis, étagères « à lire », stats à la Wattpad — ✅ Codex 17/07 : étagères lecteur + compteurs sociaux sur fiche œuvre
- [x] Publier : royalties transparentes côté auteur — ✅ Codex 17/07 : dashboard auteur affiche 50/50, ventes premium, seuil payout et Select en réserve
- [x] **Standards KDP** : formulaire de publication au schéma métadonnées complet (§3 `ADAPTATION_STANDARDS_KDP.md`) + checklist bloquante + couverture 1,6:1 — ✅ Codex 16/07
- [x] **Reporting auteur niveau KDP** : ventes + pages lues (analogue KENP) + payouts Mobile Money — ✅ Codex 17/07 : panneau reporting KDP, pages suivies, revenus/payout XAF
- [ ] Option **« Kalamundi Select »** (exclusivité → 70 % + inclusion abonnement)

### Phase 2 — Espace Acheter (numérique, sans logistique)
- [x] Entité Livre/produit + offres — ✅ Socle DB progressif livré (`livres`, `livre_editions`, `livre_offres`) ; reste UI panier/checkout en P3
- [x] Panier + checkout multi-articles (Fapshi) — ✅ Codex 17/07 : panier local, page paiement `cart=1`, paiements multi-lignes confirmés par webhook
- [x] Store à rails (nouveautés, promos, catégories), prix FCFA barré/soldé — ✅ promotions/prix barré `V016`, campagnes de vente accueil + landing publique + admin `V017`
- [x] Historique de commandes, bibliothèque achetée — ✅ Codex 17/07 : section Mes achats dans la bibliothèque locale/offline

### Phase 3 — Espace Vendre / occasion (le plus dur)
- [ ] Listing vendeur (scan ISBN, état, photos, prix)
- [ ] Profil + notes vendeur
- [ ] Escrow + payout Mobile Money + commission
- [ ] Logistique v1 (main propre géolocalisée / points relais, COD) — pilote une ville

### Phase 4 — Espace Emprunter + différenciation
- [x] Prêt numérique — **V1 accès temporel applicatif** (pas de DRM Readium LCP, cf. `EVOLUTION_KALAMUNDI.md` 19/07) : `emprunter_livre`/`rendre_livre`/`expirer_emprunts`, fonds maison via `livre_offres.stock`, file d'attente. LCP resterait à considérer si des œuvres sous droits externes (éditeurs, D13) exigent une vraie protection anti-copie contractuelle.
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
- [x] Vérifier capacités **payout Fapshi** — ✅ **confirmé (16/07)** : Fapshi expose `POST /payout` (MTN/Orange/compte Fapshi, min 100 XAF, en-têtes apiuser/apikey), + bulk. Client codé (`scripts/lib/fapshi-payout.js`, `check-payout`). ⚠️ **payout désactivé par défaut en live → activation à demander au support Fapshi + float requis sur le compte.**
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
5. ✅ **Modèle de données « Livre + Offres »** (D3) — ⚠️ **le pivot** : plusieurs tâches P1/P2/P3 en dépendent. *(livré 16/07, migration `V007__livres_offres.sql`)*
6. ✅ **Pipeline EPUB** — convertisseur + **lecteur EPUB web** + validation + import serveur. `⟶ 5` *(socle chapitres normalisés, build EPUB local/navigateur, lecteur EPUB web, édition EPUB publication ; **validation ✅ 16/07** : validateur natif `scripts/lib/epub-validator.mjs` dans `npm run check`, epubcheck en passe profonde optionnelle, 4 bugs corrigés — cf. ERROR_LOG ; **import serveur ✅ 16/07** : `/api/import-book` extrait DOCX/ODT/EPUB/HTML/TXT sans dépendance CDN, normaliseur partagé, repli client, PDF volontairement client — contrôle `check-book-import`)*
   - ⚠️ *À confirmer au 1er déploiement : l'endpoint n'a été vérifié que sous Node (Request/FormData/DecompressionStream), pas encore sur le runtime Workers réel.*
7. ✅ **Standards publication** — formulaire métadonnées complet + checklist bloquante + couverture 1,6:1. `⟶ 5` *(livré 16/07)*
8. ✅ **Traduction** — nœuds de texte + langue source depuis métadonnées. `⟶ 6` *(livré 16/07)*

### 🟨 P2 — Engagement & monétisation auteur
9. ✅ **Home en rails + fiche livre unifiée** (offres lire/acheter/emprunter/occasion). `⟶ 5` *(livré 16/07 : API offres, rails accueil, fiche œuvre unifiée, contrôle `check-commerce-rails`)*
10. ✅ **Couche sociale** — notes, avis, étagères « à lire », stats. *(livré 17/07 : migration `V010`, compteurs sociaux, actions étagères, contrôle `check-social-layer`)*
11. ✅ **Royalties 50/50 + reporting auteur niveau KDP + option Kalamundi Select.** `⟶ 5` *(livré 17/07 : reporting KDP dashboard, 50/50 visible, Select préparé mais non activé)*

### 🟩 P3 — Espace Acheter (Phase 2, numérique, sans logistique)
12. ✅ Entité produit/offres → **panier** → **checkout Fapshi** → store à rails → historique de commandes + campagnes. `⟶ 5` *(panier, checkout multi-livres et historique achats livrés 17/07 ; prix barré/promo livré 19/07 — `V016__promo_prix_barre.sql` ; campagnes livre livrées 20/07 — `V017__campagnes_vente.sql`, page publique partageable, rail accueil, admin création/suivi, prix spécial respecté par Fapshi ; conversions/revenu campagne livrés 21/07 — `V018__campagnes_conversions.sql`. Reste futur : catégories avancées du store.)*
13. 🟡 **Diaspora (D11)** — paiement international (cartes/PayPal) + multi-devises + **gifting**. `⟶ 12`
    - ✅ **Multi-devises** (16/07) : `scripts/lib/devises.mjs` — XAF/EUR/USD, parité fixe EUR 655,957, USD flottant via `TAUX_USD_XAF`, devise inconnue refusée. A corrigé 2 bugs graves (cf. ERROR_LOG). Contrôle `check-devises`.
    - ✅ **Gifting — serveur** (16/07) : migration `V011` + RPC `reclamer_cadeau` + codes `scripts/lib/cadeaux.mjs` + **flux paiement branché** (`fapshi-pay` crée le cadeau, `fapshi-webhook` le confirme et crédite l'auteur sans donner l'accès à l'acheteur). Contrôles `check-cadeaux` + `check-gift-flow`. ✅ **V011 appliquée sur Supabase (16/07).**
    - ✅ **UI cadeau** (16/07) : bouton « Offrir » sur la fiche (`work.js`), mode cadeau dans `payment.html`/`payment.js` (champs + affichage/partage du code), page de réclamation `pages/reclamer.html` + `reclamer.js` (RPC `reclamer_cadeau`). SW `kala-v29`. ⚠️ À tester en vrai après déploiement + `V011`.
    - ⬜ **Reste #13** : **connecteur paiement international** (cartes/PayPal) — 🔴 **bloqué : compte marchand + secrets requis (action Franklin)**. Le gifting fonctionne déjà via Fapshi/Mobile Money en attendant.

### 🟦 P4 — Espaces avancés (chacun livré seul, dans l'ordre)
14. ✅ **Vendre / occasion** (Phase 3) — listing ISBN, escrow, payout, arbitrage litige, liste des annonces. *(le plus dur — entièrement livré 19/07, reste seulement l'activation du payout live par Fapshi, démarche Franklin)*
    - ✅ **Socle séquestre** (16/07) : machine à états `scripts/lib/occasion-etats.mjs` + migration `V012` (commandes_occasion, vendeur_evaluations, 5 RPC SECURITY DEFINER) + `check-occasion`. Commission 15 % (**D15**), aucun revenu auteur sur l'occasion. ✅ **V012 appliquée sur Supabase (16/07).**
    - ✅ **Payout confirmé + client codé** (16/07) : `scripts/lib/fapshi-payout.js` (POST /payout), `check-payout`. Reste à demander l'activation live à Fapshi (démarche Franklin).
    - ✅ **Formulaire de mise en vente** (16/07) : `V013` (RPC `creer_annonce_occasion`) + `pages/vendre.html` / `vendre.js` (répartition en direct) + entrée menu profil. Contrôle `check-vendre`. ✅ **V013 appliquée sur Supabase (16/07).**
    - ✅ **Paiement occasion branché** (16/07) : `fapshi-pay` relit le montant serveur + relie paiement↔commande ; `fapshi-webhook` gèle en `paye_sequestre` sans payer le vendeur. Contrôle `check-occasion-flow`.
    - ✅ **Cycle complet bouclé** (16/07) : page `commande.html` (timeline + actions par rôle réel : payer/remettre/recevoir=libère les fonds/litige/évaluer) + découverte sur la fiche œuvre (`work.js` : annonces réelles + réservation en un clic) + `payment.js` branché. Contrôle `check-commande-occasion`. **Découvrir → réserver → payer → séquestre → remettre → recevoir → fonds libérés → évaluer.**
    - ✅ **Reste livré (19/07)** : Function serveur d'orchestration du **payout** (`functions/api/payout-occasion.js`, branchée sur le cron horaire, idempotente — **inerte tant que Fapshi n'a pas activé le payout live et que `PAYOUT_TASK_SECRET` n'est pas configuré**), **arbitrage litige** admin (`V015__arbitrage_litige.sql`, RPC `resoudre_litige`, section admin dédiée), page de **liste des annonces** (`pages/occasion.html`). Contrôle `check-litige-promo-payout`. P4 #14 est donc désormais **entièrement livré** (reste seulement l'activation Fapshi côté Franklin).
15. ✅ **Emprunter** (Phase 4) — accès temporel + file d'attente sur le fonds maison. *(livré 19/07, migration `V014__pret_numerique.sql` appliquée sur Supabase, contrôle `check-emprunt` ; reste à créer une offre `pret_numerique` de test et exercer le flux en vrai)*

### 🟪 P5 — Piliers partenariats (en parallèle, au rythme des accords — PAS bloquants)
16. **Canal éditeurs** (D13) — comptes catalogue, ONIX/EPUB, revenus négociés.
17. **Fonds patrimoine « Kalamundi Héritage »** (D14) — accès public-bien + partenariat MINAC/OIF/UNESCO.
18. **Libraire IA** (Anthropic) + **audiolivres langues locales** + **expansion africaine**.

> Note dépendances : le **n°5 (modèle Livre+Offres)** débloque 6, 7, 9, 11, 12 → à faire tôt même s'il est « invisible ».
