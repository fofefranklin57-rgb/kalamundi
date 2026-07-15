# 🎓 PROPOSITION — Le volet Éducation de Kalamundi
### Appli intégrée, ou appli à part entière liée à Kalamundi ?

*Créé le 15 juillet 2026. Répond à la question de Franklin, recherche marché à l'appui. Compagnons : `BIBLE_KALAMUNDI.md`, `PLANIFICATION_KALAMUNDI.md`.*

---

## 1. État actuel

Le vertical existe en code (`education/annales/epreuves/examen-sim/repetiteur/ecole/institution`) mais est **débranché** (aucun lien depuis `index.html`). Franklin veut le **repenser** — et se demande s'il faut en faire une **appli à part entière, liée à Kalamundi**.

---

## 2. Ce que dit le marché (recherche)

**Le créneau camerounais « annales » est saturé mais faible.** Beaucoup d'apps/sites (Studirex, Épreuves du BEPC, Épreuves du Probatoire, Banque des Épreuves, Sujetexa, Mongosukulu, Épreuves et Corrigés) — mais quasi tous se limitent à **télécharger des PDF de sujets + corrigés**, financés à la pub, faible qualité pédagogique. → **Place à prendre par la qualité**, pas par le volume.

**Les modèles africains qui gagnent :**
- **uLesson** (Nigeria) : freemium premium — **vidéos + quiz interactifs + reporting de précision**, prépa examens (WAEC, GCE, A-levels). Haute production, abonnement.
- **Eneza** (Kenya) : **ultra-accessible** — leçons/quiz en SMS-USSD, abonnement via **crédit télécom**, marche sur téléphone basique, **10M+ apprenants**, « Ask a Teacher » en 5 min.

**Super-app vs appli séparée (recherche stratégie) :**
- Super-app : rétention + cross-sell + acquisition moins chère (**retenir coûte 5–25× moins que d'acquérir**). L'éducation est « un excellent add-on de super-app ».
- Appli séparée : **focus, contrôle, UX taillée** pour un usage précis. Les deux **coexistent** — la séparée complète la super-app, ne la remplace pas.
- Piège connu : les stratégies super-app **échouent** quand les dynamiques d'écosystème ne se matérialisent pas (dispersion des ressources).

---

## 3. Les arguments pour séparer (et contre)

**POUR une appli éducation dédiée :**
1. **Utilisateur et état d'esprit différents** : un élève en stress d'examen veut un outil **focalisé, sans distraction** — pas une librairie.
2. **Créneau saturé → besoin d'une identité nette** pour se démarquer des « apps à PDF ».
3. **Canal écoles (B2B)** : un établissement achète un « produit éducation », pas « un marketplace qui a aussi du scolaire ».
4. **Appareils bas de gamme / data chère** : l'éducation doit rester **légère** (leçon Eneza) — une app dédiée reste minimale.
5. **Isolation des risques** : l'éducation évolue sans déstabiliser le commerce.

**CONTRE (garder intégré) :**
1. Deux apps = double maintenance, double marketing, double friction d'installation.
2. Le cross-sell (acheter le manuel après la révision) est plus simple **dans une seule app**.
3. En phase de démarrage, **concentrer les ressources** sur une chose.

---

## 4. 💡 L'insight clé : Kalamundi est un PWA → séparer coûte peu

Le débat classique « super-app vs 2 apps natives » suppose deux apps natives coûteuses. **Ici, non.** Kalamundi est un **PWA web**. Donc « appli à part entière liée » peut se faire à **faible coût** :

> Une **PWA séparée sur un sous-domaine** (`campus.kalamundi…`), **installable** comme une app, avec sa propre UX étudiante — mais **le même backend Supabase, le même compte (SSO), le même portefeuille/paiement (Fapshi), le même catalogue de manuels**.

C'est le modèle **« colonne vertébrale partagée, façade séparée »** (comme Google : apps distinctes, un seul compte). On gagne le **focus** de la séparation sans perdre la **synergie** de l'écosystème.

---

## 5. 🎯 Recommandation : séparation **progressive**, pas d'emblée

**Maintenant (Phase 1-2)** : garder l'éducation **dans Kalamundi** mais comme un **espace « Apprendre » borné**, avec sa propre identité visuelle, **et architecturer le backend en services partagés** (auth, portefeuille, catalogue, mesure de lecture) pour que la scission soit **cheap plus tard**. Ne pas dupliquer le code tout de suite.

**Plus tard (quand traction / 1er contrat école)** : **détacher** l'éducation en **PWA dédiée** (`campus.kalamundi…`) sur le backend partagé, optimisée étudiants + offline + bas de gamme + canal écoles.

Raison : ne pas payer le coût (et le risque super-app) de deux produits avant d'avoir la preuve de traction — mais rendre la séparation **quasi gratuite le jour venu** par l'architecture.

---

## 6. Ce que le produit éducation doit ÊTRE pour gagner

Ne pas refaire « une app à PDF ». Différenciation :
1. **Annales structurées + interactives** (pas juste des PDF) : quiz auto-corrigés, score, temps.
2. **Corrigés IA** (tu as déjà `ANTHROPIC_API_KEY` + `generate-questions.js`) — à la uLesson.
3. **Examen simulé** (déjà en code : `examen-sim`) — chronométré, conditions réelles.
4. **Super Répétiteur** (déjà : `repetiteur`) — lycée + université.
5. **Lien écosystème** : après une révision, **acheter/louer le manuel** dans Kalamundi (la boucle que personne d'autre n'a).
6. **Accessibilité Eneza** : version très légère / offline pour téléphones basiques et data chère.
7. **Canal écoles (B2B)** : licences établissement = revenu **récurrent et stable** (le plus solide du modèle éco).
8. Couverture examens Cameroun : **CEP, BEPC, Probatoire, Bac, GCE O/A-levels**, + université.

---

## 7. Nom & marque (piste)

Sous-marque reliée : **« Kalamundi Campus »** (ou *Studi by Kalamundi*, *Kalamundi Écoles*). Garder « Kalamundi » dans le nom = capital de marque + confiance parents/écoles, tout en signalant le focus.

---

## 8. Décision à trancher → D12

**D12 — Stratégie éducation :**
- (a) **Intégré maintenant, séparable plus tard** (recommandé) — espace « Apprendre » borné + backend en services partagés, scission en PWA dédiée quand traction/école.
- (b) Appli séparée **tout de suite**.
- (c) Rester **100 % intégré** durablement.

*Ma reco : (a).* → ✅ **Validé par Franklin le 15/07/2026 : option (a), sous-marque « Kalamundi Campus ». Périmètre Cameroun + diaspora d'abord, extension africaine si succès.**

---

## 9. Lien avec la diaspora (voir D11)

La diaspora (achat/location + gifting) touche surtout le **commerce**, mais l'éducation en profite : un parent de la diaspora peut **payer l'abonnement révision ou offrir un manuel** à un élève resté au pays. À intégrer dans le même compte/portefeuille partagé.
