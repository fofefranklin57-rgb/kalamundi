# MÉMO — Transformer Kalamundi en plateforme de prêt, d'achat et de vente de livres (Cameroun / Afrique)

*Rédigé le 15 juillet 2026. Basé sur (1) l'audit du code réel de Kalamundi, (2) la visite directe des interfaces des grandes plateformes mondiales, (3) la recherche sur les acteurs africains et la logistique camerounaise.*

---

## 0. Méthode & transparence

J'ai **réellement visité** (pas seulement lu des articles) :
- **Amazon KDP** (`kdp.amazon.com`) — la face publication/auteur
- **Kobo** (`kobo.com`) — store + écosystème liseuse + web reader
- **Wattpad** (`wattpad.com`) — lecteur sérialisé + monétisation par pièces
- **PangoBooks** (`pangobooks.com`) — marketplace P2P de livres d'occasion
- **Goodreads** (`goodreads.com`) — couche sociale / découverte

> Limite honnête : dans cet environnement, la **capture d'écran** (rendu pixel) des sites lourds (Amazon, Kobo) expirait systématiquement. J'ai donc analysé la **structure réelle des pages** (DOM, hiérarchie, composants, textes, CTA, prix) plutôt que le rendu pixel. Les observations de design ci-dessous portent sur les **patterns d'interface et de présentation** constatés, pas sur une lecture pixel-perfect des couleurs.

Complété par la recherche : OverDrive/Libby (prêt), Okadabooks/Bambooks/YouScribe/Snapplify/AkooBooks (Afrique), CameroonBook + logistique last-mile Cameroun.

---

## 1. Diagnostic — ce qu'est Kalamundi AUJOURD'HUI

D'après le code (`pages/`, `functions/api/`, `migrations/`), Kalamundi est une **plateforme de publication + lecture + éducation**, pas encore une place de marché du livre.

**Ce qui existe déjà (atouts) :**
- Publication d'œuvres sérialisées (chapitres, publication programmée) — `publish.html`, `V002__publication_programmee`
- Lecteur web avec annotations, progression, traduction — `reader.html`, `annotations.js`, `translate.js`
- **Paywall par chapitre** + abonnements — `V006__paywall_chapitres_gratuits`, `abonnements.html`
- **Paiement Mobile Money déjà intégré (Fapshi)** — `fapshi-pay.js`, `fapshi-webhook.js` ✅ *actif énorme pour l'Afrique*
- Espace Étudiant complet (annales, épreuves, examen simulé, répétiteur) — vertical éducation différenciant
- Dashboard auteur + contrat auteur + partage de revenus — `author-dashboard.html`, `contrat-auteur.html`
- Communautés / commentaires — `communautes.html`, `V005`
- PWA offline-first, i18n (FR/EN), génération de couverture IA, notifications

