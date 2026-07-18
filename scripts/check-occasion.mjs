/* Contrôle de l'occasion / séquestre (P4 #14) :
   machine à états (transitions + acteurs) + répartition + invariants V012.
   Messages en backticks : ils tolèrent les apostrophes françaises. */

import fs from 'node:fs';
import path from 'node:path';
import {
  ETATS,
  estEtatValide,
  estTerminal,
  transitionAutorisee,
  transitionsPossibles,
  vendeurPaye,
  acheteurRembourse,
  repartirOccasion,
  COMMISSION_OCCASION_PCT,
  AUTO_LIBERATION_JOURS,
} from './lib/occasion-etats.mjs';

const root = process.cwd();
const erreurs = [];
const verifier = (c, m) => { if (!c) erreurs.push(m); };

/* Chemin nominal : de la commande au versement */
verifier(transitionAutorisee(ETATS.EN_ATTENTE_PAIEMENT, ETATS.PAYE_SEQUESTRE, 'systeme'), `Le paiement (systeme) doit passer en séquestre.`);
verifier(transitionAutorisee(ETATS.PAYE_SEQUESTRE, ETATS.REMIS, 'vendeur'), `Le vendeur doit pouvoir confirmer la remise.`);
verifier(transitionAutorisee(ETATS.REMIS, ETATS.RECEPTIONNE, 'acheteur'), `L'acheteur doit pouvoir confirmer la réception.`);
verifier(transitionAutorisee(ETATS.REMIS, ETATS.RECEPTIONNE, 'systeme'), `L'auto-libération (systeme) doit être permise.`);
verifier(transitionAutorisee(ETATS.RECEPTIONNE, ETATS.CLOS, 'systeme'), `La réception doit mener à la clôture.`);

/* Garde par acteur */
verifier(!transitionAutorisee(ETATS.PAYE_SEQUESTRE, ETATS.REMIS, 'acheteur'), `L'acheteur ne déclare pas la remise à la place du vendeur.`);
verifier(!transitionAutorisee(ETATS.REMIS, ETATS.RECEPTIONNE, 'vendeur'), `Le vendeur ne confirme pas la réception à la place de l'acheteur.`);
verifier(!transitionAutorisee(ETATS.RECEPTIONNE, ETATS.CLOS, 'vendeur'), `Le vendeur ne libère pas lui-même les fonds.`);

/* Séquestre : le vendeur n'est payé QU'à la clôture */
verifier(!vendeurPaye(ETATS.PAYE_SEQUESTRE), `Fonds non versés tant que l'acheteur n'a pas reçu.`);
verifier(!vendeurPaye(ETATS.REMIS), `La seule remise ne libère pas les fonds.`);
verifier(vendeurPaye(ETATS.CLOS), `Le vendeur est payé à la clôture.`);
verifier(!vendeurPaye(ETATS.REMBOURSE), `Un remboursement ne paie pas le vendeur.`);

/* Litige : gèle, arbitrage admin uniquement */
verifier(transitionAutorisee(ETATS.PAYE_SEQUESTRE, ETATS.LITIGE, 'acheteur'), `L'acheteur peut ouvrir un litige avant remise.`);
verifier(transitionAutorisee(ETATS.REMIS, ETATS.LITIGE, 'acheteur'), `L'acheteur peut contester après remise.`);
verifier(transitionAutorisee(ETATS.LITIGE, ETATS.REMBOURSE, 'admin'), `L'admin peut rembourser sur litige.`);
verifier(transitionAutorisee(ETATS.LITIGE, ETATS.CLOS, 'admin'), `L'admin peut trancher en faveur du vendeur.`);
verifier(!transitionAutorisee(ETATS.LITIGE, ETATS.CLOS, 'vendeur'), `Le vendeur ne résout pas son propre litige.`);
verifier(acheteurRembourse(ETATS.REMBOURSE) && acheteurRembourse(ETATS.ANNULE), `Remboursé/annulé créditent l'acheteur.`);

/* États terminaux */
for (const t of [ETATS.CLOS, ETATS.ANNULE, ETATS.REMBOURSE]) {
  verifier(estTerminal(t), `${t} doit être terminal.`);
  verifier(transitionsPossibles(t).length === 0, `${t} ne doit avoir aucune transition sortante.`);
}
verifier(!estTerminal(ETATS.PAYE_SEQUESTRE), `paye_sequestre n'est pas terminal.`);
verifier(!estEtatValide('nawak'), `Un état inconnu doit être invalide.`);

