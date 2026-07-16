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

---

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
