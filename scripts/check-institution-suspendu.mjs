/* Contrôle de la suspension du plan Institution (2026-07-20) :
   la vente est suspendue tant que la fonctionnalité équipe/tableau de bord
   n'est pas construite (cf. ERROR_LOG.md). Trois points de blocage requis :
   la page, le client, et le serveur (le vrai verrou — un appel direct à
   l'API ne doit pas pouvoir encaisser cet abonnement). */

import { readFileSync } from 'node:fs';

const abonnements = readFileSync('pages/abonnements.html', 'utf8');
const payment = readFileSync('assets/js/payment.js', 'utf8');
const fapshiPay = readFileSync('functions/api/fapshi-pay.js', 'utf8');

const erreurs = [];
const verifier = (c, m) => { if (!c) erreurs.push(m); };

/* 1. Page abonnements : pas de lien d'achat actif vers institution */
verifier(!abonnements.includes('plan=institution&montant=10000'), `abonnements.html ne doit plus lier vers le paiement institution.`);
verifier(abonnements.includes('Bientôt disponible'), `La carte Institution doit annoncer « Bientôt disponible ».`);
verifier(abonnements.includes('institutions@kalamundi.com'), `La carte doit rediriger vers le contact institutions existant.`);

/* 2. Client payment.js : plan retiré + message explicite si atteint quand même */
verifier(!/institution:\s*\{[^}]*10000/.test(payment), `payment.js ne doit plus déclarer le plan institution dans PLANS.`);
verifier(payment.includes("PARAMS.plan === 'institution'"), `payment.js doit détecter explicitement une tentative d'accès au plan institution.`);
verifier(/n'est pas encore en vente/.test(payment), `Un message clair doit expliquer la suspension, pas une erreur générique.`);

/* 3. Serveur fapshi-pay.js : le vrai verrou (défense en profondeur) */
verifier(fapshiPay.includes("plan === 'abonnement_institution'"), `fapshi-pay.js doit rejeter côté serveur le type réel envoyé par le paiement (abonnement_institution).`);
verifier(/status:\s*403/.test(fapshiPay.match(/plan === 'abonnement_institution'[\s\S]{0,200}/)?.[0] || ''), `Le rejet serveur doit renvoyer un statut d'erreur explicite (403).`);

if (erreurs.length) {
  console.error(erreurs.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('Plan Institution suspendu sur les 3 fronts (page, client, serveur) — OK.');
