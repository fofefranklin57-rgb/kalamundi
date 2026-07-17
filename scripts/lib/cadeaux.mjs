/* ============================================================
   cadeaux.mjs — Codes cadeaux diaspora (D11)
   Kalamundi — La Plume du Monde

   Un code cadeau se partage souvent à l'oral ou par WhatsApp entre un
   proche à l'étranger et un proche au pays. Il doit donc être :
   - non devinable (tiré au sort cryptographique, pas séquentiel) ;
   - transcriptible sans ambiguïté (ni 0/O, ni 1/I/L) ;
   - tolérant à la saisie (espaces, tirets, minuscules).
   ============================================================ */

/* Alphabet sans caractères confondables à l'oral ou à l'écrit :
   pas de 0/O, pas de 1/I/L, pas de U (confondu avec V à l'oral). */
export const ALPHABET_CADEAU = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

export const LONGUEUR_CADEAU = 12;
export const LONGUEUR_MIN = 8;
export const LONGUEUR_MAX = 24;

/* Tirage sans biais : on rejette les octets qui dépasseraient le dernier
   multiple complet de l'alphabet (un simple % biaiserait les 1res lettres). */
export function genererCodeCadeau(longueur = LONGUEUR_CADEAU) {
  if (!Number.isInteger(longueur) || longueur < LONGUEUR_MIN || longueur > LONGUEUR_MAX) {
    throw new Error(`Longueur de code invalide : attendu entre ${LONGUEUR_MIN} et ${LONGUEUR_MAX}.`);
  }

  const taille = ALPHABET_CADEAU.length;
  const plafond = Math.floor(256 / taille) * taille;
  const lettres = [];

  while (lettres.length < longueur) {
    const octets = crypto.getRandomValues(new Uint8Array(longueur));
    for (const octet of octets) {
      if (octet >= plafond) continue; // rejet : préserve l'équiprobabilité
      lettres.push(ALPHABET_CADEAU[octet % taille]);
      if (lettres.length === longueur) break;
    }
  }

  return lettres.join('');
}

/* Normalise une saisie humaine : « abcd-efgh ijkl » → « ABCDEFGHIJKL ».
   Tout caractère hors alphabet est retiré, y compris tirets et espaces. */
export function normaliserCodeCadeau(code) {
  const majuscules = String(code ?? '').toUpperCase();
  let propre = '';
  for (const lettre of majuscules) {
    if (ALPHABET_CADEAU.includes(lettre)) propre += lettre;
  }
  return propre;
}

export function estCodeCadeauValide(code) {
  const propre = normaliserCodeCadeau(code);
  return propre.length >= LONGUEUR_MIN && propre.length <= LONGUEUR_MAX;
}

/* Affichage lisible par groupes de 4 : ABCD-EFGH-IJKL.
   Purement cosmétique — le code stocké reste sans tiret. */
export function formaterCodeCadeau(code) {
  const propre = normaliserCodeCadeau(code);
  return (propre.match(/.{1,4}/g) || []).join('-');
}
