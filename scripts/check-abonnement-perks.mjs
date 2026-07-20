/* Contrôle des avantages d'abonnement réellement honorés (pas juste vendus),
   SANS spolier les auteurs (cf. ERROR_LOG 2026-07-20, deux entrées) :
   - suppression de pub pour Reader+/Auteur Pro : honorée
   - accès premium via abonnement : restreint aux œuvres explicitement en
     « Kalamundi Select » (opt-in auteur, ADAPTATION_STANDARDS_KDP.md §5.3) —
     un abonné ne doit PAS pouvoir lire gratuitement une œuvre non-Select,
     tant que le fonds mensuel qui rémunère l'auteur (§5.2) n'existe pas. */

import { readFileSync } from 'node:fs';

const api = readFileSync('assets/js/api.js', 'utf8');
const appJs = readFileSync('assets/js/app.js', 'utf8');
const abonnements = readFileSync('pages/abonnements.html', 'utf8');

const erreurs = [];
const verifier = (c, m) => { if (!c) erreurs.push(m); };

/* verifierAccesPremium : l'abonnement seul ne doit JAMAIS suffire. */
verifier(api.includes('aAbonnementActif'), `api.js doit exposer aAbonnementActif().`);
verifier(api.includes('oeuvreEstEnAbonnement'), `api.js doit exposer oeuvreEstEnAbonnement() (opt-in Select).`);
verifier(
  !/return this\.aAbonnementActif\(userId, \['reader_plus', 'auteur_pro'\]\);\s*\n\s*\},/.test(api),
  `RÉGRESSION DANGEREUSE : verifierAccesPremium ne doit plus retourner l'abonnement seul sans vérifier le Select (spolie les auteurs non-exclusifs).`
);
verifier(
  /const abonne = await this\.aAbonnementActif\(userId, \['reader_plus', 'auteur_pro'\]\);\s*\n\s*if \(!abonne\) return false;\s*\n\s*return this\.oeuvreEstEnAbonnement\(oeuvreId\);/.test(api),
  `verifierAccesPremium doit exiger l'abonnement actif ET l'opt-in Select de l'œuvre, dans cet ordre.`
);

/* oeuvreEstEnAbonnement : passe par livres → livre_offres (type lecture_abonnement, active). */
verifier(/\.from\('livres'\)[\s\S]{0,80}\.eq\('oeuvre_id', oeuvreId\)/.test(api), `oeuvreEstEnAbonnement doit résoudre la fiche livre depuis l'oeuvre.`);
verifier(/\.from\('livre_offres'\)[\s\S]{0,120}type', 'lecture_abonnement'/.test(api), `oeuvreEstEnAbonnement doit chercher une offre de type lecture_abonnement.`);
verifier(/type', 'lecture_abonnement'\)\s*\n\s*\.eq\('statut', 'active'\)/.test(api), `L'offre Select doit être active pour compter.`);
verifier(/if \(!livre\) return false;/.test(api), `Sans fiche livre, aucun accès abonnement possible (pas de faux positif).`);

/* Le gating pub reste inchangé : couper la pub ne prive personne de revenu. */
verifier(!appJs.includes("user_metadata?.plan === 'premium'"), `app.js ne doit plus vérifier l'ancien champ user_metadata.plan (jamais écrit par le paiement).`);
verifier(appJs.includes('api.aAbonnementActif(session.user.id'), `app.js doit couper la pub via aAbonnementActif.`);
verifier(/aAbonnementActif\(session\.user\.id, \['reader_plus', 'auteur_pro'\]\)/.test(appJs), `Le gating pub doit couvrir Reader+ ET Auteur Pro.`);

for (const plan of ['reader_plus', 'auteur_pro']) {
  verifier(api.includes(`'${plan}'`) || appJs.includes(`'${plan}'`), `Le plan « ${plan} » doit être référencé (doit matcher functions/api/fapshi-webhook.js).`);
}

verifier(abonnements.includes('Accès illimité aux œuvres premium'), `La page abonnements annonce toujours l'accès illimité — vrai seulement pour les œuvres Select tant que le fonds n'existe pas (nuance à traiter côté copie, pas ici).`);

if (erreurs.length) {
  console.error(erreurs.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('Avantages abonnement honorés SANS spolier les auteurs (Select requis) — OK.');
