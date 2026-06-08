/* ============================================================
   cover-generator.js — Génération automatique de couvertures
   Utilisé quand un livre n'a pas de couverture uploadée
   ou quand l'URL de couverture est cassée.
   ============================================================ */

const GENRE_PALETTES = {
  roman:            { bg: '#1B4332', accent: '#52B788', text: '#ffffff' },
  nouvelle:         { bg: '#1B5E20', accent: '#81C784', text: '#ffffff' },
  conte:            { bg: '#BF360C', accent: '#FF8A65', text: '#ffffff' },
  thriller:         { bg: '#1A237E', accent: '#5C6BC0', text: '#ffffff' },
  romance:          { bg: '#880E4F', accent: '#F48FB1', text: '#ffffff' },
  sf_fantasy:       { bg: '#0D47A1', accent: '#42A5F5', text: '#ffffff' },
  poesie:           { bg: '#4A148C', accent: '#CE93D8', text: '#ffffff' },
  litterature_orale:{ bg: '#004D40', accent: '#4DB6AC', text: '#ffffff' },
  essai:            { bg: '#263238', accent: '#90A4AE', text: '#ffffff' },
  autobiographie:   { bg: '#3E2723', accent: '#A1887F', text: '#ffffff' },
  temoignage:       { bg: '#33691E', accent: '#AED581', text: '#ffffff' },
  philosophie:      { bg: '#1A237E', accent: '#7986CB', text: '#ffffff' },
  histoire:         { bg: '#4E342E', accent: '#A1887F', text: '#ffffff' },
  jeunesse:         { bg: '#1B5E20', accent: '#69F0AE', text: '#ffffff' },
};

const DEFAULT_PALETTE = { bg: '#1B4332', accent: '#52B788', text: '#ffffff' };

const GENRE_EMOJIS = {
  roman: '📗', nouvelle: '📘', conte: '📙', thriller: '🔴',
  romance: '💗', sf_fantasy: '🚀', poesie: '✍️', litterature_orale: '🎭',
  essai: '📝', autobiographie: '👤', temoignage: '✍️',
  philosophie: '🧠', histoire: '🏛️', jeunesse: '🌟',
};

/**
 * Génère une couverture de livre sur canvas.
 * @param {string} titre
 * @param {string} auteur
 * @param {string} genre  — clé genre (ex: 'roman')
 * @param {number} w      — largeur px (défaut 300)
 * @param {number} h      — hauteur px (défaut 420)
 * @returns {string} data URL JPEG
 */
export function genererCouverture(titre = 'Sans titre', auteur = '', genre = '', w = 300, h = 420) {
  const pal   = GENRE_PALETTES[genre?.toLowerCase()] || DEFAULT_PALETTE;
  const emoji = GENRE_EMOJIS[genre?.toLowerCase()] || '📖';

  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  /* ── Fond dégradé ──────────────────────────────────────── */
  const grad = ctx.createLinearGradient(0, 0, w * 0.6, h);
  grad.addColorStop(0, pal.bg);
  grad.addColorStop(1, _darken(pal.bg, 45));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  /* ── Motif décoratif (cercles flous) ───────────────────── */
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = pal.accent;
  ctx.beginPath(); ctx.arc(w * 0.85, h * 0.15, h * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.1,  h * 0.75, h * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  /* ── Bandeau accent en bas ─────────────────────────────── */
  ctx.fillStyle = pal.accent;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(0, h - 80, w, 80);
  ctx.globalAlpha = 1;

  /* ── Bordure fine ──────────────────────────────────────── */
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  /* ── Emoji genre (grand, centré en haut) ───────────────── */
  ctx.font = `${Math.round(w * 0.22)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.25;
  ctx.fillText(emoji, w / 2, h * 0.28);
  ctx.globalAlpha = 1;

  /* ── Ligne décorative accent ────────────────────────────── */
  ctx.fillStyle = pal.accent;
  ctx.fillRect(w * 0.15, h * 0.44, w * 0.7, 3);

  /* ── Titre ─────────────────────────────────────────────── */
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';
  const titreLines = _splitText(ctx, titre.toUpperCase(), w - 40, `bold ${Math.round(w * 0.082)}px Georgia, serif`);
  const titreStartY = h * 0.52;
  const titreLineH  = Math.round(w * 0.095);
  titreLines.forEach((line, i) => {
    ctx.font = `bold ${Math.round(w * 0.082)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillText(line, w / 2, titreStartY + i * titreLineH);
  });

  /* ── Auteur ─────────────────────────────────────────────── */
  if (auteur) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `${Math.round(w * 0.052)}px Georgia, serif`;
    ctx.textAlign = 'center';
    const auteurY = h - 48;
    ctx.fillText(_truncate(auteur, 28), w / 2, auteurY);
  }

  /* ── Watermark Kalamundi ────────────────────────────────── */
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = `bold ${Math.round(w * 0.036)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('KALAMUNDI', w / 2, h - 20);

  return canvas.toDataURL('image/jpeg', 0.88);
}

/* ── Utilitaires internes ─────────────────────────────────── */

function _darken(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function _splitText(ctx, text, maxWidth, font) {
  ctx.font = font;
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4); // max 4 lignes
}

function _truncate(str, maxLen) {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}
