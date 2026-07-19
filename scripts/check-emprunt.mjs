/* Contrôle du prêt numérique / emprunt (P4 #15) :
   invariants de la migration V014 (fonds maison, séquestre d'accès temporel,
   file d'attente) + présence des méthodes client attendues. */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const erreurs = [];
const verifier = (c, m) => { if (!c) erreurs.push(m); };

const sqlPath = path.join(root, 'migrations/V014__pret_numerique.sql');
if (!fs.existsSync(sqlPath)) {
  erreurs.push(`La migration V014__pret_numerique.sql doit exister.`);
} else {
  const sql = fs.readFileSync(sqlPath, 'utf8');

  verifier(/CREATE TABLE IF NOT EXISTS emprunts/i.test(sql), `V014 doit créer emprunts.`);
  verifier(/CREATE TABLE IF NOT EXISTS emprunts_file_attente/i.test(sql), `V014 doit créer emprunts_file_attente.`);
  verifier(/ADD COLUMN IF NOT EXISTS expire_le/i.test(sql), `acces_premium doit gagner expire_le (accès temporel).`);
  verifier(/ADD COLUMN IF NOT EXISTS emprunt_id/i.test(sql), `acces_premium doit gagner emprunt_id (traçabilité du prêt).`);

  verifier(/ENABLE ROW LEVEL SECURITY/i.test(sql), `Le RLS doit être activé.`);
  verifier(!/FOR INSERT WITH CHECK/i.test(sql) && !/FOR UPDATE USING/i.test(sql),
    `Aucune écriture directe client sur emprunts/file d'attente : tout passe par les RPC.`);

  for (const rpc of ['emprunter_livre', 'rendre_livre', 'rejoindre_file_attente', 'quitter_file_attente', 'expirer_emprunts', 'promouvoir_file_attente']) {
    verifier(new RegExp(`CREATE OR REPLACE FUNCTION ${rpc}`, 'i').test(sql), `V014 doit exposer la fonction ${rpc}.`);
  }
  verifier((sql.match(/SECURITY DEFINER/gi) || []).length >= 6, `Les 6 fonctions doivent être SECURITY DEFINER.`);

  for (const rpc of ['emprunter_livre', 'rendre_livre', 'rejoindre_file_attente', 'quitter_file_attente']) {
    verifier(new RegExp(`GRANT EXECUTE ON FUNCTION ${rpc}[^;]*TO authenticated`, 'i').test(sql),
      `${rpc} doit être réservée aux utilisateurs authentifiés.`);
  }
  verifier(/GRANT EXECUTE ON FUNCTION expirer_emprunts\(\) TO anon, authenticated/i.test(sql),
    `expirer_emprunts doit être appelable par le cron (clé anon, pas d'action utilisateur).`);

  // Invariants métier
  verifier(/type <> 'pret_numerique'/i.test(sql), `emprunter_livre doit refuser les offres qui ne sont pas des prêts.`);
  verifier(/Vous avez déjà accès à ce livre/i.test(sql), `On ne prête pas un livre déjà accessible (achat ou prêt en cours).`);
  verifier(/'file_attente' USING ERRCODE/i.test(sql), `Le fonds complet doit signaler la file d'attente au client.`);
  verifier(/idx_emprunts_actif_unique/i.test(sql), `Un seul emprunt actif par (offre, emprunteur).`);
  verifier(/DELETE FROM acces_premium WHERE emprunt_id/i.test(sql),
    `Le retour/l'expiration d'un prêt doit retirer l'accès (sans toucher aux achats).`);
  verifier(/PERFORM promouvoir_file_attente/i.test(sql),
    `Rendre ou expirer un prêt doit tenter de servir le suivant de la file.`);
  verifier(/COALESCE\(v_offre\.duree_acces_jours, 14\)/.test(sql), `Durée de prêt par défaut = 14 jours si non précisée.`);
}

const apiPath = path.join(root, 'assets/js/api.js');
if (!fs.existsSync(apiPath)) {
  erreurs.push(`assets/js/api.js introuvable.`);
} else {
  const api = fs.readFileSync(apiPath, 'utf8');
  for (const methode of ['emprunterLivre', 'rendreLivre', 'rejoindreFileAttente', 'quitterFileAttente', 'getStatutEmpruntOffre', 'getMesEmprunts']) {
    verifier(api.includes(`async ${methode}(`), `api.js doit exposer ${methode}().`);
  }
  verifier(/data\.expire_le && new Date\(data\.expire_le\) <= new Date\(\)/.test(api),
    `verifierAccesPremium doit révoquer l'accès une fois expire_le dépassé (prêt échu).`);
}

const cronPath = path.join(root, 'kalamundi-cron/index.js');
if (!fs.existsSync(cronPath)) {
  erreurs.push(`kalamundi-cron/index.js introuvable.`);
} else {
  const cron = fs.readFileSync(cronPath, 'utf8');
  verifier(/expirer_emprunts/i.test(cron), `Le cron horaire doit appeler expirer_emprunts.`);
}

if (erreurs.length) {
  console.error(erreurs.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('Emprunt / prêt numérique (V014 + fonds maison + file d\'attente) OK.');
