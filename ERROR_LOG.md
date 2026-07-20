# 🐛 ERROR_LOG KALAMUNDI
### Bugs résolus — à NE PAS reproduire

*Créé le 15 juillet 2026.*
*Règle (comme sur ImmoGest) : on documente chaque bug corrigé DANS le commit de correction, jamais en lot. Entrée la plus récente en haut.*

Format par entrée :
```
### [AAAA-MM-JJ] Titre court du bug
- **Symptôme** : ce que l'utilisateur voyait
- **Cause** : la vraie raison
- **Correctif** : ce qui a été fait
- **Fichier(s)** : où
- **Leçon** : la règle à retenir pour ne pas recommencer
```

### [2026-07-20] `exclureSysteme` ne filtrait rien — le patrimoine noyait les auteurs partout, pas seulement sur l'accueil
- **Symptôme** : les rails « Rayons de lecture » (accueil) et l'onglet « Œuvres Kalamundi » du catalogue (`library.js?collection=originaux`) prétendaient filtrer les imports du domaine public, mais affichaient en réalité Zola/Dumas/Hugo mélangés aux 3 vraies œuvres d'auteurs.
- **Cause** : `api.getOeuvres({ exclureSysteme: true })` excluait seulement `auteur_id = '00000000-…-0001'` — mais les imports en masse (`import_d1.mjs`…`import_d9.mjs`) utilisent chacun un `auteur_id` système différent. Vérifié en direct contre la base réelle : 288/288 œuvres passaient le filtre (0 exclue). Seul `estOeuvreImportee()` (déjà utilisé par `getStatsAccueil`) identifie correctement les 3 vrais auteurs via une combinaison nom/texte.
- **Correctif** : `getOeuvres({ exclureSysteme: true })` sur-récupère (jusqu'à 300 lignes) puis filtre en JS avec `estOeuvreImportee`, avant de paginer. Un seul correctif central profite à tous les appelants (accueil, catalogue). Vérifié en direct : total passe de 288 à 3, exactement les bons titres.
- **Fichier(s)** : `assets/js/api.js`.
- **Leçon** : un paramètre nommé `exclureSysteme` qui ne fait que comparer à un unique UUID codé en dur ment sur ce qu'il fait dès qu'un deuxième import utilise un autre UUID. Toujours vérifier un filtre de ce genre contre la base réelle, pas seulement contre son intention.

### [2026-07-20] Le navigateur de test servait un `app.js` vieux d'un jour malgré le serveur à jour
- **Symptôme** : après avoir réécrit `app.js`, la page rendait un accueil vide (rail auteurs vide, aucune erreur console) — alors que `curl` direct sur le même port renvoyait bien le fichier à jour.
- **Cause** : le Service Worker PWA (`kala-v32`, installé lors de tests précédents dans le même onglet) interceptait la requête `/assets/js/app.js` et servait sa copie en cache, indépendamment du serveur. Redémarrer le serveur de preview n'y changeait rien : le cache vit dans le navigateur, pas le serveur.
- **Correctif** : `navigator.serviceWorker.getRegistrations()` + `unregister()` + `caches.delete()` pour repartir propre en test ; **et**, côté livrable réel, bump systématique de `VERSION` dans `sw.js` (`kala-v32` → `kala-v33`) à chaque changement d'assets — la vraie protection en production, déjà une règle du dépôt (`CLAUDE.md`) mais facile à oublier en cours de session.
- **Fichier(s)** : `sw.js`.
- **Leçon** : si une page semble « ne pas refléter » un changement de code sans aucune erreur, soupçonner le Service Worker avant de soupçonner le serveur ou le code — surtout sur une PWA offline-first où le cache est justement conçu pour survivre au réseau.

### [2026-07-20] `check-gift-flow.mjs` cassé par un ajout antérieur non répercuté dans son mock
- **Symptôme** : `npm run check` échouait sur `check-gift-flow.mjs` (« Le webhook doit confirmer 1 cadeau (obtenu undefined) »), sans lien apparent avec le travail de réorganisation de l'accueil en cours.
- **Cause** : `fapshi-webhook.js` appelle désormais `getCommandesOccasion()` en plus de `getPaiements()`/`getCadeaux()` (ajouté plus tôt dans la même session, pour le séquestre occasion) — mais le mock de `check-gift-flow.mjs` n'avait pas été mis à jour avec cette troisième requête, qui échouait donc silencieusement (« Appel non mocké ») et faisait avorter le test.
- **Correctif** : ajout de `{ method: 'GET', match: '/rest/v1/commandes_occasion', json: [] }` aux deux mocks webhook du test.
- **Fichier(s)** : `scripts/check-gift-flow.mjs`.
- **Leçon** : quand un fichier partagé (ici `fapshi-webhook.js`) gagne un nouvel appel réseau, **tous** ses tests par mock doivent être mis à jour dans le même geste — `npm run check` complet (pas juste le test du sujet du jour) doit tourner avant de conclure qu'une session est terminée, précisément pour attraper ce genre de rupture différée.

### [2026-07-20] Un abonné Reader+ lisait n'importe quelle œuvre premium sans que l'auteur soit payé
- **Symptôme** : après le correctif du même jour (« abonné devait racheter chaque œuvre »), un abonné Reader+/Auteur Pro obtenait un accès illimité à **toutes** les œuvres premium — y compris celles d'auteurs qui n'ont rien choisi de tel. L'auteur touchait **0 FCFA** pour ces lectures (signalé par Franklin : « les auteurs ne vont pas le faire gratuitement »).
- **Cause** : le correctif précédent honorait la promesse marketing (« accès illimité ») mais ignorait une restriction déjà actée dans le design (`ADAPTATION_STANDARDS_KDP.md` §5.3, écrit avant tout code) : **seules les œuvres explicitement en « Kalamundi Select »** (opt-in auteur, exclusivité, 70 % au lieu de 50 %) doivent être incluses dans l'abonnement. Le fonds mensuel qui doit rémunérer l'auteur à la page lue (§5.2) n'existe pas non plus — donc même les œuvres Select ne seraient pas payées aujourd'hui, mais au moins l'auteur aurait consenti à l'exclusivité en échange.
- **Correctif** : `verifierAccesPremium()` exige désormais l'abonnement actif **ET** un opt-in Select explicite de l'œuvre (`oeuvreEstEnAbonnement()` : résout la fiche `livres` puis cherche une offre `livre_offres.type='lecture_abonnement'` active). Aucun auteur n'ayant encore opté, l'accès abonnement est fermé partout tant que Select + le fonds de rémunération ne sont pas construits. Vérifié en direct contre la base réelle (0 offre Select existante → accès refusé).
- **Fichier(s)** : `assets/js/api.js`, `scripts/check-abonnement-perks.mjs`.
- **Leçon** : honorer une promesse marketing ne suffit pas — il faut vérifier qu'elle ne déshabille pas un autre acteur (ici l'auteur) pour habiller le premier (ici l'abonné). Un correctif qui ouvre un accès doit toujours être confronté à « qui est payé pour ça ? » avant d'être livré.

### [2026-07-20] Le plan Institution (10 000 FCFA/mois) ne livre aucune de ses promesses — pas un bug, une fonctionnalité non construite
- **Symptôme** : audit du plan Institution après correction de Reader+/Auteur Pro. Ses 4 avantages techniques annoncés (équipe, tableau de bord, stats collectives, badge vérifié) ne sont livrés par aucun code.
- **Cause** : `assets/js/institution.js` (inscription libre d'établissement, table `institutions`) et le paiement `profiles.abonnement='institution'` sont **deux systèmes déconnectés** qui partagent juste un nom. `institution.js` ne lit `profiles.abonnement` nulle part. Plus grave : la table `institutions` n'a qu'un `user_id` — **aucun modèle de données pour une équipe/plusieurs membres** n'existe. Ce n'est donc pas un simple câblage à corriger (contrairement à Reader+/Auteur Pro) : la fonctionnalité « accès équipe » n'a jamais été construite.
- **Correctif** : **vente suspendue** (décision Franklin, 2026-07-20) sur les 3 fronts — `pages/abonnements.html` (carte « Bientôt disponible », CTA remplacé par contact `institutions@kalamundi.com`), `assets/js/payment.js` (plan retiré de `PLANS`, message explicite si atteint), et surtout **`functions/api/fapshi-pay.js`** (rejet serveur 403 sur `plan === 'abonnement_institution'` — le vrai verrou, un blocage frontend seul n'empêche pas un appel direct à l'API). 0 abonné payant existant au moment de la suspension, aucun impact client.
- **Fichier(s)** : `pages/abonnements.html`, `assets/js/payment.js`, `functions/api/fapshi-pay.js`.
- **Leçon** : après avoir corrigé un bug de câblage, vérifier si les plans voisins ont le **même symptôme** avant de considérer le sujet clos — ici le symptôme était le même mais la cause profonde très différente (fonctionnalité manquante, pas signal mal branché). Et quand on suspend une vente, le blocage **serveur** est le seul qui compte réellement — le reste n'est que du confort d'UX.

### [2026-07-20] Abonné Reader+/Auteur Pro devait quand même racheter chaque œuvre premium
- **Symptôme** : un lecteur payant 1000 FCFA/mois pour « accès illimité aux œuvres premium » (promesse affichée sur `/pages/abonnements.html`) devait en réalité payer chaque œuvre premium séparément — l'abonnement n'ouvrait rien.
- **Cause** : `api.verifierAccesPremium()` ne vérifiait que la table `acces_premium` (achats/prêts individuels par œuvre) et ne consultait jamais `profiles.abonnement`. La promesse marketing n'avait aucune contrepartie côté accès.
- **Correctif** : `verifierAccesPremium()` retombe désormais sur un nouvel `aAbonnementActif(userId, ['reader_plus','auteur_pro'])` quand aucun accès individuel n'existe (Auteur Pro inclut Reader+, donc les deux couvrent l'accès premium).
- **Fichier(s)** : `assets/js/api.js`.
- **Leçon** : une page marketing qui promet un avantage n'est pas une preuve qu'il est implémenté — vérifier le code qui *accorde* l'avantage, pas seulement le texte qui le *vend*.

### [2026-07-20] La pub s'affichait quand même aux abonnés Reader+
- **Symptôme** : « Aucune publicité » annoncé pour Reader+, mais les pubs Monetag s'affichaient à tous les utilisateurs, abonnés ou non.
- **Cause** : `app.js` vérifiait `session.user.user_metadata.plan === 'premium'` pour couper la pub, mais le webhook de paiement écrit `profiles.abonnement = 'reader_plus'` (une table différente, un champ différent, une valeur différente) — la condition ne pouvait jamais être vraie.
- **Correctif** : `app.js` utilise désormais `api.aAbonnementActif(session.user.id, ['reader_plus','auteur_pro'])`, la même source de vérité que l'accès premium (un seul mécanisme d'abonnement, pas deux qui divergent).
- **Fichier(s)** : `assets/js/app.js`, `assets/js/api.js`.
- **Leçon** : quand deux features (accès premium, gating pub) doivent réagir au même abonnement, elles doivent lire la **même** source — sinon elles divergent silencieusement dès que l'une est corrigée sans l'autre.

