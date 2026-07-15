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

### [2026-06-23] Suppression d'œuvre impossible / résidus
- **Symptôme** : la suppression d'une œuvre échouait ou laissait des données orphelines.
- **Cause** : opération tentée côté client, bloquée/incohérente vis-à-vis des politiques RLS Supabase.
- **Correctif** : déplacée côté serveur dans une Pages Function `/api/delete-oeuvre` (clé service, suppression atomique).
- **Fichier(s)** : `functions/api/delete-oeuvre.js`, RPC `supprimer_oeuvre` (`migrations/V004`).
- **Leçon** : toute opération sensible/atomique (suppression, écriture privilégiée) passe par une **Function serveur**, jamais par le client soumis au RLS.

---

*Nouveaux bugs : ajouter au-dessus de cette ligne, au moment du correctif.*
