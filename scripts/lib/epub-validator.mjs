/* ============================================================
   epub-validator.mjs — Validation structurelle EPUB native
   Kalamundi — La Plume du Monde

   Pourquoi : l'epubcheck officiel exige Java + un jar externes,
   donc il ne tournait jamais (sortie "skipped") et laissait passer
   des EPUB invalides. Ce validateur natif tourne partout, sans
   dépendance, et garde le pipeline honnête.

   Portée : contrôles structurels OCF/OPF + préfixes de namespace XML.
   Ce n'est PAS un remplacement complet d'epubcheck (qui reste la
   passe profonde optionnelle via scripts/validate_epub.mjs).
   ============================================================ */

import zlib from 'node:zlib';

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;

/* ============================================================
   Lecture ZIP (stored + deflate)
   ============================================================ */

export function lireZip(buffer) {
  const eocd = trouverEocd(buffer);
  if (eocd < 0) throw new Error('Archive ZIP invalide : fin de catalogue (EOCD) introuvable.');

  const nbEntrees = buffer.readUInt16LE(eocd + 10);
  let pointeur = buffer.readUInt32LE(eocd + 16);
  const entrees = [];

  for (let i = 0; i < nbEntrees; i++) {
    if (buffer.readUInt32LE(pointeur) !== SIG_CENTRAL) {
      throw new Error(`Archive ZIP invalide : entrée ${i + 1} sans signature de catalogue.`);
    }

    const methode = buffer.readUInt16LE(pointeur + 10);
    const tailleCompressee = buffer.readUInt32LE(pointeur + 20);
    const longueurNom = buffer.readUInt16LE(pointeur + 28);
    const longueurExtra = buffer.readUInt16LE(pointeur + 30);
    const longueurCommentaire = buffer.readUInt16LE(pointeur + 32);
    const offsetLocal = buffer.readUInt32LE(pointeur + 42);
    const nom = buffer.toString('utf8', pointeur + 46, pointeur + 46 + longueurNom);

    const nomLocal = buffer.readUInt16LE(offsetLocal + 26);
    const extraLocal = buffer.readUInt16LE(offsetLocal + 28);
    const debut = offsetLocal + 30 + nomLocal + extraLocal;
    const brut = buffer.subarray(debut, debut + tailleCompressee);

    entrees.push({
      nom,
      methode,
      index: i,
      extraLocal,
      contenu: methode === 8 ? zlib.inflateRawSync(brut) : brut,
    });

    pointeur += 46 + longueurNom + longueurExtra + longueurCommentaire;
  }

  return entrees;
}

function trouverEocd(buffer) {
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === SIG_EOCD) return i;
  }
  return -1;
}

/* ============================================================
   Namespaces XML — le contrôle qui attrape les préfixes oubliés
   ============================================================ */

const PREFIXES_IMPLICITES = new Set(['xml', 'xmlns']);

export function prefixesNonDeclares(xml) {
  const declares = new Set(PREFIXES_IMPLICITES);
  for (const found of xml.matchAll(/xmlns:([A-Za-z_][\w.\-]*)\s*=/g)) {
    declares.add(found[1]);
  }

  const utilises = new Set();
  /* éléments : <prefixe:nom  ou  </prefixe:nom */
  for (const found of xml.matchAll(/<\/?([A-Za-z_][\w.\-]*):[A-Za-z_]/g)) {
    utilises.add(found[1]);
  }
  /* attributs : espace + prefixe:nom= */
  for (const found of xml.matchAll(/\s([A-Za-z_][\w.\-]*):[A-Za-z_][\w.\-]*\s*=/g)) {
    utilises.add(found[1]);
  }

  return [...utilises].filter(prefixe => !declares.has(prefixe));
}

/* ============================================================
   Validation EPUB
   ============================================================ */