---

### [2026-07-16] Un paiement en euros valait 655 fois trop peu
- **Symptôme** : un acheteur de la diaspora payant en EUR aurait été débité d'un montant absurde — 10 € auraient été encaissés comme **10 FCFA** (≈ 0,015 €).
- **Cause** : `fapshi-pay.js` ne convertissait que l'USD ; toute autre devise tombait dans `parseInt(montant)` et était donc **traitée comme des XAF**. L'EUR n'était pas géré du tout, et une devise inconnue passait silencieusement.
- **Correctif** : conversion centralisée dans `scripts/lib/devises.mjs` (parité fixe légale 1 EUR = 655,957 XAF) ; toute devise non reconnue est désormais **refusée** au lieu d'être supposée en XAF. `normaliserDevise` n'a volontairement **aucun repli implicite**.
- **Fichier(s)** : `functions/api/fapshi-pay.js`, `scripts/lib/devises.mjs`, `scripts/check-devises.mjs`.
- **Leçon** : un défaut silencieux sur une devise est une faute comptable. En cas de doute, refuser — jamais supposer la devise de base.

### [2026-07-16] Le dollar était converti avec la parité de l'euro
- **Symptôme** : un paiement en USD était converti au taux **655,957**, soit une surfacturation d'environ 8-10 %.
- **Cause** : 655,957 est la **parité fixe du franc CFA à l'EURO** (arrimage légal depuis 1999), pas un taux du dollar. Le code l'appliquait à l'USD, traitant de fait 1 USD = 1 EUR.
- **Correctif** : le taux USD devient configurable (`TAUX_USD_XAF`, car le dollar **flotte**), avec un garde-fou de plage et un **tripwire nommé** qui refuse explicitement 655,957 comme taux USD.
- **Fichier(s)** : `functions/api/fapshi-pay.js`, `scripts/lib/devises.mjs`.
- **Leçon** : ne jamais réutiliser une constante monétaire hors de sa devise. Une parité fixe (EUR) et un taux flottant (USD) sont deux natures différentes — le code doit le dire.