**Ce qui MANQUE structurellement pour être une « plateforme de prêt, d'achat et de vente » :**
- ❌ Aucune notion de **livre en tant que produit commerçable** (catalogue ISBN, éditions, format papier)
- ❌ Aucun **panier / checkout e-commerce** (aujourd'hui = paiement unitaire d'un abonnement/chapitre)
- ❌ Aucune **vente entre utilisateurs** (C2C, livres d'occasion)
- ❌ Aucun système de **prêt / emprunt** (durée, file d'attente, retour, DRM temporaire)
- ❌ Aucune **logistique** (livraison physique, adresses, suivi, cash-on-delivery)
- ❌ Couche **sociale/découverte** faible (pas d'étagères « à lire », notes/avis structurés, listes)

---

## 2. Ce que font les grandes plateformes (observé directement)

### Amazon KDP — le modèle auteur + impression à la demande
- Publication en **3 étapes**, eBook **ET** papier (broché/relié) en **print-on-demand** : Amazon imprime et expédie à la commande → *zéro stock pour l'auteur*.
- Royalties claires : **35 % ou 70 %** eBook, jusqu'à **60 %** papier ; **rémunération à la page lue** via Kindle Unlimited.
- Leçon pour Kalamundi : la **transparence des royalties** et le **print-on-demand** sont les deux aimants à auteurs.

### Kobo — le store + l'écosystème de lecture
- Home = **rails de merchandising** (Top Books, Deals à \$1.99, Nouveautés, par catégorie) avec **prix barré / prix soldé** très visibles.
- Vend du **matériel** (liseuses) ET du logiciel (**Web Reader** + apps) : « lire partout, sur tout appareil ».
- Fonctions lecteur mises en avant : **surlignage en couleur**, annotations, audiolivres.
- Leçon : la **présentation par rails thématiques + promotions** est le langage visuel attendu d'un store de livres.

### Wattpad — le lecteur sérialisé + micro-paiement (LE plus proche de Kalamundi)
- Page œuvre = **Lectures (3,9 M), Votes (140 K), Chapitres (32)**, **temps de lecture estimé**, tags riches.
- Monétisation par **« Pièces »** : *« Coût Histoire Entière : 104 Pièces »* → déblocage de chapitres à l'unité (micro-transactions).
- **Premium** (sans pub), programmes **Wattpad Originals/Stars**, passerelle vers l'édition papier (partenariat Hachette).
- Leçon : Kalamundi a déjà 80 % de ce modèle ; il manque surtout une **monnaie virtuelle / porte-monnaie** et la vitrine de stats sociales.

### PangoBooks — la vente C2C de livres d'occasion (LE modèle « vente entre lecteurs »)
- N'importe qui **vend** : on **scanne le code-barres / saisit l'ISBN**, l'app auto-remplit la fiche, **listing gratuit et illimité**.
- Commission **20 %** au vendeur ; **étiquette d'envoi prépayée** générée automatiquement.
- **Garantie acheteur 100 %**, **threads sociaux**, **suivre ses vendeurs préférés**, bundles multi-livres.
- **« Pango AI »** : un chatbot « personal book shopper » pour la découverte.
- Leçon : c'est exactement le pilier **VENTE/ACHAT d'occasion** qui manque à Kalamundi — mais il faut l'adapter à la logistique africaine (voir §5).

### Goodreads — la couche sociale / découverte
- Page livre = CTA **« Want to Read »** (étagères), **note moyenne 4.35 / 10 M de notes / 273 K avis**, genres, éditions multiples.
- Preuve sociale : *« 111 139 personnes lisent actuellement »*, *« 1,9 M veulent lire »*, suivi d'auteur, séries liées.
- Leçon : la **découverte sociale (avis, étagères, notes)** est le moteur d'engagement que Kalamundi n'a presque pas.

### Prêt numérique — OverDrive / Libby
- OverDrive = intermédiaire éditeurs↔bibliothèques (**~90 % du marché**). Modèles de licence :
  - **One Copy / One User** : 1 exemplaire = 1 lecteur à la fois, **file d'attente**.
  - **Metered Access** : X emprunts ou Y mois puis la licence expire.
- Emprunt gratuit avec carte de bibliothèque, **pas d'abonnement, pas de pénalité de retard** (retour automatique).
- Leçon : le **prêt** implique un **DRM temporel** (accès qui expire) + **files d'attente** + relation avec des **détenteurs de droits** (éditeurs, écoles, bibliothèques).

---

## 3. Panorama africain — succès, échecs et créneaux

| Acteur | Pays | Modèle | À retenir |
|---|---|---|---|
| **Okadabooks** | Nigeria | Self-pub + vente eBook en Naira | **Fermé en 2023** (« défis insurmontables ») → *la vente d'eBooks seule ne suffit pas à survivre* |
| **Bambooks** | Nigeria | Abonnement « Netflix du livre » africain | Le **modèle abonnement illimité** marche mieux que l'achat à l'unité |
| **YouScribe** | Afrique francophone | Abonnement streaming lecture | **Très pertinent Cameroun** (francophone, mobile, partenariats télécoms) |
| **Snapplify** | Afrique du Sud | Marketplace **B2B écoles** (manuels numériques) | Le **canal institutionnel/éducation** est un revenu stable |
| **AkooBooks** | Ghana | Audiolivres, **langues indigènes** (Twi, Ga, Swahili), 19 pays | L'**audio + langues locales** = différenciation forte |
| **CameroonBook** | Cameroun | Livraison de **manuels papier** à domicile | Le **papier + last-mile** est un vrai besoin local non digitalisé |

**Lecture stratégique :** au Cameroun, le gisement n'est pas « encore un store d'eBooks » (Okadabooks a échoué) mais **la combinaison** que personne n'offre en un seul endroit : *lecture numérique + abonnement + éducation + occasion papier + Mobile Money*. Kalamundi tient déjà 3 de ces 5 briques.

---

## 4. Les 3 piliers à construire (avec les manques concrets)

### 🟦 Pilier ACHAT (livre numérique & papier neuf)
Manque à Kalamundi :
- Catalogue **produit** : entité `livre` avec ISBN, éditions, formats (ePub/PDF/papier), stock/print-on-demand.
- **Panier + checkout** multi-articles (aujourd'hui = paiement unitaire).
- **Store front** avec rails de merchandising, prix barré/soldé, promotions (façon Kobo).
- Intégration **éditeurs / libraires** locaux (approvisionnement du catalogue papier).
- Livraison papier : adresses, frais de port, **suivi**, **paiement à la livraison (COD)**.

### 🟩 Pilier VENTE (C2C — lecteurs & auteurs qui vendent)
Manque à Kalamundi :
- **Listing vendeur** : scan code-barres / ISBN → fiche auto-remplie, état du livre, prix, photos.
- **Portefeuille vendeur + payout Mobile Money** (Fapshi payout / OM / MoMo).
- **Commission plateforme** (ex. 10–20 %).
- **Confiance** : notes vendeurs, garantie acheteur, séquestre (escrow) tant que la livraison n'est pas confirmée.
- **Logistique de proximité** : points de retrait, coursiers moto, remise en main propre géolocalisée.

### 🟪 Pilier PRÊT (emprunt numérique & physique)
Manque à Kalamundi :
- **Accès temporel** : un emprunt qui **expire** (DRM léger : accès révoqué à la date de retour).
- **Files d'attente** + nombre d'exemplaires (licence One-Copy/One-User).
- **Prêt entre particuliers** (P2P) ou **bibliothèque partenaire / école** (B2B2C).
- Modèle « **caution remboursable** » adapté au papier d'occasion (l'utilisateur paie une caution, récupérée au retour).

---

## 5. Design, présentation & lecteur — ce qu'il faut relever

Ce que les grandes plateformes ont et que Kalamundi doit viser :

1. **Fiche produit riche** (façon Goodreads/Kobo) : couverture haute qualité, note moyenne + nb d'avis, « X lisent / veulent lire », éditions/formats, séries liées, tags cliquables. → Kalamundi a une page œuvre mais sans preuve sociale ni éditions.
2. **Home marchande à rails** (Kobo) : « Meilleures ventes », « À moins de 500 FCFA », « Nouveautés », « Près de chez vous » (occasion), carrousels par catégorie avec prix barrés.
3. **Lecteur premium** (Kobo/Kindle) : réglages typographiques (police, taille, interligne, marge), thèmes jour/nuit/sépia, surlignage **en couleur**, dictionnaire/traduction au tap, signets, synchronisation multi-appareils. → Kalamundi a déjà annotations + progression + traduction : **bonne base**, à polir côté réglages et confort de lecture.
4. **Découverte assistée par IA** (Pango AI) : un « libraire IA » conversationnel — *déjà à ta portée puisque `ANTHROPIC_API_KEY` est configurée dans Kalamundi*.
5. **Vitrine de stats sociales** (Wattpad) : lectures, votes, temps de lecture estimé, classements — moteur d'engagement quasi gratuit à afficher.
6. **Cohérence visuelle & confiance** : sur un site de commerce africain, la **preuve de confiance** (avis, garantie, badges vendeur vérifié, COD) est un élément de design à part entière — c'est ce qui lève la barrière n°1 de l'e-commerce africain (méfiance last-mile).

---

## 6. Spécificités Cameroun / Afrique (facteurs de succès)

- **Paiement** : Mobile Money est roi (Orange Money, MTN MoMo). Kalamundi a **déjà Fapshi** ✅ — avantage décisif vs partir de zéro. Ajouter les **payouts** (reverser aux vendeurs) et le **COD**.
- **Logistique / last-mile** : principal point de friction (délais, confiance). Solutions : **points relais**, **coursiers moto**, **remise en main propre géolocalisée**, **escrow** (l'argent n'est versé qu'à réception).
- **Data / offline** : coût de la donnée élevé → le **PWA offline-first déjà en place** est un atout ; prévoir catalogues légers, images optimisées.
- **Langues** : FR/EN déjà là ; envisager **langues locales** (façon AkooBooks) comme différenciateur culturel.
- **Audio** : l'**audiolivre** en langues locales est un créneau peu occupé et adapté à l'oralité + faible bande passante.
- **Éducation** : le canal **écoles / annales** (déjà présent) est le revenu **récurrent et institutionnel** le plus solide — à ne pas négliger au profit du « cool » marketplace.

---

## 7. Feuille de route proposée (par phases)

**Phase 1 — Fondations commerce (transformer l'existant en store)**
- Modéliser l'entité `livre`/`produit` (ISBN, formats, prix, éditions) au-dessus des œuvres.
- Panier + checkout multi-articles sur Fapshi ; historique de commandes.
- Home à rails + fiche produit enrichie (avis, notes, « veulent lire »).
- Portefeuille utilisateur (monnaie virtuelle « Pièces » façon Wattpad pour le numérique).

**Phase 2 — Vente C2C (occasion)**
- Listing vendeur (scan ISBN, état, photos, prix), profil vendeur + notes.
- Escrow + payout Mobile Money + commission plateforme.
- Logistique v1 : remise en main propre géolocalisée + points relais ; COD.

**Phase 3 — Prêt**
- Prêt **numérique** : accès temporel qui expire + files d'attente (One-Copy/One-User).
- Partenariats **écoles / bibliothèques** (B2B2C) pour le fonds prêtable.
- Prêt **papier** entre particuliers avec caution remboursable.

**Phase 4 — Différenciation**
- Libraire IA (Anthropic) ; audiolivres en langues locales ; canal institutionnel éducation ; expansion pays (CEMAC → Afrique francophone façon YouScribe).

**Transverse (à faire tôt) :** confiance (avis, garantie, vendeur vérifié), lecteur premium (réglages typo, thèmes, surlignage couleur), stats sociales.

---

## 8. Risques & leçons

- **Leçon Okadabooks (fermé 2023)** : vendre uniquement des eBooks ne finance pas la structure → **diversifier** (abonnement + occasion + éducation + audio) dès le départ.
- **Logistique** = le risque n°1 d'exécution → commencer **léger** (main propre / relais) avant d'industrialiser.
- **Confiance C2C** : sans escrow ni garantie, la fraude tue le marketplace → l'escrow n'est pas optionnel.
- **Droits d'auteur / prêt** : le prêt numérique suppose l'accord des détenteurs de droits (éditeurs, écoles) → cadrer juridiquement (le `contrat-auteur.html` est un bon point de départ à étendre).
- **Ne pas casser l'existant** : l'éducation et la lecture sérialisée sont les revenus actuels — le marketplace vient **au-dessus**, pas à la place.

---

---

## 9. Concurrence directe — Cameroun & Afrique centrale (juillet 2026)

**Oui, des apps similaires existent déjà — mais toutes mono-modèle.**

| Plateforme | Modèle | Menace |
|---|---|---|
| **Añdjeun** (ITGStore, Douala, mai 2026) — bibliothèque numérique panafricaine, 3 500+ ouvrages, extension Tchad/RCA/Congo | Lecture / bibliothèque | 🔴 La plus directe (récente, panafricaine, même zone) |
| **EbookCameroun** — streaming ebooks + audio camerounais, manuels univ. | Streaming/abonnement | 🟠 Lecture + éducation |
| **Bibook** (Mali) — éditeur numérique, auteur payé dès la 1re vente (30→50 %) | Édition + lecture | 🟠 Modèle auteur |
| **StreetLib Cameroon** — publication/distribution mondiale | Distribution B2B | 🟡 |
| **Adidjo / Durrell Market / Ubuy** — librairies e-commerce papier + manuels, livraison | Achat papier | 🟠 Couvrent le pilier ACHAT |
| **CamerBook / Librairie Numérique Africaine** — bibliothèques en ligne / abonnement | Lecture/abonnement | 🟡 |
| **RecycLivre** (FR→Cameroun) — occasion + app de rachat | C2B occasion | 🟠 Pilier OCCASION |
| **Andaal / OAPE-FILÉAC** — diffusion/promotion du livre africain | B2B institutionnel | 🟡 |

**Insight clé :** chacun ne fait qu'UNE brique. **Personne au Cameroun ne combine** publication + lecture + **éducation** + achat + vente C2C + prêt sur **Mobile Money**. Les deux douves de Kalamundi que les locaux n'ont pas : **(1) le vertical éducation** (annales/répétiteur), **(2) Fapshi/Mobile Money déjà intégré**.

**Positionnement retenu :** ne pas être « un Añdjeun de plus » (lecture) ni « un Adidjo de plus » (librairie), mais **le super-app du livre africain** — *lire, apprendre, acheter, revendre, emprunter, publier — en FCFA/MoMo, offline.* C'est le créneau vide de la zone CEMAC.

---

*Prochaine étape possible : je peux détailler la Phase 1 en spécifications techniques (schéma DB des entités `livre`/`commande`/`panier`, écrans, endpoints Functions) prête à coder.*
