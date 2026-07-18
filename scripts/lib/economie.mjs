/* ============================================================
   economie.mjs — Frais Fapshi & répartition de la recette
   Kalamundi — La Plume du Monde  (D10, D15, D16)

   Rend explicite « qui touche combien » sur chaque vente, en tenant compte
   des frais Fapshi. Source unique de vérité pour le calcul des parts.

   Frais Fapshi (tarif public, docs fapshi.com/en/pricing — à confirmer sur
   le dashboard, un taux négocié pouvant s'appliquer) :
     - encaissement (collecte) : 3 %
     - payout (reversement)     : 0 %  (gratuit)
   ============================================================ */

export const FAPSHI_COLLECTE_PCT = 3;   // % prélevé à l'encaissement
export const FAPSHI_PAYOUT_PCT = 0;     // % prélevé au reversement (gratuit)

/* Politique de prise en charge des frais Fapshi.
   ✅ D16 tranchée (Franklin, 16/07) : 'plateforme' — Kalamundi absorbe seule
   les frais de paiement, l'auteur touche sa part PLEINE sur le prix. C'est un
   argument de confiance, à afficher clairement aux auteurs (publish, contrat,
   dashboard).
   'brut' reste disponible (frais partagés au prorata) mais n'est pas le défaut. */
export const FRAIS_A_LA_CHARGE = 'plateforme';

function entier(v, nom) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${nom} invalide : « ${v} ».`);
  return Math.round(n);
}

export function fraisFapshiCollecte(montantBrut) {
  return Math.round(entier(montantBrut, 'Montant') * FAPSHI_COLLECTE_PCT / 100);
}

/* ============================================================
   Vente d'un livre (auteur ↔ plateforme). Défaut 50/50 (D10).
   ============================================================ */
export function repartirVenteLivre(montantBrut, { partAuteurPct = 50, fraisALaCharge = FRAIS_A_LA_CHARGE } = {}) {
  const brut = entier(montantBrut, 'Montant');
  if (partAuteurPct < 0 || partAuteurPct > 100) throw new Error(`Part auteur invalide : « ${partAuteurPct} ».`);

  const frais = fraisFapshiCollecte(brut);
  const net = brut - frais;

  let auteur;
  let plateforme;
  if (fraisALaCharge === 'plateforme') {
    // L'auteur touche sa part pleine sur le brut ; la plateforme absorbe les frais.
    auteur = Math.round(brut * partAuteurPct / 100);
    plateforme = net - auteur;
  } else {
    // 'brut' : on partage le NET (donc chacun supporte les frais au prorata).
    auteur = Math.round(net * partAuteurPct / 100);
    plateforme = net - auteur;
  }

  return {
    type: 'livre',
    montant_brut_xaf: brut,
    frais_fapshi_xaf: frais,
    net_xaf: net,
    part_auteur_xaf: auteur,
    part_plateforme_xaf: plateforme,
    frais_a_la_charge: fraisALaCharge,
  };
}

/* ============================================================
   Vente d'occasion (vendeur ↔ plateforme). Commission 15 % (D15).
   Aucun revenu auteur (doctrine de la première vente).
   Le vendeur reçoit sa part par payout (0 % de frais Fapshi).
   ============================================================ */
export function repartirVenteOccasion(montantBrut, { commissionPct = 20 } = {}) {
  const brut = entier(montantBrut, 'Montant');
  if (commissionPct < 0 || commissionPct > 100) throw new Error(`Commission invalide : « ${commissionPct} ».`);

  const frais = fraisFapshiCollecte(brut);
  const net = brut - frais;
  const commission = Math.round(brut * commissionPct / 100);

  // Le vendeur touche sa part pleine sur le PRIX (prix − commission) : le payout
  // étant gratuit, rien ne l'ampute. La plateforme absorbe les frais Fapshi sur
  // sa commission. Somme vérifiée : vendeur + plateforme + frais = brut.
  const vendeur = brut - commission;
  return {
    type: 'occasion',
    montant_brut_xaf: brut,
    frais_fapshi_xaf: frais,
    net_xaf: net,
    commission_xaf: commission,
    part_vendeur_xaf: vendeur,               // versé par payout (gratuit)
    part_plateforme_xaf: commission - frais, // commission nette des frais Fapshi
  };
}

/* Aperçu clair destiné au VENDEUR d'occasion : ce qu'il fixe, ce qui est
   prélevé, ce qu'il reçoit. À afficher au moment de poster une annonce. */
export function apercuVendeurOccasion(prix, { commissionPct = 20 } = {}) {
  const r = repartirVenteOccasion(prix, { commissionPct });
  return {
    prix_vente_xaf: r.montant_brut_xaf,
    commission_pct: commissionPct,
    commission_kalamundi_xaf: r.commission_xaf,
    frais_paiement_pris_en_charge: true, // Kalamundi absorbe les frais Fapshi (D16)
    vous_recevez_xaf: r.part_vendeur_xaf, // versé par Mobile Money, payout gratuit
  };
}

/* ============================================================
   Vente en PROMO (idée Franklin) : un livre mis en avant/soldé sur lequel
   Kalamundi prend un pourcentage. La promo applique une remise sur le prix
   ET peut donner à la plateforme une part majorée (frais de mise en avant).
   ============================================================ */
export function prixPromo(prixNormal, remisePct) {
  const prix = entier(prixNormal, 'Prix');
  if (remisePct < 0 || remisePct > 90) throw new Error(`Remise promo invalide : « ${remisePct} » (0–90).`);
  return Math.round(prix * (100 - remisePct) / 100);
}

export function repartirVentePromo(prixNormal, { remisePct = 0, partPlateformePct = 50, fraisALaCharge = FRAIS_A_LA_CHARGE } = {}) {
  const prixVente = prixPromo(prixNormal, remisePct);
  const r = repartirVenteLivre(prixVente, { partAuteurPct: 100 - partPlateformePct, fraisALaCharge });
  return {
    ...r,
    type: 'promo',
    prix_normal_xaf: entier(prixNormal, 'Prix'),
    remise_pct: remisePct,
    prix_vente_xaf: prixVente,
  };
}
