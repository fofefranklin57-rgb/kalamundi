/* ============================================================
   cover-utils.js — Affichage robuste des couvertures Kalamundi
   ============================================================ */

import { genererCouverture } from './cover-generator.js';

export function echapperAttr(valeur = '') {
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function normaliserUrlImage(url = '') {
  let propre = String(url || '').trim();
  if (!propre) return '';
  if (propre.startsWith('//')) propre = `https:${propre}`;
  if (propre.startsWith('http://')) propre = propre.replace(/^http:\/\//i, 'https://');
  return propre.replace(/\s/g, '%20');
}

export function genererCouvertureOeuvre(oeuvre = {}, largeur = 300, hauteur = 420) {
  const auteur = oeuvre.profiles?.nom || oeuvre.auteur || oeuvre.nom_auteur || '';
  return genererCouverture(
    oeuvre.titre || 'Sans titre',
    auteur,
    (oeuvre.genre || '').toLowerCase(),
    largeur,
    hauteur
  );
}

