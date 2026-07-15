# CLAUDE.md — Kalamundi

**Les règles de travail sont dans [`AGENTS.md`](AGENTS.md). Les lire en premier, elles sont impératives.**

Résumé des 3 réflexes non négociables :
1. **Documentation d'abord** — avant de coder, lire la doc du dossier (`BIBLE_KALAMUNDI.md`, `PLANIFICATION_KALAMUNDI.md`, etc.). Ne rien faire qui contredise une décision validée.
2. **Journaliser toujours** — chaque évolution → `EVOLUTION_KALAMUNDI.md` ; chaque bug corrigé → `ERROR_LOG.md` (dans le commit de correction) ; jamais en lot.
3. **Moderniser les interfaces** (auteur, lecteur, boutique, éducation) selon la direction design de `BIBLE §10`, toujours via les variables CSS de `assets/css/base.css`.

Kalamundi ≠ ImmoGest — backends Supabase différents, ne jamais confondre les credentials.
