/* Contrôle du formulaire de mise en vente d'occasion (P4 #14) :
   RPC V013 + page vendeur avec répartition en direct. */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const erreurs = [];
const verifier = (c, m) => { if (!c) erreurs.push(m); };

/* --- Migration V013 : creer_annonce_occasion --- */
const sqlPath = path.join(root, 'migrations/V013__annonce_occasion.sql');
if (!fs.existsSync(sqlPath)) {
  erreurs.push(`La migration V013__annonce_occasion.sql doit exister.`);
} else {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  verifier(/CREATE OR REPLACE FUNCTION creer_annonce_occasion/i.test(sql), `V013 doit exposer creer_annonce_occasion.`);
  verifier(/SECURITY DEFINER/i.test(sql), `creer_annonce_occasion doit être SECURITY DEFINER (le vendeur n'est pas l'auteur du livre).`);
  verifier(/GRANT EXECUTE ON FUNCTION creer_annonce_occasion[^;]*TO authenticated/i.test(sql), `La RPC doit être réservée aux authentifiés.`);
  verifier(/REVOKE ALL ON FUNCTION creer_annonce_occasion/i.test(sql), `La RPC ne doit pas être exécutable par PUBLIC.`);

  /* Résolution/création de la fiche livre puis création de l'offre occasion */
  verifier(/isbn13 = v_isbn OR isbn10 = v_isbn/i.test(sql), `La RPC doit retrouver la fiche livre par ISBN.`);
  verifier(/INSERT INTO livres/i.test(sql), `La RPC doit créer une fiche livre si l'ISBN est inconnu.`);
  verifier(/'import'/i.test(sql), `Le livre d'occasion créé doit être de type catalogue 'import'.`);
  verifier(/INSERT INTO livre_offres[\s\S]*'occasion'/i.test(sql), `La RPC doit créer une offre de type occasion.`);
  verifier(/v_livre_id, v_user, 'occasion'/i.test(sql), `L'offre doit être rattachée au vendeur connecté (v_user).`);

  /* Validations métier */
  verifier(/prix doit être d''au moins 100/i.test(sql), `Le prix minimum (100 FCFA) doit être vérifié.`);
  verifier(/titre du livre est requis/i.test(sql), `Le titre doit être requis.`);
  verifier(/'neuf','comme_neuf','bon','correct','use'/i.test(sql), `L'état du livre doit être contraint.`);
}

/* --- Page vendeur --- */
const htmlPath = path.join(root, 'pages/vendre.html');
verifier(fs.existsSync(htmlPath), `La page pages/vendre.html doit exister.`);
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  for (const id of ['titre', 'prix', 'etat', 'r-commission', 'r-vendeur']) {
    verifier(new RegExp(`id="${id}"`).test(html), `La page doit contenir l'élément #${id}.`);
  }
  verifier(/Pris en charge par Kalamundi/i.test(html), `La page doit indiquer que Kalamundi porte les frais de paiement.`);
}

/* --- Logique vendeur --- */
const jsPath = path.join(root, 'assets/js/vendre.js');
verifier(fs.existsSync(jsPath), `Le module assets/js/vendre.js doit exister.`);
if (fs.existsSync(jsPath)) {
  const js = fs.readFileSync(jsPath, 'utf8');
  verifier(/COMMISSION_OCCASION_PCT\s*=\s*20/.test(js), `L'aperçu vendeur doit utiliser 20 % (D15).`);
  verifier(/creer_annonce_occasion/.test(js), `Le module doit appeler la RPC creer_annonce_occasion.`);
  verifier(/addEventListener\('input'/.test(js), `La répartition doit se mettre à jour en direct à la saisie du prix.`);
  verifier(/vendeur:\s*p\s*-\s*commission/.test(js), `Le vendeur doit voir prix − commission (frais portés par la plateforme).`);
}

if (erreurs.length) {
  console.error(erreurs.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('Mise en vente occasion (V013 + page vendeur) OK.');
