# PENSER KALAMUNDI AVANT DE LE REFAIRE
### Document de réflexion préalable — aucune ligne de code, aucune maquette. On réfléchit.

*15 juillet 2026. À lire, annoter, discuter. On ne construit rien tant que ces choix ne sont pas tranchés.*

---

## 1. Le point de départ honnête

Kalamundi aujourd'hui est **bon là où il est**, mais **incomplet pour l'ambition**.

- Ce qu'il fait déjà bien : publier des œuvres sérialisées, les lire (annotations, progression, traduction, offline), un vrai vertical **éducation** (annales, répétiteur), des **abonnements payés en Mobile Money (Fapshi)**.
- Ce qu'il n'est pas : un lieu où l'on **achète, vend et emprunte** des livres — numériques comme papier.

Le piège serait de croire qu'on part de zéro. **Faux.** On a déjà : les utilisateurs, l'auth, le paiement mobile, le lecteur, le catalogue d'œuvres, l'offline. Ce qu'on ajoute, c'est **une couche commerce et une couche sociale par-dessus** — pas une réécriture.

Le vrai risque n'est pas technique. Il est **conceptuel** : si on empile des fonctions sans une idée directrice claire, on obtient un app confus qui fait tout à moitié. D'où ce document.

---

## 2. L'idée directrice (à valider en premier)

> **Kalamundi = le lieu unique du livre africain : je lis, j'apprends, je publie, j'achète, je revends, j'emprunte — en FCFA / Mobile Money, même hors ligne.**

Ce que cette phrase **engage** :
- Un **objet central unique** : le livre (sous toutes ses formes — œuvre sérialisée, ebook, audio, papier neuf, papier d'occasion).
- Un **utilisateur unique** qui change de casquette (lecteur → acheteur → vendeur → auteur) sans changer d'app ni de compte.
- Une **monnaie de confiance** : le paiement mobile local, déjà là.

Ce que cette phrase **ne veut PAS dire** :
- Pas « faire comme Amazon ». Amazon a une logistique mondiale ; nous, non. On adapte au terrain (voir §7).
- Pas « tout ouvrir en même temps ». La super-app se construit **espace par espace** (voir §9).

**Décision 0 à trancher :** est-ce bien CETTE Kalamundi qu'on veut ? Ou une version plus resserrée (ex. « lecture + éducation + achat » sans le C2C d'occasion ni le prêt) ? Tout le reste du document découle de ce choix.

---

## 3. Pour QUI ? (les vraies personnes derrière les fonctions)

On ne conçoit pas des « fonctionnalités », on résout les problèmes de gens réels au Cameroun.

| Persona | Ce qu'il veut vraiment | Ce que Kalamundi lui offre demain |
|---|---|---|
| **L'étudiant** (Yaoundé/Douala, budget serré, data chère) | Réviser, trouver ses manuels et annales pas cher, revendre ses anciens bouquins | Éducation (déjà) + **acheter/revendre manuels d'occasion** + **emprunter** |
| **Le lecteur-plaisir** | Découvrir de la fiction africaine, lire hors ligne, payer petit | Lecture sérialisée (déjà) + **micro-achat au chapitre** + découverte sociale |
| **L'auteur** | Être lu, être **payé**, exister | Publication (déjà) + **royalties transparentes** + vente papier print-on-demand |
| **Le vendeur particulier** | Vider sa bibliothèque, gagner un peu | **Lister un livre d'occasion** (scan, prix, photo) + payout MoMo |
| **Le libraire / éditeur local** | Écouler son stock, toucher le mobile | **Boutique pro** dans Kalamundi (catalogue, commandes) |
| **L'école / bibliothèque** | Donner accès à des fonds à ses élèves | **Prêt institutionnel** (B2B2C), abonnement établissement |

**Question ouverte :** parmi ces 6, **lesquels sont prioritaires** ? Mon intuition : **l'étudiant** est le cœur (il cumule lecture + éducation + achat + revente + prêt, et c'est déjà ta base). Si on optimise pour lui, tout le reste suit. À valider.

---

## 4. Les 6 espaces — pensés un par un

Pour chaque espace : ce que c'est, ce qu'on a déjà, ce qui manque, d'où vient l'argent, difficulté (1=facile, 5=dur).

### 📖 Espace LIRE (existe — à enrichir)
- **A déjà :** lecteur, chapitres, annotations, progression, offline, paywall chapitre.
- **Manque :** confort de lecture (réglages typo, thèmes), **couche sociale** (notes, avis, étagères « à lire »), stats à la Wattpad.
- **Argent :** abonnement + micro-achat chapitre (monnaie virtuelle ?).
- **Difficulté : 2.** C'est de l'amélioration, pas de la création.

### 🎓 Espace APPRENDRE (existe — la douve)
- **A déjà :** annales, épreuves, examen simulé, répétiteur, corrigés IA.
- **Manque :** liaison avec l'achat de manuels, offre établissement.
- **Argent :** abonnement étudiant + **canal écoles (récurrent, stable)**.
- **Difficulté : 1.** À préserver, c'est ce que les concurrents n'ont pas.

