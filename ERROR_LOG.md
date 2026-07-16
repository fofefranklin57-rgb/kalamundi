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