export function validerEpub(buffer) {
  const erreurs = [];
  const avertissements = [];

  let entrees;
  try {
    entrees = lireZip(buffer);
  } catch (error) {
    return { ok: false, erreurs: [error.message], avertissements };
  }

  const parNom = new Map(entrees.map(e => [e.nom, e]));

  /* --- OCF : le mimetype --- */
  const mimetype = entrees.find(e => e.nom === 'mimetype');
  if (!mimetype) {
    erreurs.push('OCF : l’entrée « mimetype » est absente.');
  } else {
    if (mimetype.index !== 0) erreurs.push('OCF : « mimetype » doit être la toute première entrée de l’archive.');
    if (mimetype.methode !== 0) erreurs.push('OCF : « mimetype » doit être stocké sans compression.');
    if (mimetype.extraLocal !== 0) erreurs.push('OCF : « mimetype » ne doit pas avoir de champ extra.');
    if (mimetype.contenu.toString('utf8') !== 'application/epub+zip') {
      erreurs.push('OCF : « mimetype » doit contenir exactement « application/epub+zip ».');
    }
  }

  /* --- OCF : le container --- */
  const container = parNom.get('META-INF/container.xml');
  if (!container) {
    erreurs.push('OCF : « META-INF/container.xml » est absent.');
    return { ok: false, erreurs, avertissements };
  }

  const containerXml = container.contenu.toString('utf8');
  const cheminOpf = containerXml.match(/full-path\s*=\s*"([^"]+)"/)?.[1];
  if (!cheminOpf) {
    erreurs.push('OCF : container.xml ne déclare aucun rootfile full-path.');
    return { ok: false, erreurs, avertissements };
  }

  const opf = parNom.get(cheminOpf);
  if (!opf) {
    erreurs.push(`OPF : le rootfile « ${cheminOpf} » déclaré dans container.xml est absent de l’archive.`);
    return { ok: false, erreurs, avertissements };
  }

  const opfXml = opf.contenu.toString('utf8');
  const baseOpf = cheminOpf.includes('/') ? cheminOpf.slice(0, cheminOpf.lastIndexOf('/') + 1) : '';

  /* --- OPF : métadonnées obligatoires --- */
  const uniqueId = opfXml.match(/unique-identifier\s*=\s*"([^"]+)"/)?.[1];
  if (!uniqueId) {
    erreurs.push('OPF : l’attribut « unique-identifier » est absent de <package>.');
  } else if (!new RegExp(`<dc:identifier[^>]*\\bid\\s*=\\s*"${echapperRegex(uniqueId)}"`).test(opfXml)) {
    erreurs.push(`OPF : aucun <dc:identifier> ne porte l’id « ${uniqueId} » désigné par unique-identifier.`);
  }
  if (!/<dc:title[\s>]/.test(opfXml)) erreurs.push('OPF : <dc:title> est obligatoire.');
  if (!/<dc:language[\s>]/.test(opfXml)) erreurs.push('OPF : <dc:language> est obligatoire.');

  const versionOpf = opfXml.match(/<package[^>]*\bversion\s*=\s*"([^"]+)"/)?.[1];
  if (versionOpf?.startsWith('3') && !/property\s*=\s*"dcterms:modified"/.test(opfXml)) {
    erreurs.push('OPF : EPUB 3 exige <meta property="dcterms:modified">.');
  }

  /* --- OPF : manifest ↔ archive --- */
  const items = new Map();
  for (const found of opfXml.matchAll(/<item\b[^>]*>/g)) {
    const balise = found[0];
    const id = balise.match(/\bid\s*=\s*"([^"]+)"/)?.[1];
    const href = balise.match(/\bhref\s*=\s*"([^"]+)"/)?.[1];
    const props = balise.match(/\bproperties\s*=\s*"([^"]+)"/)?.[1] ?? '';
    if (!id || !href) continue;

    items.set(id, { href, props });
    if (/^[a-z]+:\/\//i.test(href)) continue;

    const chemin = normaliserChemin(baseOpf + decodeURIComponent(href));
    if (!parNom.has(chemin)) {
      erreurs.push(`Manifest : « ${href} » (id ${id}) est déclaré mais absent de l’archive.`);
    }
  }

  if (!items.size) erreurs.push('OPF : le <manifest> ne déclare aucun item.');

  const nav = [...items.values()].filter(item => item.props.split(/\s+/).includes('nav'));
  if (versionOpf?.startsWith('3') && nav.length !== 1) {
    erreurs.push(`OPF : EPUB 3 exige exactement un item properties="nav" (trouvé : ${nav.length}).`);
  }

  /* --- OPF : spine ↔ manifest --- */
  const idrefs = [...opfXml.matchAll(/<itemref\b[^>]*\bidref\s*=\s*"([^"]+)"/g)].map(f => f[1]);
  if (!idrefs.length) erreurs.push('OPF : le <spine> est vide.');
  for (const idref of idrefs) {
    if (!items.has(idref)) erreurs.push(`Spine : idref « ${idref} » ne correspond à aucun item du manifest.`);
  }

  /* --- XML : préfixes de namespace non déclarés --- */
  for (const entree of entrees) {
    if (!/\.(xhtml|opf|ncx|xml)$/i.test(entree.nom)) continue;
    const xml = entree.contenu.toString('utf8');
    for (const prefixe of prefixesNonDeclares(xml)) {
      erreurs.push(`XML : « ${entree.nom} » utilise le préfixe « ${prefixe}: » sans déclarer xmlns:${prefixe} → document mal formé.`);
    }
  }

  return { ok: erreurs.length === 0, erreurs, avertissements };
}

function normaliserChemin(chemin) {
  const parties = [];
  for (const partie of chemin.split('/')) {
    if (partie === '.' || partie === '') continue;
    if (partie === '..') parties.pop();
    else parties.push(partie);
  }
  return parties.join('/');
}

function echapperRegex(valeur) {
  return valeur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