### ✍️ Espace PUBLIER (existe — à professionnaliser)
- **A déjà :** publication, chapitres programmés, dashboard auteur, contrat, partage revenus.
- **Manque :** **royalties transparentes** (le vrai aimant à auteurs, cf. KDP/Bibook), option **papier print-on-demand**.
- **Argent :** commission sur ventes de l'auteur.
- **Difficulté : 3.** Surtout du produit + un peu de compta.

### 🛒 Espace ACHETER (à créer — le grand manque n°1)
- **A déjà :** rien côté « produit-livre ». On a des « œuvres », pas des « produits ».
- **Manque :** **entité Livre/produit** (ISBN, formats, prix, stock), **panier + checkout multi-articles**, store à rails, achat papier neuf, livraison.
- **Argent :** marge sur ventes numériques + papier.
- **Difficulté : 4.** C'est un vrai e-commerce à bâtir.

### 💸 Espace VENDRE / OCCASION (à créer — le grand manque n°2)
- **A déjà :** rien.
- **Manque :** **listing vendeur** (scan ISBN, état, photo, prix), profil + notes vendeur, **escrow**, **payout MoMo**, commission, logistique de proximité.
- **Argent :** commission C2C (10–20 %).
- **Difficulté : 5.** C'est le plus dur (confiance + logistique + argent qui circule entre inconnus).

