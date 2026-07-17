/* ============================================================
   devises.mjs — Multi-devises pour la diaspora (D11)
   Kalamundi — La Plume du Monde

   Fapshi encaisse en XAF : toute devise doit donc être convertie vers XAF
   avant paiement. Ce module centralise cette conversion, parce qu'elle était
   fausse quand elle était éparpillée (cf. ERROR_LOG 2026-07-16).

   Règle d'or : une devise non reconnue est REFUSÉE, jamais traitée comme
   des XAF par défaut — sinon 10 € deviennent 10 FCFA.
   ============================================================ */

export const DEVISE_BASE = 'XAF';

/* Parité FIXE et légale : 1 EUR = 655,957 XAF. Le franc CFA est arrimé à
   l'euro depuis 1999 — ce n'est PAS un taux de marché, il ne varie pas. */
export const EUR_XAF = 655.957;

/* Le dollar, lui, FLOTTE : aucune parité fixe avec le franc CFA.
   Ce taux doit venir de la config (env TAUX_USD_XAF) et être rafraîchi.
   La valeur ci-dessous n'est qu'un repli d'ordre de grandeur, pas une vérité. */
export const USD_XAF_DEFAUT = 600;

/* Garde-fou : un taux hors de cette plage trahit une config erronée
   (ex. quelqu'un qui recolle 655.957, la parité de l'euro, sur le dollar). */
export const USD_XAF_MIN = 400;
export const USD_XAF_MAX = 900;

export const DEVISES = {
  XAF: { decimales: 0, symbole: 'FCFA', locale: 'fr-CM' },
  EUR: { decimales: 2, symbole: '€', locale: 'fr-FR' },
  USD: { decimales: 2, symbole: '$', locale: 'en-US' },
};

export const DEVISES_SUPPORTEES = Object.keys(DEVISES);

/* Pas de repli implicite : une devise vide reste vide et sera refusée.
   C'est à l'appelant d'écrire son défaut (ex. `devise || DEVISE_BASE`),
   sinon on retombe sur le bug qu'on corrige : « inconnu → traité en XAF ». */
export function normaliserDevise(devise) {
  return String(devise ?? '').trim().toUpperCase();
}

export function estDeviseSupportee(devise) {
  return Object.hasOwn(DEVISES, normaliserDevise(devise));
}

/* Taux de conversion vers XAF pour 1 unité de la devise. */
export function tauxVersXaf(devise, options = {}) {
  const code = normaliserDevise(devise);

  if (code === 'XAF') return 1;
  if (code === 'EUR') return EUR_XAF;

  if (code === 'USD') {
    const brut = Number(options.tauxUsdXaf ?? USD_XAF_DEFAUT);

    /* Tripwire : c'est exactement le bug historique (le dollar converti avec
       la parité fixe de l'euro). On le refuse nommément, pas par plage. */
    if (Math.abs(brut - EUR_XAF) < 0.01) {
      throw new Error(
        `Taux USD→XAF refusé (${brut}) : c’est la parité fixe de l’EURO. `
        + 'Le dollar flotte et n’est pas arrimé au franc CFA — renseigner un vrai taux USD dans TAUX_USD_XAF.'
      );
    }

    if (!Number.isFinite(brut) || brut < USD_XAF_MIN || brut > USD_XAF_MAX) {
      throw new Error(
        `Taux USD→XAF invalide (${options.tauxUsdXaf}) : attendu entre ${USD_XAF_MIN} et ${USD_XAF_MAX}.`
      );
    }
    return brut;
  }

  throw new Error(`Devise non prise en charge : « ${code} ». Devises acceptées : ${DEVISES_SUPPORTEES.join(', ')}.`);
}

/* Convertit un montant vers XAF (entier : le franc CFA n'a pas de centimes). */
export function convertirVersXaf(montant, devise, options = {}) {
  const valeur = Number(montant);
  if (!Number.isFinite(valeur) || valeur < 0) {
    throw new Error(`Montant invalide : « ${montant} ».`);
  }
  return Math.round(valeur * tauxVersXaf(devise, options));
}

/* Lit le taux USD depuis l'environnement (Cloudflare Pages / Worker). */
export function tauxUsdDepuisEnv(env = {}) {
  const brut = env.TAUX_USD_XAF;
  return brut === undefined || brut === null || brut === '' ? USD_XAF_DEFAUT : Number(brut);
}

/* Affichage localisé — le XAF s'affiche sans décimales. */
export function formaterMontant(montant, devise = DEVISE_BASE) {
  const code = normaliserDevise(devise);
  const config = DEVISES[code];
  if (!config) throw new Error(`Devise non prise en charge : « ${code} ».`);

  const valeur = Number(montant) || 0;
  const nombre = valeur.toLocaleString(config.locale, {
    minimumFractionDigits: config.decimales,
    maximumFractionDigits: config.decimales,
  });

  return code === 'XAF' ? `${nombre} ${config.symbole}` : `${config.symbole}${nombre}`;
}

/* Détail de conversion, à exposer à l'acheteur : la diaspora doit voir
   ce qu'elle paie et à quel taux. */
export function detaillerConversion(montant, devise, options = {}) {
  const code = normaliserDevise(devise);
  const taux = tauxVersXaf(code, options);
  const montantXaf = convertirVersXaf(montant, code, options);

  return {
    devise: code,
    montant: Number(montant),
    montant_affiche: formaterMontant(montant, code),
    montant_xaf: montantXaf,
    montant_xaf_affiche: formaterMontant(montantXaf, 'XAF'),
    taux,
    taux_fixe: code === 'EUR' || code === 'XAF',
  };
}
