const CHAPTER_TARGET_SIZE = 9000;

export function nettoyerTexteImporte(texte) {
  const source = String(texte || '').replace(/\u0000/g, '').trim();
  if (!source) return '';
  return supprimerPremiereCouverture(source).trim();
}

export function decouperEnChapitres(texte, options = {}) {
  const source = nettoyerTexteImporte(texte);
  if (!source) return [creerChapitre({ numero: 1, titre: null, contenu: '' }, options)];

  const matches = detecterTitresChapitres(source);
  const chapitres = matches.length ? decouperParTitres(source, matches) : decouperParTaille(source);
  const propres = chapitres.length ? chapitres : [{ numero: 1, titre: null, contenu: source }];

  if (propres.length <= 1 && source.length > CHAPTER_TARGET_SIZE * 2) {
    return decouperParTaille(source).map((chapitre, index) => creerChapitre({ ...chapitre, numero: index + 1 }, options));
  }

  return propres.map((chapitre, index) => creerChapitre({ ...chapitre, numero: index + 1 }, options));
}

export function normaliserLivreDepuisTexte(texte, metadata = {}) {
  const chapitres = decouperEnChapitres(texte, metadata);
  return {
    version: 1,
    titre: metadata.titre || metadata.title || 'Livre Kalamundi',
    auteur: metadata.auteur || metadata.author || 'Auteur Kalamundi',
    langue_originale: metadata.langue_originale || metadata.lang || 'fr',
    format_source: metadata.format_source || metadata.format || 'texte',
    chapitres,
  };
}

export function creerChapitreId(chapitre, options = {}) {
  const prefix = slugifier(options.titre || options.title || 'livre').slice(0, 32) || 'livre';
  const numero = String(chapitre.numero || 1).padStart(3, '0');
  const base = `${chapitre.titre || ''}\n${String(chapitre.contenu || '').slice(0, 1200)}`;
  return `${prefix}-ch-${numero}-${hashCourt(base)}`;
}