### 🔄 Espace EMPRUNTER / PRÊT (à créer — le plus subtil)
- **A déjà :** rien.
- **Manque :** **accès temporel** (le livre « disparaît » à l'échéance), **files d'attente**, **droits** (accord des ayants droit), variante papier avec **caution**.
- **Argent :** peu direct — c'est un **produit d'acquisition/fidélisation** (comme les bibliothèques) + abonnement institutionnel.
- **Difficulté : 5.** Autant juridique que technique.

**Ce que ce tableau nous dit :** on a déjà 3 espaces (Lire, Apprendre, Publier) à ~60-80 %. Les 3 à créer (Acheter, Vendre, Emprunter) sont exactement par ordre de difficulté croissante. **Cela dicte le séquencement** (§9).

---

## 5. Comment les 6 espaces cohabitent (le vrai défi de design)

Le danger : 6 espaces = 6 apps collées = confusion. La solution : **tout tourne autour d'un seul objet, le Livre**, et l'utilisateur ne « change pas de monde », il **agit sur un livre**.

Modèle mental proposé : **une fiche livre unique** depuis laquelle on peut, selon disponibilité :
- **Lire** (si œuvre numérique) — bouton Lire / S'abonner
- **Acheter** (numérique ou papier neuf) — bouton Acheter
- **Emprunter** (si prêtable) — bouton Emprunter
- **Trouver d'occasion** (si des vendeurs en proposent) — « 3 vendeurs à partir de 1 500 FCFA »
- **Noter / avis / ajouter à mes étagères** (social)

→ L'utilisateur ne pense pas « je vais dans l'espace vente ». Il pense « je veux CE livre » et Kalamundi lui montre **toutes les façons de l'obtenir**. C'est ça, la super-app. C'est aussi ce qu'aucun concurrent camerounais ne fait.

**Question ouverte :** navigation — barre à onglets (Lire / Boutique / Apprendre / Vendre / Moi) ? Ou une home unifiée « tout livre » + un menu ? À dessiner **après** avoir tranché le modèle de données.

---

## 6. LE nœud conceptuel : « Œuvre » vs « Livre »

C'est la décision la plus structurante de toute la refonte. À penser maintenant, pas au moment de coder.

Aujourd'hui Kalamundi connaît des **Œuvres** (contenu sérialisé, chapitres, écrites sur la plateforme). Demain il faut aussi des **Livres-produits** (un ISBN, des éditions, des formats, un prix, éventuellement du papier, pas forcément écrit chez nous).

Trois façons de modéliser — à choisir :
- **(A) Deux entités séparées** (Œuvre ≠ Produit). Simple à démarrer, mais risque de deux catalogues qui s'ignorent.
- **(B) Une entité « Livre » générique** dont l'Œuvre-maison est un cas particulier. Plus élégant, plus dur à migrer.
- **(C) Un « Livre » abstrait + des « offres »** attachées (offre-lecture, offre-achat-numérique, offre-papier, offres-occasion des vendeurs, offre-prêt). ← *C'est le modèle des grandes plateformes (Goodreads « editions », Amazon « offers »). Le plus puissant pour la fiche unifiée du §5.*

Mon avis : viser **(C)** comme cible, mais l'**introduire progressivement** pour ne pas casser l'existant. **À débattre** — c'est un choix d'architecture, pas de goût.

---

## 7. Les questions difficiles à trancher AVANT de coder

Ce sont les sujets qui tuent les marketplaces si on ne les pense pas d'abord.

1. **Logistique physique.** Vend-on du papier dès le début, ou d'abord **100 % numérique** ? Si papier : main propre géolocalisée ? points relais ? coursiers moto ? On ne s'improvise pas transporteur. *Recommandation : démarrer numérique, papier en pilote local (une ville).*

2. **Confiance / argent entre inconnus (C2C).** Sans **escrow** (l'argent n'est libéré qu'à réception confirmée), la fraude tue le marché. Comment gère-t-on un litige ? un vendeur qui n'envoie pas ? *À penser avant la première vente.*

3. **Payouts.** Encaisser via Fapshi, on sait faire. **Reverser** à un vendeur particulier sur son MoMo : Fapshi le permet-il ? à quel coût ? plafond ? *À vérifier tôt — bloquant pour l'espace Vendre.*

4. **Droits pour le prêt.** Prêter un livre numérique = besoin de l'accord de l'ayant droit. Qui fournit le fonds prêtable ? Nos auteurs-maison (facile, on a les contrats) ? Des éditeurs (à négocier) ? Des écoles ? *Commencer par notre propre fonds.*

5. **Monnaie virtuelle ou paiement direct ?** Wattpad utilise des « Pièces » (on recharge, on dépense). Avantage : micro-transactions fluides, moins de frais MoMo par achat. Inconvénient : complexité comptable + réglementaire (on stocke de la valeur). *Décision à prendre : porte-monnaie interne, ou paiement Fapshi à chaque acte ?*

6. **Périmètre géographique de départ.** Cameroun seul d'abord, ou viser CEMAC tout de suite (comme Añdjeun l'annonce) ? *Recommandation : gagner le Cameroun d'abord, la crédibilité panafricaine suit.*

7. **Modération & qualité.** Qui vérifie qu'un livre vendu n'est pas piraté ? qu'une œuvre publiée respecte la loi ? Plus on ouvre au C2C, plus ce sujet grossit.

8. **Ne pas casser l'existant.** L'éducation et la lecture **financent déjà**. La refonte vient **au-dessus**, jamais à la place. Règle d'or.

---

## 8. D'où vient l'argent (modèle économique par espace)

Diversifier dès le départ — **c'est la leçon d'Okadabooks (fermé en 2023 pour avoir dépendu de la seule vente d'eBooks).**

| Source | Espace | Nature |
|---|---|---|
| Abonnement lecture | Lire | Récurrent |
| Abonnement étudiant + **licences écoles** | Apprendre | Récurrent (le plus solide) |
| Commission sur ventes auteurs | Publier | Variable |
| Marge ventes numériques/papier | Acheter | Variable |
| Commission C2C occasion | Vendre | Variable |
| Abonnement institutionnel (prêt) | Emprunter | Récurrent |

→ Deux jambes récurrentes (**éducation** + abonnements) financent la structure ; le commerce (achat/vente) apporte la croissance. Sain.

---

## 9. L'ordre dans lequel penser/faire (pour ne pas se noyer)

On **ne construit pas** encore — mais voici l'ordre logique qui découle des §4 et §7, pour que la réflexion détaillée suive le bon fil :

1. **Socle conceptuel** : trancher §2 (la vision), §3 (persona prioritaire), §6 (modèle Livre/Offre). *← on est ici.*
2. **Enrichir l'existant** (Lire + social + Publier/royalties) : peu risqué, gros effet perçu, prépare la fiche unifiée.
3. **Espace Acheter numérique** (pas de logistique) : le vrai saut e-commerce, sans le risque physique.
4. **Espace Vendre occasion** (escrow + payout + logistique pilote) : le plus dur, une fois la confiance et le paiement rodés.
5. **Espace Emprunter** : en dernier, sur notre propre fonds d'abord.

Chaque étape est **livrable seule** et rapporte avant la suivante. On n'ouvre jamais 3 chantiers en parallèle.

---

## 10. Les décisions qui t'appartiennent (à trancher pour avancer)

Rien ne se conçoit plus finement tant que ces points ne sont pas fixés :

- **D0 — Vision.** On valide « super-app du livre » (§2), ou une version resserrée ?
- **D1 — Persona cœur.** On optimise pour **l'étudiant** ? un autre ?
- **D2 — Papier ou numérique d'abord.** Démarrage 100 % numérique, papier en pilote plus tard ?
- **D3 — Modèle de données.** On vise le modèle **Livre + Offres** (option C, §6) ?
- **D4 — Paiement.** **Porte-monnaie interne (Pièces)** ou **Fapshi à chaque acte** ?
- **D5 — Périmètre.** Cameroun d'abord, puis CEMAC ? ou CEMAC d'emblée ?
- **D6 — Prêt.** On limite d'abord le prêt à **notre propre fonds d'auteurs** ?
- **D7 — Ambition C2C.** L'occasion entre particuliers, on la garde dans la vision, ou on la reporte (car c'est le plus dur) ?

---

*Quand tu auras réagi à ces 8 décisions (même en une phrase chacune), on pourra passer sereinement à l'architecture d'information détaillée, puis au modèle de données, puis — seulement ensuite — aux specs et au code.*
