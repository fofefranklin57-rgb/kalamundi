/* ============================================================
   security.js — Protection du contenu des œuvres
   Kalamundi — La Plume du Monde
   C2-a : anti-copie, clic droit, sélection, raccourcis
   C2-b : watermark invisible (zero-width characters)
   ============================================================ */

/* ============================================================
   Activer toutes les protections sur le conteneur de lecture
   Appeler après injection du contenu dans le DOM
   ============================================================ */

export function activerProtections(conteneur, userId = null) {
  if (!conteneur) return;

  _bloquerSelection(conteneur);
  _bloquerClicDroit(conteneur);
  _bloquerRaccourcis();
  _bloquerGlisserDeposer(conteneur);
  _bloquerImpression();

  if (userId) {
    _injecterWatermark(conteneur, userId);
  }
}

/* ============================================================
   C2-a — Blocage sélection texte
   ============================================================ */

function _bloquerSelection(conteneur) {
  conteneur.addEventListener('selectstart', e => e.preventDefault());
  conteneur.addEventListener('mousedown', e => {
    /* Autoriser les clics simples (navigation), bloquer le drag-select */
    if (e.detail > 1) e.preventDefault();
  });
}

/* ============================================================
   C2-a — Blocage clic droit
   ============================================================ */

function _bloquerClicDroit(conteneur) {
  conteneur.addEventListener('contextmenu', e => {
    e.preventDefault();
    _afficherTooltipProtection(e.clientX, e.clientY);
  });
}

function _afficherTooltipProtection(x, y) {
  const existing = document.getElementById('kala-protect-tip');
  if (existing) existing.remove();

  const tip = document.createElement('div');
  tip.id = 'kala-protect-tip';
  tip.textContent = '🔒 Contenu protégé — Kalamundi';
  tip.style.cssText = `
    position: fixed;
    left: ${Math.min(x, window.innerWidth - 220)}px;
    top: ${Math.min(y, window.innerHeight - 50)}px;
    background: rgba(27,67,50,0.92);
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-family: sans-serif;
    z-index: 99999;
    pointer-events: none;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(tip);
  setTimeout(() => tip.remove(), 1800);
}

/* ============================================================
   C2-a — Blocage raccourcis copier / imprimer / DevTools
   ============================================================ */

function _bloquerRaccourcis() {
  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey;

    /* Copier, Couper, Tout sélectionner */
    if (ctrl && ['c', 'x', 'a', 'u'].includes(e.key.toLowerCase())) {
      /* Autoriser si le focus est dans un champ de saisie */
      if (_estChampSaisie(document.activeElement)) return;
      e.preventDefault();
    }

    /* Imprimer */
    if (ctrl && e.key.toLowerCase() === 'p') {
      e.preventDefault();
    }

    /* F12, Ctrl+Shift+I/J/C (DevTools) */
    if (
      e.key === 'F12' ||
      (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))
    ) {
      e.preventDefault();
    }

    /* Ctrl+S (enregistrer la page) */
    if (ctrl && e.key.toLowerCase() === 's') {
      e.preventDefault();
    }
  });
}

function _estChampSaisie(el) {
  return el && (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.isContentEditable
  );
}

/* ============================================================
   C2-a — Blocage glisser-déposer (drag & drop du texte)
   ============================================================ */

function _bloquerGlisserDeposer(conteneur) {
  conteneur.addEventListener('dragstart', e => e.preventDefault());
  conteneur.addEventListener('drop',      e => e.preventDefault());
}

/* ============================================================
   C2-a — Blocage impression CSS
   ============================================================ */

function _bloquerImpression() {
  /* Feuille de style d'impression injectée une seule fois */
  if (document.getElementById('kala-noprint')) return;

  const style = document.createElement('style');
  style.id = 'kala-noprint';
  style.textContent = `
    @media print {
      .reader-content, .reader-main { display: none !important; }
      body::after {
        content: "Ce contenu est protégé par Kalamundi. Impression non autorisée.";
        display: block;
        text-align: center;
        padding: 40px;
        font-size: 18px;
        color: #1B4332;
      }
    }
  `;
  document.head.appendChild(style);

  window.addEventListener('beforeprint', () => {
    document.querySelectorAll('.reader-content').forEach(el => {
      el.setAttribute('data-print-hidden', 'true');
      el.style.visibility = 'hidden';
    });
  });

  window.addEventListener('afterprint', () => {
    document.querySelectorAll('[data-print-hidden]').forEach(el => {
      el.style.visibility = '';
      el.removeAttribute('data-print-hidden');
    });
  });
}

/* ============================================================
   C2-b — Watermark invisible (zero-width characters)
   Encode l'ID utilisateur dans le texte avec des caractères
   de largeur zéro — indétectables visuellement, mais
   récupérables si le texte est copié-collé ailleurs.
   Méthode : ZWJ (U+200D) = 1, ZWNJ (U+200C) = 0
   ============================================================ */

const ZWJ  = '‍'; // bit 1
const ZWNJ = '‌'; // bit 0
const ZWS  = '​'; // séparateur de groupe

function _encoderUserId(userId) {
  /* On prend les 16 premiers caractères de l'UUID */
  const id = (userId || 'anonymous').replace(/-/g, '').slice(0, 16);
  return id.split('').map(char => {
    const code = char.charCodeAt(0).toString(2).padStart(8, '0');
    return code.split('').map(b => b === '1' ? ZWJ : ZWNJ).join('') + ZWS;
  }).join('');
}

export function decoderWatermark(texte) {
  /* Utilitaire pour retrouver l'ID depuis un texte leaké */
  const bits = texte.split('').filter(c => c === ZWJ || c === ZWNJ);
  if (!bits.length) return null;

  let result = '';
  for (let i = 0; i < bits.length; i += 8) {
    const byte = bits.slice(i, i + 8).map(b => b === ZWJ ? '1' : '0').join('');
    if (byte.length < 8) break;
    result += String.fromCharCode(parseInt(byte, 2));
  }
  return result || null;
}

function _injecterWatermark(conteneur, userId) {
  const signature = _encoderUserId(userId);

  /* On insère la signature après le 1er paragraphe de chaque bloc de 3 */
  const paragraphes = conteneur.querySelectorAll('p');
  paragraphes.forEach((p, i) => {
    if (i % 3 === 0) {
      const node = document.createTextNode(signature);
      p.appendChild(node);
    }
  });
}

/* ============================================================
   Exposer decoderWatermark globalement pour les admins
   (accessible depuis la console Kalamundi admin uniquement)
   ============================================================ */

if (typeof window !== 'undefined') {
  window.__kalaDecoder = decoderWatermark;
}
