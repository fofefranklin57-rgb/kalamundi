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
- [ ] **Reskin design (tokens)** : webfonts Fraunces + Inter, base crème, retrait bordures vertes, arrondis 12–16px, boutons pleins, skeletons
- [ ] **Interface AUTEUR modernisée** : dashboard + formulaire de publication (schéma métadonnées, upload multi-format, aperçu) au nouveau design
- [ ] **Interface LECTEUR modernisée** : lecteur premium (typo, thèmes, surlignage), navigation fluide, offline soigné
- [ ] **Shell mobile** : barre d'onglets basse (Accueil · Explorer · Apprendre · Biblio · Profil)
- [ ] **Home en rails de merchandising** + carte/fiche livre unifiée (offres lire/acheter/emprunter/occasion)
- [ ] Lecteur premium (réglages typo, thèmes jour/nuit/sépia, surlignage couleur)
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

- **Éducation débranchée** : les pages existent (`education/annales/epreuves/examen-sim/repetiteur/ecole/institution`) mais `index.html` **ne les lie pas** → invisibles pour l'utilisateur. Décision : **repenser le vertical Apprendre avant de le réexposer** (place dans la nav à onglets, offre étudiant vs écoles, lien avec l'achat de manuels). Ne pas juste « rebrancher » — repenser.
- **Logo à refaire** : aujourd'hui = emoji 📚 + wordmark, incohérent selon les pages (certaines sans emoji). Créer une **vraie identité graphique** ancrée sur *la plume* (« La Plume du Monde » / « Kalamu ya Dunia »). Concepts explorés le 15/07 ; à trancher puis décliner (favicon, icônes PWA `generate-icons.mjs`, nav, footer).

## C. Backlog transverse (à faire tôt)
- [ ] Confiance : avis, garantie acheteur, badge vendeur vérifié
- [ ] Optimisation offline pour catalogues lourds
- [ ] Vérifier capacités **payout Fapshi** (bloquant Phase 3)
- [ ] Cadre juridique droits/prêt (étendre `contrat-auteur.html`)

---

## D. Prochaine action
→ **Franklin tranche D0–D9.** Ensuite : architecture d'information + schéma de données. Puis seulement : specs & code.
