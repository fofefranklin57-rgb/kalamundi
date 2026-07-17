/* Contrôle des cadeaux diaspora (D11 / P3 #13) :
   codes non devinables et dictables + invariants de la migration V011. */

import fs from 'node:fs';
import path from 'node:path';
import {
  genererCodeCadeau,
  normaliserCodeCadeau,
  estCodeCadeauValide,
  formaterCodeCadeau,
  ALPHABET_CADEAU,
  LONGUEUR_CADEAU,
  LONGUEUR_MIN,
  LONGUEUR_MAX,
} from './lib/cadeaux.mjs';

const root = process.cwd();
const erreurs = [];
const verifier = (condition, message) => { if (!condition) erreurs.push(message); };

/* --- L'alphabet ne doit contenir aucun caractère confondable --- */
for (const ambigu of ['0', 'O', '1', 'I', 'L', 'U']) {
  verifier(!ALPHABET_CADEAU.includes(ambigu), `L’alphabet ne doit pas contenir « ${ambigu} » (confondable à l’oral ou à l’écrit).`);
}
verifier(new Set(ALPHABET_CADEAU).size === ALPHABET_CADEAU.length, 'L’alphabet ne doit pas contenir de doublon.');

/* --- Format des codes générés --- */
const codes = Array.from({ length: 3000 }, () => genererCodeCadeau());
verifier(codes.every(c => c.length === LONGUEUR_CADEAU), 'Tous les codes doivent avoir la longueur attendue.');
verifier(codes.every(c => [...c].every(l => ALPHABET_CADEAU.includes(l))), 'Un code ne doit utiliser que l’alphabet autorisé.');
verifier(codes.every(estCodeCadeauValide), 'Un code généré doit être valide.');

/* --- Non devinable : aucune collision, et toutes les lettres sont tirées --- */
verifier(new Set(codes).size === codes.length, 'Deux codes générés ne doivent jamais entrer en collision.');
const lettresVues = new Set(codes.join(''));
verifier(lettresVues.size === ALPHABET_CADEAU.length, 'Le tirage doit pouvoir produire toutes les lettres de l’alphabet (pas de biais).');

/* --- Longueurs hors bornes refusées --- */
for (const longueur of [0, 4, LONGUEUR_MIN - 1, LONGUEUR_MAX + 1, 2.5, 'x', NaN]) {
  let leve = false;
  try { genererCodeCadeau(longueur); } catch { leve = true; }
  verifier(leve, `Une longueur invalide (${longueur}) doit être refusée.`);
}
verifier(genererCodeCadeau(LONGUEUR_MIN).length === LONGUEUR_MIN, 'La longueur minimale doit rester acceptée.');
verifier(genererCodeCadeau(LONGUEUR_MAX).length === LONGUEUR_MAX, 'La longueur maximale doit rester acceptée.');

/* --- Tolérance à la saisie humaine (WhatsApp, dictée au téléphone) --- */
verifier(normaliserCodeCadeau('abcd-efgh-ijkl') === 'ABCDEFGHJK', 'La normalisation doit retirer tirets et lettres hors alphabet, et passer en majuscules.');
verifier(normaliserCodeCadeau('  A B C D  ') === 'ABCD', 'Les espaces doivent être retirés.');
verifier(normaliserCodeCadeau(null) === '' && normaliserCodeCadeau(undefined) === '', 'Une saisie vide doit donner une chaîne vide.');

const code = genererCodeCadeau();
verifier(normaliserCodeCadeau(formaterCodeCadeau(code)) === code, 'Formater puis normaliser doit redonner le code exact.');
verifier(normaliserCodeCadeau(code.toLowerCase()) === code, 'La saisie en minuscules doit être acceptée.');
verifier(formaterCodeCadeau(code).includes('-'), 'L’affichage doit être groupé par tirets pour la lisibilité.');

/* --- Validité --- */
verifier(!estCodeCadeauValide(''), 'Un code vide est invalide.');
verifier(!estCodeCadeauValide('ABC'), 'Un code trop court est invalide.');
verifier(!estCodeCadeauValide('0O1IL'), 'Un code fait de caractères ambigus est invalide.');

/* --- Invariants de la migration V011 --- */
const sqlPath = path.join(root, 'migrations/V011__cadeaux_diaspora.sql');
if (!fs.existsSync(sqlPath)) {
  erreurs.push('La migration V011__cadeaux_diaspora.sql doit exister.');
} else {
  const sql = fs.readFileSync(sqlPath, 'utf8');

  verifier(/CREATE TABLE IF NOT EXISTS cadeaux/i.test(sql), 'V011 doit créer la table cadeaux.');
  verifier(/code TEXT NOT NULL UNIQUE/i.test(sql), 'Le code cadeau doit être unique.');
  verifier(/ENABLE ROW LEVEL SECURITY/i.test(sql), 'La table cadeaux doit activer le RLS.');
  verifier(/devise IN \('XAF', 'EUR', 'USD'\)/i.test(sql), 'La devise doit être contrainte aux devises supportées.');
  verifier(/montant_xaf/i.test(sql), 'Le montant réellement encaissé en XAF doit être tracé.');

  /* La réclamation doit être server-side (leçon ERROR_LOG 2026-06-23) */
  verifier(/CREATE OR REPLACE FUNCTION reclamer_cadeau/i.test(sql), 'V011 doit exposer la RPC reclamer_cadeau.');
  verifier(/SECURITY DEFINER/i.test(sql), 'reclamer_cadeau doit être SECURITY DEFINER.');
  verifier(/FOR UPDATE/i.test(sql), 'La réclamation doit verrouiller la ligne (deux personnes ne peuvent pas réclamer le même code).');
  verifier(/REVOKE ALL ON FUNCTION reclamer_cadeau/i.test(sql), 'reclamer_cadeau ne doit pas être exécutable par PUBLIC.');
  verifier(/GRANT EXECUTE ON FUNCTION reclamer_cadeau\(TEXT\) TO authenticated/i.test(sql), 'reclamer_cadeau doit être réservée aux utilisateurs authentifiés.');

  /* Règles métier du cadeau */
  verifier(/deja ete reclame/i.test(sql), 'Un cadeau déjà réclamé doit être refusé.');
  verifier(/n''est pas encore paye/i.test(sql), 'Un cadeau non payé ne doit donner aucun accès.');
  verifier(/propre cadeau/i.test(sql), 'On ne doit pas pouvoir réclamer son propre cadeau.');
  verifier(/INSERT INTO acces_premium[\s\S]{0,120}v_user_id/i.test(sql), 'L’accès doit être accordé à celui qui réclame, pas à l’acheteur.');

  /* Aucune policy d'écriture directe depuis le client */
  verifier(!/FOR INSERT WITH CHECK/i.test(sql), 'Aucune écriture directe client sur cadeaux : tout passe par le serveur / la RPC.');
}

if (erreurs.length) {
  console.error(erreurs.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}

console.log('Cadeaux diaspora (codes + V011) OK.');