/* Sauts d'étape interdits */
verifier(!transitionAutorisee(ETATS.PAYE_SEQUESTRE, ETATS.CLOS, 'systeme'), `On ne clôt pas sans passer par la réception.`);
verifier(!transitionAutorisee(ETATS.EN_ATTENTE_PAIEMENT, ETATS.REMIS, 'vendeur'), `On ne remet pas un article non payé.`);

/* Répartition : commission + AUCUN revenu auteur */
const r = repartirOccasion(2000);
verifier(r.commission_xaf === 400, `Commission 20% de 2000 = 400 (obtenu ${r.commission_xaf}).`);
verifier(r.montant_vendeur_xaf === 1600, `Le vendeur touche 1600 (obtenu ${r.montant_vendeur_xaf}).`);
verifier(r.commission_xaf + r.montant_vendeur_xaf === r.montant_xaf, `Commission + part vendeur = montant.`);
verifier(!('montant_auteur_xaf' in r), `Aucune part auteur sur l'occasion.`);
verifier(COMMISSION_OCCASION_PCT === 20, `Commission occasion = 20 % (D15).`);
verifier(AUTO_LIBERATION_JOURS >= 1, `Un délai d'auto-libération doit être défini.`);

for (const mauvais of [-1, 'x', NaN, Infinity]) {
  let leve = false;
  try { repartirOccasion(mauvais); } catch { leve = true; }
  verifier(leve, `Un montant invalide (${mauvais}) doit être refusé.`);
}
let leveCom = false;
try { repartirOccasion(1000, 150); } catch { leveCom = true; }
verifier(leveCom, `Une commission hors 0-100 doit être refusée.`);

/* Invariants de la migration V012 */
const sqlPath = path.join(root, 'migrations/V012__occasion_sequestre.sql');
if (!fs.existsSync(sqlPath)) {
  erreurs.push(`La migration V012__occasion_sequestre.sql doit exister.`);
} else {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  verifier(/CREATE TABLE IF NOT EXISTS commandes_occasion/i.test(sql), `V012 doit créer commandes_occasion.`);
  verifier(/CREATE TABLE IF NOT EXISTS vendeur_evaluations/i.test(sql), `V012 doit créer vendeur_evaluations.`);
  verifier(/fonds_liberes BOOLEAN NOT NULL DEFAULT false/i.test(sql), `Les fonds doivent être gelés par défaut (séquestre).`);
  verifier(/acheteur_id <> vendeur_id/i.test(sql), `On ne doit pas pouvoir acheter son propre article.`);
  verifier(/ENABLE ROW LEVEL SECURITY/i.test(sql), `Le RLS doit être activé.`);
  verifier(!/FOR INSERT WITH CHECK/i.test(sql) && !/FOR UPDATE USING/i.test(sql), `Aucune écriture directe client : tout passe par les RPC.`);

  for (const rpc of ['creer_commande_occasion', 'confirmer_remise', 'confirmer_reception', 'ouvrir_litige', 'evaluer_vendeur']) {
    verifier(new RegExp(`CREATE OR REPLACE FUNCTION ${rpc}`, 'i').test(sql), `V012 doit exposer la RPC ${rpc}.`);
    verifier(new RegExp(`GRANT EXECUTE ON FUNCTION ${rpc}[^;]*TO authenticated`, 'i').test(sql), `${rpc} doit être réservée aux authentifiés.`);
  }
  verifier((sql.match(/SECURITY DEFINER/gi) || []).length >= 5, `Les 5 RPC de transition doivent être SECURITY DEFINER.`);

  verifier(/type <> 'occasion'/i.test(sql), `creer_commande doit refuser les offres non-occasion.`);
  verifier(/propre annonce/i.test(sql), `On ne doit pas acheter sa propre annonce.`);
  verifier(/Seul le vendeur peut confirmer la remise/i.test(sql), `Seul le vendeur confirme la remise.`);
  verifier(/payout_statut = 'a_verser'/i.test(sql), `La clôture doit marquer le versement vendeur à effectuer.`);
  verifier(/\* 20 \/ 100/i.test(sql), `La commission SQL doit être 20 %.`);
}

if (erreurs.length) {
  console.error(erreurs.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('Occasion / séquestre (états + répartition + V012) OK.');
