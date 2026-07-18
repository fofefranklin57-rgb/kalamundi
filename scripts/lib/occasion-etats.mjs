/* ============================================================
   occasion-etats.mjs — Machine à états du séquestre (escrow) occasion
   Kalamundi — La Plume du Monde  (P4 #14, D15)

   Vendre un livre d'occasion = de l'argent qui circule entre deux inconnus.
   Le séquestre protège les deux : l'argent de l'acheteur est GELÉ par la
   plateforme au paiement, et n'est versé au vendeur QUE lorsque l'acheteur
   confirme la réception (ou automatiquement après un délai, s'il ne dit rien).
   Un litige gèle tout jusqu'à arbitrage.

   Ce module est pur et testable ; la migration V012 réplique ces règles en SQL
   (RPC SECURITY DEFINER) pour qu'elles soient aussi appliquées côté serveur.

   Règle métier : sur l'occasion, l'AUTEUR ne touche rien (première vente déjà
   effectuée). La recette se partage vendeur / plateforme.
   ============================================================ */

export const ETATS = Object.freeze({
  EN_ATTENTE_PAIEMENT: 'en_attente_paiement', // commande créée, pas payée
  PAYE_SEQUESTRE:      'paye_sequestre',        // payé, fonds gelés par la plateforme
  REMIS:               'remis',                 // vendeur a remis/expédié
  RECEPTIONNE:         'receptionne',           // acheteur a confirmé la réception
  CLOS:                'clos',                   // fonds versés au vendeur, terminé
  LITIGE:              'litige',                 // gelé, en attente d'arbitrage
  ANNULE:              'annule',                 // annulé avant paiement
  REMBOURSE:           'rembourse',              // remboursé à l'acheteur après litige
});

export const ETATS_TERMINAUX = Object.freeze([ETATS.CLOS, ETATS.ANNULE, ETATS.REMBOURSE]);

/* Acteurs autorisés à déclencher une transition. */
export const ACTEURS = Object.freeze(['acheteur', 'vendeur', 'systeme', 'admin']);

/* Table des transitions : de -> [ { vers, acteurs } ].
   « systeme » = déclenché par le webhook de paiement ou l'auto-libération. */
const TRANSITIONS = Object.freeze({
  [ETATS.EN_ATTENTE_PAIEMENT]: [
    { vers: ETATS.PAYE_SEQUESTRE, acteurs: ['systeme'] },              // paiement confirmé
    { vers: ETATS.ANNULE,         acteurs: ['acheteur', 'systeme'] },  // annulation / expiration
  ],
  [ETATS.PAYE_SEQUESTRE]: [
    { vers: ETATS.REMIS,     acteurs: ['vendeur'] },                   // vendeur remet/expédie
    { vers: ETATS.LITIGE,    acteurs: ['acheteur', 'vendeur'] },       // problème avant remise
    { vers: ETATS.REMBOURSE, acteurs: ['admin'] },                     // arbitrage : remboursement
  ],
  [ETATS.REMIS]: [
    { vers: ETATS.RECEPTIONNE, acteurs: ['acheteur', 'systeme'] },     // confirmation (ou auto après délai)
    { vers: ETATS.LITIGE,      acteurs: ['acheteur'] },                // non reçu / non conforme
  ],
  [ETATS.RECEPTIONNE]: [
    { vers: ETATS.CLOS, acteurs: ['systeme'] },                        // fonds versés au vendeur
  ],
  [ETATS.LITIGE]: [
    { vers: ETATS.CLOS,      acteurs: ['admin'] },                     // tranché en faveur du vendeur
    { vers: ETATS.REMBOURSE, acteurs: ['admin'] },                     // tranché en faveur de l'acheteur
  ],
  /* États terminaux : aucune transition sortante. */
  [ETATS.CLOS]: [],
  [ETATS.ANNULE]: [],
  [ETATS.REMBOURSE]: [],
});

export function estEtatValide(etat) {
  return Object.hasOwn(TRANSITIONS, etat);
}

export function estTerminal(etat) {
  return ETATS_TERMINAUX.includes(etat);
}

/* Une transition est-elle permise, et pour cet acteur ? */
export function transitionAutorisee(de, vers, acteur) {
  if (!estEtatValide(de) || !estEtatValide(vers)) return false;
  const arc = TRANSITIONS[de].find(t => t.vers === vers);
  if (!arc) return false;
  return acteur === undefined || arc.acteurs.includes(acteur);
}

/* Transitions possibles depuis un état pour un acteur donné. */
export function transitionsPossibles(de, acteur) {
  if (!estEtatValide(de)) return [];
  return TRANSITIONS[de]
    .filter(t => acteur === undefined || t.acteurs.includes(acteur))
    .map(t => t.vers);
}

/* Le vendeur est-il payé dans cet état ? (déclenche la sortie du séquestre) */
export function vendeurPaye(etat) {
  return etat === ETATS.CLOS;
}

/* L'acheteur est-il remboursé dans cet état ? */
export function acheteurRembourse(etat) {
  return etat === ETATS.REMBOURSE || etat === ETATS.ANNULE;
}

/* ============================================================
   Répartition de la recette (occasion)
   ============================================================ */

/* Commission plateforme sur l'occasion (D15, validée Franklin 16/07 : 20 %,
   niveau PangoBooks). La plateforme porte les frais Fapshi (D16). */
export const COMMISSION_OCCASION_PCT = 20;

/* Délai d'auto-libération : sans réponse de l'acheteur après remise, on
   considère la réception acquise et on libère le vendeur (protège le vendeur). */
export const AUTO_LIBERATION_JOURS = 7;

export function repartirOccasion(montantXaf, commissionPct = COMMISSION_OCCASION_PCT) {
  const montant = Number(montantXaf);
  if (!Number.isFinite(montant) || montant < 0) {
    throw new Error(`Montant occasion invalide : « ${montantXaf} ».`);
  }
  if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) {
    throw new Error(`Commission invalide : « ${commissionPct} » (attendu 0–100).`);
  }
  const commission = Math.round(montant * commissionPct / 100);
  return {
    montant_xaf: montant,
    commission_xaf: commission,
    montant_vendeur_xaf: montant - commission, // l'auteur ne touche RIEN sur l'occasion
    commission_pct: commissionPct,
  };
}