### [2026-07-16] Tous les EPUB générés étaient invalides (préfixe `epub:` non déclaré)
- **Symptôme** : aucun — et c'est le problème. Les EPUB se construisaient sans erreur mais étaient structurellement invalides ; un lecteur strict (Readium, epubcheck) les aurait rejetés.
- **Cause** : les documents de chapitre utilisaient `epub:type="chapter"` sans déclarer `xmlns:epub` sur `<html>` (le `nav.xhtml`, lui, le déclarait). Un préfixe XML non déclaré rend le document mal formé. Présent dans **les deux** générateurs.
- **Correctif** : ajout de `xmlns:epub="http://www.idpf.org/2007/ops"` sur le `<html>` des chapitres, dans les deux builders.
- **Fichier(s)** : `scripts/build_epub.mjs` (`chapitreXhtml`), `assets/js/epub-builder.js`.
- **Leçon** : si on écrit un attribut préfixé (`epub:`, `dc:`, `xsi:`), on déclare le namespace **dans le même document**. Corollaire : un défaut sans symptôme visible ne se trouve que si une validation tourne vraiment (cf. entrée suivante).

### [2026-07-16] La validation epubcheck ne s'exécutait jamais
- **Symptôme** : `npm run epub:validate` sortait en « Validation epubcheck indisponible » (code 2) et le pipeline restait vert — donc des EPUB invalides passaient (cf. entrée précédente).
- **Cause** : la validation dépendait entièrement d'un **epubcheck externe (Java + jar)** absent de la machine et de la CI. Sans dépendance installée, aucun contrôle n'était effectué du tout.
- **Correctif** : ajout d'un **validateur structurel natif** (sans Java) — OCF (mimetype premier/stocké/exact), container → rootfile, OPF (unique-identifier, `dc:title`, `dc:language`, `dcterms:modified`), cohérence manifest ↔ archive, spine ↔ manifest, item `properties="nav"`, et préfixes de namespace XML non déclarés. Il tourne **toujours** ; epubcheck devient une passe profonde optionnelle. Branché dans `check-epub-pipeline` donc dans `npm run check`.
- **Fichier(s)** : `scripts/lib/epub-validator.mjs` (nouveau), `scripts/validate_epub.mjs`, `scripts/check-epub-pipeline.mjs`.
- **Leçon** : une validation qui dépend d'un binaire externe optionnel n'est pas une validation — c'est un vœu. Un contrôle qui peut « skipper » silencieusement doit avoir un socle natif qui, lui, échoue vraiment.

