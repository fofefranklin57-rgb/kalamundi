/* ============================================================
   upload.js — Upload et parsing des fichiers œuvre
   Kalamundi — La Plume du Monde
   ============================================================ */

import { validerFichier, formatTailleFichier } from './utils.js';

/* ============================================================
   Lire le contenu texte d'un fichier
   ============================================================ */

export async function lireFichier(fichier) {
  const ext = fichier.name.split('.').pop().toLowerCase();

  const validation = validerFichier(fichier);
  if (!validation.valide) throw new Error(validation.erreur);

  switch (ext) {
    case 'txt':  return lireTxt(fichier);
    case 'docx': return lireDocx(fichier);
    case 'pdf':  return lirePdf(fichier);
    case 'epub': return lireEpub(fichier);
    case 'odt':  return lireOdt(fichier);
    default:     throw new Error('Format non supporté.');
  }
}

/* ---- TXT -------------------------------------------------- */

async function lireTxt(fichier) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(nettoyerTexteImporte(e.target.result));
    reader.onerror = () => reject(new Error('Impossible de lire le fichier.'));
    reader.readAsText(fichier, 'UTF-8');
  });
}

/* ---- DOCX ------------------------------------------------- */

async function lireDocx(fichier) {
  // mammoth.js chargé en CDN à la demande
  if (!window.mammoth) {
    await chargerScript('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js');
  }
  const buffer = await fichier.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
  return nettoyerTexteImporte(result.value);
}

/* ---- PDF -------------------------------------------------- */

async function lirePdf(fichier) {
  // PDF.js chargé en CDN à la demande
  if (!window.pdfjsLib) {
    await chargerScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }
  const buffer  = await fichier.arrayBuffer();
  const pdf     = await window.pdfjsLib.getDocument({ data: buffer }).promise;
  const pages   = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Reconstituer le texte de la page en préservant les sauts de ligne internes
    let lignes = '';
    let lastY  = null;
    for (const item of content.items) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        lignes += '\n';
      }
      lignes += item.str;
      lastY = item.transform[5];
    }
    pages.push(lignes.trim());
  }
  // Séparer les pages par un marqueur explicite — préservé dans le lecteur
  return nettoyerTexteImporte(pages.join('\n---PAGE---\n'));
}

/* ---- EPUB ------------------------------------------------- */

async function lireEpub(fichier) {
  // ePub.js chargé en CDN à la demande
  if (!window.ePub) {
    await chargerScript('https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js');
  }
  const buffer = await fichier.arrayBuffer();
  const book   = window.ePub(buffer);
  await book.ready;

  let texte = '';
  const spine = book.spine;
  for (const item of spine.items) {
    await item.load(book.load.bind(book));
    const doc = item.document;
    if (doc) texte += doc.body?.innerText || '';
    item.unload();
  }
  return nettoyerTexteImporte(texte);
}

/* ---- ODT -------------------------------------------------- */

async function lireOdt(fichier) {
  // ODT = ZIP contenant content.xml — on parse manuellement
  if (!window.JSZip) {
    await chargerScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
  }
  const buffer = await fichier.arrayBuffer();
  const zip    = await window.JSZip.loadAsync(buffer);
  const xml    = await zip.file('content.xml').async('text');
  const parser = new DOMParser();
  const doc    = parser.parseFromString(xml, 'application/xml');
  const texte = Array.from(doc.querySelectorAll('text|p, text\\:p'))
    .map(el => el.textContent)
    .join('\n')
    .trim() || extraireTexteXML(xml);
  return nettoyerTexteImporte(texte);
}

function extraireTexteXML(xml) {
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ============================================================
   Nettoyage import : retire les premières pages de couverture
   ============================================================ */

export function nettoyerTexteImporte(texte) {
  const source = String(texte || '').replace(/\u0000/g, '').trim();
  if (!source) return '';
  return supprimerPremiereCouverture(source).trim();
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

/* ============================================================
   Calcul SHA-256 pour horodatage PI
   ============================================================ */

export async function calculerSHA256(contenu) {
  const encoder = new TextEncoder();
  const data    = encoder.encode(contenu);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function calculerSHA256Fichier(fichier) {
  const buffer     = await fichier.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ============================================================
   Watermarking invisible (session_id encodé dans espaces Unicode)
   ============================================================ */

export function watermark(texte, sessionId) {
  const bits = sessionId
    .split('')
    .map(c => c.charCodeAt(0).toString(2).padStart(8, '0'))
    .join('');
  let result   = '';
  let bitIndex = 0;
  for (const char of texte) {
    result += char;
    if (char === ' ' && bitIndex < bits.length) {
      result += bits[bitIndex] === '1' ? '​' : '‌';
      bitIndex++;
    }
  }
  return result;
}

/* ============================================================
   Chargeur de script dynamique
   ============================================================ */

function chargerScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload  = resolve;
    script.onerror = () => reject(new Error(`Impossible de charger : ${src}`));
    document.head.appendChild(script);
  });
}

/* ============================================================
   Découpage en chapitres automatique
   ============================================================ */

export function decouperEnChapitres(texte) {
  const source = String(texte || '').trim();
  if (!source) return [{ numero: 1, titre: null, contenu: '' }];

  const regex = /^\s*(chapitre\s+\d+[^\n]*|chapter\s+\d+[^\n]*|partie\s+\d+[^\n]*|prologue|épilogue|epilogue|[IVXivx]+\.|—\s*\d+\s*—|\*{3})\s*$/gim;
  const matches = [...source.matchAll(regex)];
  if (!matches.length) return [{ numero: 1, titre: null, contenu: source }];

  const chapitres = [];
  const avantPremier = source.slice(0, matches[0].index).trim();
  if (avantPremier && avantPremier.length > 180) {
    chapitres.push({ numero: chapitres.length + 1, titre: 'Avant-propos', contenu: avantPremier });
  }

  matches.forEach((match, index) => {
    const debut = match.index + match[0].length;
    const fin = index + 1 < matches.length ? matches[index + 1].index : source.length;
    const titre = match[1].trim();
    const contenu = source.slice(debut, fin).trim();
    if (contenu) chapitres.push({ numero: chapitres.length + 1, titre, contenu });
  });

  return chapitres.length ? chapitres : [{ numero: 1, titre: null, contenu: source }];
}

export { formatTailleFichier };
