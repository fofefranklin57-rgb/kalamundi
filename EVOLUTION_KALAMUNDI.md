# 📈 ÉVOLUTION KALAMUNDI
### Journal daté de ce qui est construit et décidé

*Créé le 15 juillet 2026.*
*Règle : on ajoute une entrée à chaque évolution significative (feature, décision, correctif majeur) — jamais en lot rétroactif. Entrée la plus récente en haut.*

Format : `AAAA-MM-JJ — [type] description`
Types : `feat` (fonctionnalité) · `decision` (choix produit) · `fix` (correctif) · `perf` · `docs` · `infra`

---

## 2026-07

- **2026-07-16 — feat** : P0.2 livré — interface auteur modernisée : dashboard enrichi par un bloc standard auteur (50/50, statistiques, dépôt), formulaire publication doté d'un cockpit qualité dynamique, résumé obligatoire, validation fichier réelle, rappel couverture 1,6:1 et cache PWA bumpé en `kala-v15`.
- **2026-07-16 — feat** : P0.1 livré — lecteur premium renforcé : choix de police de lecture, thèmes jour/nuit/sépia appliqués proprement, réglages qui repaginent le livre, note d'annotation/surlignage visible et cache PWA bumpé en `kala-v14`.
- **2026-07-16 — docs** : ajout d'un **ordre d'exécution priorisé** (section E de `PLANIFICATION`, tiers P0→P5 avec dépendances). Pivot identifié : le modèle « Livre + Offres » (n°5) débloque le commerce → à faire tôt.
- **2026-07-16 — fix** : fiabilisation du mode hors-ligne lecteur : `offline.html` devient une bibliothèque locale listant les livres sauvegardés, le lecteur peut démarrer depuis IndexedDB sans réseau, et le cache PWA passe en `kala-v13`.
- **2026-07-16 — feat** : ajout d'une porte d'entrée `Kalamundi Campus` sur l'accueil, alignée avec D12 : accès clair aux annales, examens simulés, Super Répétiteur et espaces institutions, textes internationalisés et cache PWA bumpé en `kala-v12`.
- **2026-07-16 — feat** : ajout du shell mobile Phase 1 : barre d'onglets basse commune (Accueil · Explorer · Apprendre · Biblio · Profil) injectée sur les pages cœur, avec exclusions lecteur/paiement/login/admin/owner et cache PWA bumpé en `kala-v11`.
- **2026-07-16 — style** : application du socle design global Phase 1 : polices Fraunces/Inter auto-hébergées, tokens `base.css` modernisés (base crème, bordures neutres, rayons/ombres), composants communs adoucis (boutons, cartes, inputs, search, skeleton) et Service Worker bumpé en `kala-v10`.
- **2026-07-16 — decision ✅** : deux piliers stratégiques ajoutés — **D13 canal maisons d'édition** (comptes catalogue, ONIX/EPUB, revenus négociés, onboarding via collectifs) et **D14 mission culturelle** (Fonds patrimoine « Kalamundi Héritage » public-bien + partenariat MINAC/OIF/UNESCO). Nuance factuelle : le Cameroun a une BN + loi dépôt légal 2000 + programme MINAC PNNPC, mais pas d'accès numérique national → Kalamundi = couche d'accès partenaire, pas remplaçant. Doc : `VISION_EDITEURS_ET_PATRIMOINE.md`.
- **2026-07-16 — docs** : création de `DESIGN_SYSTEM_KALAMUNDI.md` (nouveaux tokens exacts pour `base.css`) + `INTERFACES_KALAMUNDI.md` (inventaire de tous les écrans par rôle + priorités). Référencés dans `AGENTS.md`.
- **2026-07-16 — docs** : création de `AGENTS.md` + `CLAUDE.md` (contrat de travail pour Codex/agents : documentation d'abord, journalisation obligatoire évolutions + erreurs, direction design, règles code/métier). Codex démarre la mise en œuvre.
- **2026-07-16 — decision ✅** : **D10 tranchée — royalties 50/50** (50 % auteur). Option « Kalamundi Select » 70 % gardée en réserve, non actée.
- **2026-07-16 — decision** : priorité transverse — **moderniser toutes les interfaces clés** (auteur, lecteur, boutique, éducation) selon `BIBLE §10`.
- **2026-07-15 — docs** : création du socle de pilotage — `BIBLE_KALAMUNDI.md`, `PLANIFICATION_KALAMUNDI.md`, `EVOLUTION_KALAMUNDI.md`, `ERROR_LOG.md`, en complément de `RECONCEPTION_KALAMUNDI.md` et `MEMO_MARKETPLACE_LIVRE.md`.
- **2026-07-15 — decision** : pivot stratégique acté — Kalamundi devient une « super-app du livre » (lire / apprendre / publier / acheter / vendre / emprunter). Décisions D0–D9 proposées, en attente de validation Franklin.
- **2026-07-15 — decision ✅** : **D9 validée par Franklin** — accepter tous formats (natif/Word/PDF/EPUB) → convertisseur « égalisateur » qui normalise en chapitres internes ET build un EPUB canonique. Lecteur web type Readium/Thorium. Traduction préservée par la normalisation (vigilances : nœuds de texte, langue source déclarée). Checklist de dépôt auteur (langue originale obligatoire). Sortie validée par epubcheck. Readium **LCP** = socle du futur prêt.
- **2026-07-15 — decision ✅** : **diaspora** intégrée à la cible (D11) — achat/location par la diaspora → paiement international (cartes/PayPal) + multi-devises (EUR/USD/FCFA) + **gifting** (offrir un livre livré à un proche au pays).
- **2026-07-15 — decision ✅** : **D12 validée** — éducation option (a) : intégrée maintenant, séparable plus tard en PWA dédiée **« Kalamundi Campus »** sur backend partagé. **D5 validée** — périmètre **Cameroun + diaspora d'abord**, extension aux autres pays africains si succès.
- **2026-07-15 — proposition** : **stratégie éducation** (D12) — recommandation « intégré maintenant, séparable plus tard en PWA dédiée sur backend partagé » (Kalamundi est un PWA → séparer coûte peu). Le produit doit se différencier des « apps à PDF » (quiz interactifs, corrigés IA, examen simulé, répétiteur, lien achat/location manuels, accessibilité type Eneza, canal écoles B2B). Doc : `PROPOSITION_EDUCATION.md`.
- **2026-07-15 — decision** : **adopter les standards des grandes plateformes** (KDP en référence) pour la publication — EPUB, métadonnées ONIX-like, couverture 1,6:1, royalties transparentes (50 % / 70 % « Kalamundi Select »), paiement à la page lue en abonnement, reporting auteur niveau KDP. Doc : `ADAPTATION_STANDARDS_KDP.md`. Décision **D10** (taux à confirmer). Print-on-demand et distribution externe reportés.
- **2026-07-05 — feat** : sélecteur de langue appliqué à toute l'interface *(commit `37b725e`)*.
- **2026-07-05 — fix** : filtrage de l'étagère « auteurs » corrigé *(commit `68dac55`)*.
- **2026-07 — feat** : stats de lecture « honnêtes » sur la home + filtres de collection de la bibliothèque clarifiés *(commits `de22baf`, `3cec321`, `c6f0913`)*.

## 2026-06

- **2026-06-23 — fix** : suppression d'œuvre déplacée côté serveur via Pages Function `/api/delete-oeuvre` (contournement RLS, fiabilisée).
- **2026-06-23 — perf** : optimisations majeures (parallélisme des requêtes, Service Worker minimal, `FETCH_LIMIT` 60).
- **2026-06-23 — feat** : meta OG dynamiques sur la page œuvre (partage social).
- **2026-06 — feat** : espace étudiant (annales, épreuves, examen simulé, répétiteur) *(migration `V003`)*, paywall chapitres gratuits *(`V006`)*, communautés/commentaires *(`V005`)*.

---

*Antérieur à juin 2026 : voir l'historique git (`git log`) pour le détail des débuts (publication, lecteur, abonnements Fapshi, PWA).*