### [2026-07-16] `npm run epub:build` ne faisait rien sur Windows
- **Symptôme** : `node scripts/build_epub.mjs --help` (ou `--input/--out`) n'affichait rien, ne produisait aucun fichier, et sortait en code 0.
- **Cause** : la garde d'exécution CLI comparait `import.meta.url` à `` `file://${process.argv[1].replace(/\\/g,'/')}` `` → `file://C:/...` alors que `import.meta.url` vaut `file:///C:/...` (trois barres). Jamais égal → `main()` jamais appelé. Invisible car `check-epub-pipeline` passe par un `import`, pas par la CLI.
- **Correctif** : comparaison via `pathToFileURL(process.argv[1]).href`, robuste sur toutes les plateformes.
- **Fichier(s)** : `scripts/build_epub.mjs`.
- **Leçon** : ne jamais reconstruire une URL de fichier à la main — utiliser `pathToFileURL`. Et un script CLI doit être testé **via la CLI**, pas seulement via ses exports.

### [2026-07-16] `main()` crashait sur `CRC_TABLE` (zone morte temporelle)
- **Symptôme** : une fois la garde CLI réparée, `build_epub.mjs` levait `ReferenceError: Cannot access 'CRC_TABLE' before initialization`.
- **Cause** : `main()` était appelé en **tête** de module alors que `const CRC_TABLE` est initialisé en **bas** du fichier → accès en zone morte temporelle. Le bug était masqué par la garde cassée (main() ne s'exécutait jamais) et invisible à l'import (le module est alors entièrement évalué avant usage).
- **Correctif** : déplacement de l'appel `main()` en fin de module, après l'initialisation de `CRC_TABLE`, avec un commentaire expliquant la contrainte.
- **Fichier(s)** : `scripts/build_epub.mjs`.
- **Leçon** : l'appel CLI d'un module ESM se met **en fin de fichier**. Un bug peut en masquer un autre : après avoir réparé une garde, re-tester le chemin qu'elle protégeait.

### [2026-07-16] Lecteur EPUB cherchait un statut inexistant
- **Symptôme** : le mode EPUB pouvait ne jamais trouver une édition EPUB créée par le modèle `livre_editions`.
- **Cause** : le lecteur filtrait `livre_editions.statut = 'publie'`, alors que la migration `V007` définit les statuts valides comme `active`, `brouillon`, `retiree`, `archivee`.
- **Correctif** : alignement de `getEditionEpub` sur `statut = 'active'` et ajout d'un contrôle dans `check-epub-pipeline`.
- **Fichier(s)** : `assets/js/api.js`, `scripts/check-epub-pipeline.mjs`.
- **Leçon** : le code client doit reprendre strictement les valeurs CHECK des migrations, pas inventer une variante métier.

### [2026-07-16] Migration chapitres normalisés incompatible avec la table réelle
- **Symptôme** : l'exécution de `V008__chapitres_normalisation_epub.sql` échouait avec `column "contenu" does not exist`.
- **Cause** : la migration calculait `source_hash` avec `COALESCE(contenu_texte, contenu, '')`, mais la table Supabase Kalamundi ne possède pas de colonne `contenu`.
- **Correctif** : remplacement par un bloc SQL conditionnel qui utilise `contenu_texte` si présent, `contenu` seulement si elle existe, puis `id` en fallback.
- **Fichier(s)** : `migrations/V008__chapitres_normalisation_epub.sql`.
- **Leçon** : les migrations doivent vérifier les colonnes historiques optionnelles avant de les référencer, même dans un `COALESCE`.

### [2026-07-16] Chapitres courts fusionnés à tort
- **Symptôme** : un livre avec des chapitres courts pouvait être interprété comme un seul chapitre ou comme un chapitre fusionné, ce qui dégradait le lecteur et la navigation.
- **Cause** : le filtre anti-faux-titres fusionnait deux titres dès qu'ils étaient proches, sans vérifier si du contenu réel existait entre eux.
- **Correctif** : fusion uniquement lorsque deux titres sont réellement consécutifs, ajout du contrôle `check-epub-pipeline` et partage du normaliseur avec l'outil de redécoupage.
- **Fichier(s)** : `assets/js/upload.js`, `scripts/lib/book-normalizer.mjs`, `scripts/redecouper_chapitres.mjs`, `scripts/check-epub-pipeline.mjs`.
- **Leçon** : la proximité entre deux titres n'est pas suffisante pour conclure à un faux chapitre ; il faut inspecter le contenu intermédiaire.

### [2026-07-16] Démarrage lecteur en ligne trop fragile
- **Symptôme** : une œuvre pouvait refuser de s'ouvrir en ligne si le chargement séparé de la liste des chapitres échouait ou revenait vide, même lorsque la fiche œuvre était disponible.
- **Cause** : le lecteur chargeait l'œuvre et les chapitres dans un seul `Promise.all`, puis basculait directement vers le mode local en cas d'échec global.
- **Correctif** : séparation du chargement œuvre → chapitres, ajout d'un fallback depuis les chapitres embarqués dans l'œuvre, et ajout d'un contrôle de régression dédié lecteur/Roboto.
- **Fichier(s)** : `assets/js/reader.js`, `scripts/check-reader-regression.mjs`, `package.json`, `sw.js`.
- **Leçon** : le mode offline doit rester un secours, pas rendre le démarrage online dépendant d'un chargement groupé fragile.

### [2026-07-16] Royalties Premium affichées à 70 %
- **Symptôme** : le formulaire de publication annonçait que l'auteur recevait 70 % des revenus directs en mode Premium.
- **Cause** : l'ancienne copie marketing n'avait pas été alignée sur la décision D10 validée : royalties 50/50, option « Kalamundi Select » 70 % non actée.
- **Correctif** : remplacement du texte Premium par le partage 50 % auteur / 50 % Kalamundi, ajout du rappel dans le récapitulatif et dans le dashboard auteur.
- **Fichier(s)** : `pages/publish.html`, `assets/js/publish.js`, `pages/author-dashboard.html`.
- **Leçon** : toute promesse de revenus doit être reliée aux décisions de `PLANIFICATION_KALAMUNDI.md`, pas à une copie antérieure.

### [2026-07-16] Livre sauvegardé inutilisable hors connexion
- **Symptôme** : un livre marqué disponible hors-ligne pouvait ne pas s'ouvrir sans réseau ; la page `/offline.html` affichait seulement un message générique au lieu des livres sauvegardés.
- **Cause** : le lecteur exigeait encore Supabase au démarrage pour charger l'œuvre et la liste des chapitres ; IndexedDB ne servait qu'en secours tardif sur le contenu d'un chapitre.
- **Correctif** : ajout d'un démarrage lecteur depuis IndexedDB, lecture directe des chapitres locaux et transformation de `/offline.html` en bibliothèque locale avec liste, taille stockée, statut réseau et suppression.
- **Fichier(s)** : `assets/js/reader.js`, `offline.html`, `assets/js/offline-page.js`, `sw.js`.
- **Leçon** : une fonctionnalité hors-ligne doit être testée depuis l'entrée utilisateur complète, pas seulement au niveau du cache d'un chapitre.

### [2026-06-23] Suppression d'œuvre impossible / résidus
- **Symptôme** : la suppression d'une œuvre échouait ou laissait des données orphelines.
- **Cause** : opération tentée côté client, bloquée/incohérente vis-à-vis des politiques RLS Supabase.
- **Correctif** : déplacée côté serveur dans une Pages Function `/api/delete-oeuvre` (clé service, suppression atomique).
- **Fichier(s)** : `functions/api/delete-oeuvre.js`, RPC `supprimer_oeuvre` (`migrations/V004`).
- **Leçon** : toute opération sensible/atomique (suppression, écriture privilégiée) passe par une **Function serveur**, jamais par le client soumis au RLS.

---

*Nouveaux bugs : ajouter au-dessus de cette ligne, au moment du correctif.*
