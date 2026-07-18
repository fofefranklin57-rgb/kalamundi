/* Contrôle de l'économie (frais Fapshi + répartition) — D10/D15/D16.
   Verrouille : les frais ne sont jamais oubliés, et la somme des parts
   plus les frais égale toujours le brut (aucun franc ne se perd). */

import {
  FAPSHI_COLLECTE_PCT,
  FAPSHI_PAYOUT_PCT,
  fraisFapshiCollecte,
  repartirVenteLivre,
  repartirVenteOccasion,
  repartirVentePromo,
  apercuVendeurOccasion,
  prixPromo,
} from './lib/economie.mjs';

const erreurs = [];
const verifier = (c, m) => { if (!c) erreurs.push(m); };

/* Frais Fapshi documentés */
verifier(FAPSHI_COLLECTE_PCT === 3, `L'encaissement Fapshi est à 3 %.`);
verifier(FAPSHI_PAYOUT_PCT === 0, `Le payout Fapshi est gratuit (0 %).`);
verifier(fraisFapshiCollecte(1000) === 30, `3 % de 1000 = 30 (obtenu ${fraisFapshiCollecte(1000)}).`);

/* Vente livre 50/50 — défaut D16 : la plateforme absorbe les frais Fapshi,
   donc l'auteur touche sa part PLEINE. */
const l = repartirVenteLivre(1000);
verifier(l.frais_a_la_charge === 'plateforme', `Défaut D16 : la plateforme absorbe les frais.`);
verifier(l.frais_fapshi_xaf === 30, `Frais Fapshi sur 1000 = 30.`);
verifier(l.net_xaf === 970, `Net après Fapshi = 970.`);
verifier(l.part_auteur_xaf === 500, `L'auteur touche sa part pleine (500), la plateforme absorbe les frais.`);
verifier(l.part_plateforme_xaf === 470, `La plateforme touche 470 (500 − 30 de frais).`);
verifier(l.part_auteur_xaf + l.part_plateforme_xaf + l.frais_fapshi_xaf === l.montant_brut_xaf, `Auteur + plateforme + frais = brut (aucun franc perdu).`);

/* Politique alternative 'brut' (frais partagés) reste disponible et exacte */
const lb = repartirVenteLivre(1000, { fraisALaCharge: 'brut' });
verifier(lb.part_auteur_xaf === 485 && lb.part_plateforme_xaf === 485, `En mode 'brut', frais partagés → 485 / 485.`);
verifier(lb.part_auteur_xaf + lb.part_plateforme_xaf + lb.frais_fapshi_xaf === 1000, `En mode 'brut' aussi, la somme égale le brut.`);

/* Occasion 20 % (D15), aucun revenu auteur, payout gratuit, plateforme porte les frais */
const o = repartirVenteOccasion(2000);
verifier(o.frais_fapshi_xaf === 60, `Frais Fapshi sur 2000 = 60.`);
verifier(o.commission_xaf === 400, `Commission 20 % de 2000 = 400.`);
verifier(o.part_vendeur_xaf === 1600, `Le vendeur reçoit 1600 (prix 2000 − commission 400), payout gratuit.`);
verifier(o.part_plateforme_xaf === 340, `La plateforme garde 340 (commission 400 − frais Fapshi 60).`);
verifier(o.part_vendeur_xaf + o.part_plateforme_xaf + o.frais_fapshi_xaf === o.montant_brut_xaf, `Vendeur + plateforme + frais = brut.`);
verifier(!('part_auteur_xaf' in o), `Aucune part auteur sur l'occasion.`);

/* Aperçu vendeur : ce qu'il voit clairement en postant son annonce */
const av = apercuVendeurOccasion(2000);
verifier(av.commission_pct === 20, `L'aperçu vendeur doit annoncer 20 % de commission.`);
verifier(av.commission_kalamundi_xaf === 400, `L'aperçu doit montrer 400 de commission.`);
verifier(av.vous_recevez_xaf === 1600, `L'aperçu doit dire au vendeur qu'il reçoit 1600.`);
verifier(av.frais_paiement_pris_en_charge === true, `L'aperçu doit indiquer que Kalamundi porte les frais de paiement.`);
verifier(av.commission_kalamundi_xaf + av.vous_recevez_xaf === av.prix_vente_xaf, `Commission + part vendeur = prix affiché (aucun coût caché pour le vendeur).`);

/* Promo : remise sur le prix + part plateforme majorée possible */
verifier(prixPromo(1000, 30) === 700, `Un livre à 1000 en promo -30 % se vend 700.`);
const p = repartirVentePromo(1000, { remisePct: 30, partPlateformePct: 60 });
verifier(p.prix_vente_xaf === 700, `Le prix de vente promo doit être 700.`);
verifier(p.type === 'promo' && p.remise_pct === 30, `La répartition promo doit tracer la remise.`);
verifier(p.part_plateforme_xaf > p.part_auteur_xaf, `Avec une part plateforme majorée (60 %), la plateforme touche plus que l'auteur.`);
verifier(p.part_auteur_xaf + p.part_plateforme_xaf + p.frais_fapshi_xaf === p.prix_vente_xaf, `Sur la promo aussi, aucun franc ne se perd.`);

/* Remise promo aberrante refusée */
let leve = false;
try { prixPromo(1000, 95); } catch { leve = true; }
verifier(leve, `Une remise > 90 % doit être refusée.`);

/* Montants invalides refusés partout */
for (const f of [repartirVenteLivre, repartirVenteOccasion]) {
  for (const mauvais of [-1, 'x', NaN]) {
    let l2 = false;
    try { f(mauvais); } catch { l2 = true; }
    verifier(l2, `${f.name} doit refuser un montant invalide (${mauvais}).`);
  }
}

if (erreurs.length) {
  console.error(erreurs.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('Économie (frais Fapshi + répartition livre/occasion/promo) OK.');