export function slugifier(valeur) {
  return String(valeur || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function hashCourt(valeur) {
  const texte = String(valeur || '');
  let h1 = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h1 ^= texte.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0');
}

export function texteEnParagraphes(texte) {
  return String(texte || '')
    .split(/\n{2,}/)
    .map(p => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

export function escapeXml(valeur) {
  return String(valeur || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function creerChapitre(chapitre, options) {
  const contenu = String(chapitre.contenu || '').trim();
  const propre = {
    numero: chapitre.numero || 1,
    titre: nettoyerTitreChapitre(chapitre.titre),
    contenu,
    type_element: chapitre.type_element || 'chapitre',
    source_hash: hashCourt(contenu),
  };
  return {
    ...propre,
    chapitre_id: chapitre.chapitre_id || creerChapitreId(propre, options),
  };
}

function supprimerPremiereCouverture(texte) {
  const pages = texte.split(/\n---PAGE---\n/);
  if (pages.length > 1 && estProbableCouverture(pages[0], pages[1])) {
    return pages.slice(1).join('\n---PAGE---\n');
  }

  const blocs = texte.split(/\n{3,}/);
  if (blocs.length > 1 && estProbableCouverture(blocs[0], blocs[1])) {
    return blocs.slice(1).join('\n\n');
  }

  return texte;
}

function estProbableCouverture(premierBloc, blocSuivant = '') {
  const brut = String(premierBloc || '').trim();
  if (!brut) return false;

  const lignes = brut.split('\n').map(l => l.trim()).filter(Boolean);
  const propre = brut.replace(/\s+/g, ' ').trim();
  const suivant = String(blocSuivant || '').replace(/\s+/g, ' ').trim();

  if (/\b(chapitre|chapter|prologue|partie|acte)\b\s*([0-9ivx]+)?/i.test(propre)) return false;
  if (propre.length > 900 || lignes.length > 14) return false;

  const ponctuation = (propre.match(/[.!?;]/g) || []).length;
  const motsCouverture = /\b(auteur|author|roman|nouvelle|po[eé]sie|essai|copyright|tous droits|isbn|edition|éditeur|kalamundi)\b/i.test(propre);
  const suiteLecture = /\b(chapitre|chapter|prologue|partie|premi[eè]re partie)\b/i.test(suivant) || suivant.length > propre.length * 1.2;

  return ponctuation <= 3 && (motsCouverture || suiteLecture || lignes.length <= 8);
}

function decouperParTitres(source, matches) {
  const chapitres = [];
  const avantPremier = source.slice(0, matches[0].index).trim();
  if (avantPremier && avantPremier.length > 260) {
    chapitres.push({ numero: chapitres.length + 1, titre: 'Avant-propos', contenu: avantPremier });
  }

  matches.forEach((match, index) => {
    const debut = match.index + match.raw.length;
    const fin = index + 1 < matches.length ? matches[index + 1].index : source.length;
    const titre = nettoyerTitreChapitre(match.titre);
    const contenu = source.slice(debut, fin).trim();
    if (contenu) chapitres.push({ numero: chapitres.length + 1, titre, contenu });
  });

  return chapitres;
}

function detecterTitresChapitres(source) {
  const lignes = source.split('\n');
  const titres = [];
  let index = 0;

  lignes.forEach((ligne, i) => {
    const raw = ligne;
    const propre = raw.trim();
    const debut = index;
    index += raw.length + 1;
    if (!propre || propre.length > 140) return;
    if (!estTitreChapitre(propre, lignes[i - 1], lignes[i + 1])) return;
    titres.push({ index: debut, raw, titre: propre });
  });

  return filtrerTitresTropProches(titres, source);
}

function estTitreChapitre(ligne, avant = '', apres = '') {
  const propre = ligne.replace(/\s+/g, ' ').trim();
  const bas = propre.toLowerCase();
  const ligneIsolee = !String(avant || '').trim() || !String(apres || '').trim();
  const ponctuationForte = /[!?;:]{2,}|[.!?]$/.test(propre);
  const mots = propre.split(/\s+/).length;

  if (/^(prologue|epilogue|épilogue|avant-propos|préface|preface|introduction|conclusion)$/i.test(propre)) return true;
  if (/^(chapitre|chapter)\s+(premier|[0-9]+|[ivxlcdm]+|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze)\b/i.test(propre)) return true;
  if (/^(livre|book|partie|part|acte)\s+(premier|[0-9]+|[ivxlcdm]+|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\b/i.test(propre)) return true;
  if (/^[-—–]\s*(chapitre|chapter|[0-9]+|[ivxlcdm]+)\s*[-—–]?$/i.test(propre)) return true;
  if (/^([0-9]{1,3}|[ivxlcdm]{1,8})[.)]\s+.{0,90}$/i.test(propre) && ligneIsolee && !ponctuationForte) return true;

  const estMajuscule = propre === propre.toUpperCase() && /[A-ZÀ-Ý]/.test(propre);
  if (ligneIsolee && estMajuscule && mots <= 10 && propre.length >= 4 && !ponctuationForte) {
    if (!/^(TABLE|SOMMAIRE|COPYRIGHT|ISBN|NOTES?|REMERCIEMENTS?)\b/i.test(propre)) return true;
  }

  return bas === '***' || bas === '* * *';
}

function filtrerTitresTropProches(titres, source) {
  const retenus = [];
  titres.forEach(t => {
    const precedent = retenus[retenus.length - 1];
    const entreTitres = precedent
      ? source.slice(precedent.index + precedent.raw.length, t.index).trim()
      : '';
    const titresConsecutifs = entreTitres.length < 120 && !/[.!?]\s*$/.test(entreTitres);
    if (precedent && titresConsecutifs) {
      precedent.titre = `${precedent.titre} - ${t.titre}`;
      precedent.raw += `\n${t.raw}`;
    } else {
      retenus.push(t);
    }
  });
  return retenus;
}

function nettoyerTitreChapitre(titre) {
  return String(titre || '')
    .replace(/^\s*[-—–]\s*/, '')
    .replace(/\s*[-—–]\s*$/, '')
    .trim() || null;
}

function decouperParTaille(source) {
  if (source.length <= CHAPTER_TARGET_SIZE * 1.4) return [{ numero: 1, titre: null, contenu: source }];

  const blocs = source.split(/\n{2,}/);
  const chapitres = [];
  let courant = '';

  blocs.forEach(bloc => {
    const ajout = courant ? `${courant}\n\n${bloc}` : bloc;
    if (ajout.length > CHAPTER_TARGET_SIZE && courant.length > 2500) {
      chapitres.push({ numero: chapitres.length + 1, titre: `Partie ${chapitres.length + 1}`, contenu: courant.trim() });
      courant = bloc;
    } else {
      courant = ajout;
    }
  });

  if (courant.trim()) chapitres.push({ numero: chapitres.length + 1, titre: `Partie ${chapitres.length + 1}`, contenu: courant.trim() });
  return chapitres;
}
