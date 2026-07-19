/* Contrôle du parcours commande d'occasion (P4 #14) :
   page commande (timeline + actions par rôle + RPC), branchement paiement,
   découverte/réservation depuis la fiche œuvre. */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const erreurs = [];
const verifier = (c, m) => { if (!c) erreurs.push(m); };

/* --- Page commande --- */
const htmlPath = path.join(root, 'pages/commande.html');
verifier(fs.existsSync(htmlPath), `pages/commande.html doit exister.`);

const jsPath = path.join(root, 'assets/js/commande.js');
verifier(fs.existsSync(jsPath), `assets/js/commande.js doit exister.`);
if (fs.existsSync(jsPath)) {
  const js = fs.readFileSync(jsPath, 'utf8');

  /* Les 5 RPC de V012 doivent toutes être appelables depuis l'UI */
  for (const rpc of ['confirmer_remise', 'confirmer_reception', 'ouvrir_litige', 'evaluer_vendeur']) {
    verifier(js.includes(`'${rpc}'`), `commande.js doit pouvoir appeler la RPC ${rpc}.`);
  }

  /* Sécurité : le rôle vient de l'appartenance réelle, pas d'un paramètre d'URL */
  verifier(/ROLE\s*=\s*data\.acheteur_id === SESSION\.user\.id/.test(js), `Le rôle doit être déduit de la commande réelle (acheteur_id), pas d'un flag manipulable.`);
  verifier(/data\.vendeur_id === SESSION\.user\.id/.test(js), `Le rôle vendeur doit aussi être vérifié contre la commande.`);
  verifier(/if \(!ROLE\) return afficherErreur/.test(js), `Un utilisateur qui n'est ni acheteur ni vendeur ne doit voir aucune action.`);

  /* Actions bloquées au bon acteur et au bon état (reflète les gardes SQL de V012) */
  verifier(/s === 'paye_sequestre' && ROLE === 'vendeur'/.test(js), `Seul le vendeur peut confirmer la remise, et seulement après paiement.`);
  verifier(/s === 'remis' && ROLE === 'acheteur'/.test(js), `Seul l'acheteur peut confirmer la réception, et seulement après remise.`);
  verifier(/libère le paiement au vendeur/.test(js), `L'acheteur doit être informé que confirmer la réception libère les fonds.`);
  verifier(/s === 'en_attente_paiement' && ROLE === 'acheteur'/.test(js), `Seul l'acheteur voit le bouton payer.`);

  /* Timeline reflète les 5 états nominaux de V012 */
  for (const etat of ['en_attente_paiement', 'paye_sequestre', 'remis', 'receptionne', 'clos']) {
    verifier(js.includes(`'${etat}'`), `La timeline doit connaître l'état ${etat}.`);
  }
  verifier(/CMD\.statut === 'litige'/.test(js), `Le litige doit être signalé distinctement.`);
}

/* --- Branchement paiement (payment.js / payment.html) --- */
const payJs = fs.readFileSync(path.join(root, 'assets/js/payment.js'), 'utf8');
verifier(/PARAMS\.occasion/.test(payJs), `payment.js doit reconnaître le mode occasion.`);
verifier(/commandeOccasionId:\s*estOccasion \? PARAMS\.commandeOccasionId/.test(payJs), `payment.js doit transmettre commandeOccasionId à fapshi-pay.`);
verifier(/window\.location\.href = `\/pages\/commande\.html\?id=/.test(payJs), `Après paiement occasion, l'utilisateur doit être renvoyé vers le suivi de sa commande.`);

/* --- Découverte + réservation depuis la fiche œuvre --- */
const workJs = fs.readFileSync(path.join(root, 'assets/js/work.js'), 'utf8');
verifier(/chargerOffresOccasion/.test(workJs), `work.js doit charger les annonces d'occasion du livre.`);
verifier(/api\.getOffresOccasion/.test(workJs), `work.js doit appeler api.getOffresOccasion.`);
verifier(/api\.reserverOccasion/.test(workJs), `work.js doit pouvoir réserver une annonce (crée la commande).`);
verifier(!/offer-card--future["'][^>]*>\s*<div class="offer-card__kicker">Occasion/.test(workJs), `La carte Occasion ne doit plus être un simple "Bientôt" désactivé.`);

/* --- API --- */
const apiJs = fs.readFileSync(path.join(root, 'assets/js/api.js'), 'utf8');
verifier(/async getOffresOccasion\(oeuvreId\)/.test(apiJs), `api.js doit exposer getOffresOccasion.`);
verifier(/async reserverOccasion\(offreId/.test(apiJs), `api.js doit exposer reserverOccasion.`);
verifier(/creer_commande_occasion/.test(apiJs), `reserverOccasion doit appeler la RPC creer_commande_occasion.`);
verifier(/type', 'occasion'\)/.test(apiJs) || /eq\('type', 'occasion'\)/.test(apiJs), `getOffresOccasion doit filtrer sur le type occasion.`);

if (erreurs.length) {
  console.error(erreurs.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('Parcours commande occasion (page + paiement + découverte) OK.');
