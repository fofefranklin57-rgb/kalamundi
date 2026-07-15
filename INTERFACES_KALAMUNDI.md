# 🗂️ INVENTAIRE DES INTERFACES KALAMUNDI
### Toutes les pages/écrans, par rôle, avec priorité de modernisation

*Créé le 16 juillet 2026. Sert de carte à Codex : rien ne doit être oublié. Direction visuelle = `BIBLE §10` + `DESIGN_SYSTEM_KALAMUNDI.md`.*

Priorité : 🔴 haute (vu souvent / conversion) · 🟠 moyenne · 🟢 basse (légal/admin).

---

## 👤 Visiteur / public
| Écran | Fichier | Rôle | Priorité |
|---|---|---|---|
| Accueil / home | `index.html` | 1re impression, découverte, **rebrancher l'accès Éducation** | 🔴 |
| À propos | `pages/bienvenue.html` | histoire de marque (« La Plume du Monde ») | 🟠 |
| Connexion / inscription | `pages/login.html` | porte d'entrée | 🔴 |
| CGU | `pages/cgu.html` | légal | 🟢 |
| Confidentialité | `pages/confidentialite.html` | légal | 🟢 |

## 📖 Lecteur
| Écran | Fichier | Rôle | Priorité |
|---|---|---|---|
| Bibliothèque / catalogue | `pages/library.html` | **home marchande à rails** + fiche livre unifiée | 🔴 |
| Lecteur | `pages/reader.html` | **confort de lecture premium** (typo, thèmes, surlignage) + futur EPUB | 🔴 |
| Fiche œuvre | `pages/work.html` | **fiche livre unifiée** (toutes les offres : lire/acheter/emprunter/occasion) | 🔴 |
| Communautés / commentaires | `pages/communautes.html` | social, avis | 🟠 |
| Abonnements | `pages/abonnements.html` | conversion payante | 🔴 |
| Paiement | `pages/payment.html` | checkout (Fapshi + à venir international) | 🔴 |

## ✍️ Auteur
| Écran | Fichier | Rôle | Priorité |
|---|---|---|---|
| Dashboard auteur | `pages/author-dashboard.html` | **reporting niveau KDP** (ventes, pages lues, payouts) | 🔴 |
| Publication | `pages/publish.html` | **formulaire aux standards** (métadonnées, upload multi-format, aperçu) | 🔴 |
| Profil auteur (public) | `pages/author-profile.html` | vitrine auteur | 🟠 |
| Contrat auteur | `pages/contrat-auteur.html` | royalties 50/50 + option Select | 🟠 |

## 🎓 Éducation → futur « Kalamundi Campus »
| Écran | Fichier | Rôle | Priorité |
|---|---|---|---|
| Accueil éducation | `pages/education.html` | hub étudiant | 🔴 |
| Annales | `pages/annales.html` | sujets structurés (pas juste PDF) | 🔴 |
| Épreuves | `pages/epreuves.html` | banque d'épreuves | 🟠 |
| Examen simulé | `pages/examen-sim.html` | simulation chronométrée | 🟠 |
| Simulateur | `pages/simulateur.html` | (à clarifier vs examen-sim) | 🟠 |
| Répétiteur | `pages/repetiteur.html` | super-répétiteur lycée/université | 🟠 |
| École | `pages/ecole.html` | espace établissement | 🟠 |
| Institution | `pages/institution.html` | canal B2B écoles | 🟠 |
| Fax / génération doc | `pages/fax.html` | (à clarifier — `generate-fax.js`) | 🟢 |

## 🛠️ Admin / propriétaire
| Écran | Fichier | Rôle | Priorité |
|---|---|---|---|
| Admin | `pages/admin.html` | modération, gestion | 🟢 |
| Owner | `pages/owner.html` | tableau propriétaire | 🟢 |

---

## À créer (nouveaux espaces — cf. PLANIFICATION)
- **Boutique / Acheter** : store à rails, panier, checkout multi-articles.
- **Vendre / occasion** : listing vendeur (scan ISBN), profil vendeur, escrow.
- **Emprunter** : accès temporel, files d'attente.
- **Shell mobile** : barre d'onglets (Accueil · Explorer · Apprendre · Biblio · Profil).
- **Gifting diaspora** : offrir un livre/abonnement à un proche au pays.

---

## Règle transverse pour Codex
Chaque écran repris doit : (1) passer au **nouveau design-system** (tokens `base.css`, jamais de couleur hardcodée) ; (2) rester **mobile-first** et offline ; (3) garder les 3 thèmes ; (4) être noté dans `EVOLUTION_KALAMUNDI.md` une fois modernisé.
