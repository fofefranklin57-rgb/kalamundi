/* Contrôle des avantages d'abonnement réellement honorés (pas juste vendus) :
   - accès illimité aux œuvres premium pour Reader+/Auteur Pro
   - suppression de pub pour les mêmes abonnés
   Bugs corrigés (cf. ERROR_LOG) : verifierAccesPremium ignorait l'abonnement,
   et le gating pub vérifiait un champ (user_metadata.plan) jamais écrit par
   le paiement (qui écrit profiles.abonnement). */

import { readFileSync } from 'node:fs';

const api = readFileSync('assets/js/api.js', 'utf8');
const appJs = readFileSync('assets/js/app.js', 'utf8');
const abonnements = readFileSync('pages/abonnements.html', 'utf8');

const erreurs = [];
const verifier = (c, m) => { if (!c) erreurs.push(m); };

/* verifierAccesPremium doit retomber sur l'abonnement quand aucun achat/prêt
   individuel n'existe, pas seulement sur acces_premium. */
verifier(api.includes('aAbonnementActif'), `api.js doit exposer aAbonnementActif().`);
verifier(
  /return this\.aAbonnementActif\(userId, \['reader_plus', 'auteur_pro'\]\)/.test(api),
  `verifierAccesPremium doit retomber sur un abonnement Reader+/Auteur Pro actif quand il n'y a pas d'accès individuel.`
);
verifier(
  api.includes(`.select('abonnement, abonnement_expire_at')`),
  `aAbonnementActif doit lire profiles.abonnement et son expiration.`
);
verifier(
  /abonnement_expire_at && new Date\(data\.abonnement_expire_at\) <= new Date\(\)/.test(api),
  `Un abonnement expiré ne doit plus donner accès.`
);

/* Le gating pub doit utiliser le même mécanisme, pas l'ancien champ jamais écrit. */
verifier(!appJs.includes("user_metadata?.plan === 'premium'"), `app.js ne doit plus vérifier l'ancien champ user_metadata.plan (jamais écrit par le paiement).`);
verifier(appJs.includes('api.aAbonnementActif(session.user.id'), `app.js doit couper la pub via aAbonnementActif, la même source de vérité que l'accès premium.`);
verifier(/aAbonnementActif\(session\.user\.id, \['reader_plus', 'auteur_pro'\]\)/.test(appJs), `Le gating pub doit couvrir Reader+ ET Auteur Pro (qui inclut Reader+).`);

/* Les valeurs d'abonnement utilisées côté code doivent correspondre à ce que
   le webhook écrit réellement (functions/api/fapshi-webhook.js: reader_plus,
   auteur_pro, institution, etudiant) — pas une valeur inventée. */
for (const plan of ['reader_plus', 'auteur_pro']) {
  verifier(api.includes(`'${plan}'`) || appJs.includes(`'${plan}'`), `Le plan « ${plan} » doit être référencé (doit matcher functions/api/fapshi-webhook.js).`);
}

/* La promesse marketing doit rester cohérente avec ce qui est maintenant livré. */
verifier(abonnements.includes('Accès illimité aux œuvres premium'), `La page abonnements doit toujours annoncer l'accès illimité — désormais honoré.`);

if (erreurs.length) {
  console.error(erreurs.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('Avantages abonnement (accès premium + suppression pub) réellement honorés — OK.');
