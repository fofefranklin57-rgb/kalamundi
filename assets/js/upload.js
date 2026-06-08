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
    reader.onload = (e) => resolve(e.target.result);
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
  return result.value;
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
  return pages.join('\n---PAGE---\n').trim();
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
  return texte.trim();
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
  return Array.from(doc.querySelectorAll('text|p, text\\:p'))
    .map(el => el.textContent)
    .join('\n')
    .trim() || extraireTexteXML(xml);
}

function extraireTexteXML(xml) {
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
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

export function decouперEnChapitres(texte) {
  // Cherche des séparateurs courants : "Chapitre", "Chapter", numéros romains
  const regex = /\n\s*(chapitre\s+\d+|chapter\s+\d+|partie\s+\d+|[IVXivx]+\.|—\s*\d+\s*—|\*{3})\s*\n/gi;
  const parties = texte.split(regex);

  if (parties.length <= 1) {
    return [{ numero: 1, titre: null, contenu: texte.trim() }];
  }

  const chapitres = [];
  let numero = 1;
  for (let i = 0; i < parties.length; i += 2) {
    const titre   = parties[i + 1]?.trim() || null;
    const contenu = parties[i]?.trim();
    if (contenu) {
      chapitres.push({ numero: numero++, titre, contenu });
    }
  }
  return chapitres;
}

export { formatTailleFichier };
