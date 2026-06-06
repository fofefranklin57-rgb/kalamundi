/* ============================================================
   translate.js — Module de traduction
   Kalamundi — La Plume du Monde
   Règle : clé API Google Translate JAMAIS côté client
           → tout passe par l'Edge Function Supabase
   ============================================================ */

import { api } from './api.js';

/* MyMemory API — gratuit, pas de clé requise
   Quota : 10 000 mots/jour (inscription email gratuite)
   Avec cache Supabase : chaque chapitre traduit une seule fois */
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const MYMEMORY_EMAIL = ''; /* optionnel — ajouter un email pour 10k mots/jour au lieu de 1k */

/* Langues disponibles dans le lecteur — triées alpha nom natif */
export const LANGUES_LECTURE = [
  { code: 'original', nom: 'Langue originale', drapeau: '📖' },
  { code: 'de',  nom: 'Deutsch',    drapeau: '🇩🇪' },
  { code: 'en',  nom: 'English',    drapeau: '🇬🇧' },
  { code: 'es',  nom: 'Español',    drapeau: '🇪🇸' },
  { code: 'fr',  nom: 'Français',   drapeau: '🇫🇷' },
  { code: 'hi',  nom: 'हिन्दी',      drapeau: '🇮🇳' },
  { code: 'ja',  nom: '日本語',      drapeau: '🇯🇵' },
  { code: 'ko',  nom: '한국어',      drapeau: '🇰🇷' },
  { code: 'pt',  nom: 'Português',  drapeau: '🇧🇷' },
  { code: 'sw',  nom: 'Kiswahili',  drapeau: '🌍'  },
  { code: 'ar',  nom: 'العربية',    drapeau: '🇸🇦' },
  { code: 'zh',  nom: '中文',       drapeau: '🇨🇳' },
];

/* ============================================================
   Cache mémoire (session courante)
   Évite de re-appeler l'API si on revient sur un chapitre déjà traduit
   ============================================================ */

const _cacheMemoire = new Map(); // clé : "chapitreId_langue"

/* ============================================================
   Traduire un chapitre
   Ordre : cache mémoire → cache Supabase → Edge Function
   ============================================================ */

export async function traduire(chapitreId, contenu, langueCible, langueSource = 'fr') {
  if (langueCible === 'original') return contenu;

  const cleCache = `${chapitreId}_${langueCible}`;

  /* 1. Cache mémoire (instantané) */
  if (_cacheMemoire.has(cleCache)) {
    return _cacheMemoire.get(cleCache);
  }

  /* 2. Cache Supabase (persistant entre sessions) */
  const cached = await api.getTraduction(chapitreId, langueCible);
  if (cached?.contenu_traduit) {
    _cacheMemoire.set(cleCache, cached.contenu_traduit);
    return cached.contenu_traduit;
  }

  /* 3. MyMemory API */
  const traduit = await _appelEdgeFunction(contenu, langueCible, langueSource);

  /* Sauvegarder en base + cache mémoire */
  await api.saveTraduction(chapitreId, langueCible, traduit).catch(() => {});
  _cacheMemoire.set(cleCache, traduit);

  return traduit;
}

/* ============================================================
   Appel MyMemory API
   Les textes longs sont découpés en segments de 500 chars max
   (limite MyMemory par requête)
   ============================================================ */

async function _appelEdgeFunction(texte, langueCible, langueSource = 'fr') {
  // Supprimer l'en-tête Project Gutenberg (en anglais) si présent
  const contenuNet = _supprimerEnTeteGutenberg(texte);
  const segments = _decouper(contenuNet, 480); // 480 chars — limite MyMemory 500
  const traduits = [];
  for (const s of segments) {
    try {
      traduits.push(await _traduireSegment(s, langueSource, langueCible));
    } catch (e) {
      // En cas d'erreur sur un segment, garder le texte original
      traduits.push(s);
    }
    if (segments.length > 1) await new Promise(r => setTimeout(r, 200));
  }
  return traduits.join(' ');
}

async function _traduireSegment(segment, langueSource, langueCible) {
  const params = new URLSearchParams({
    q:        segment,
    langpair: `${langueSource}|${langueCible}`,
  });
  if (MYMEMORY_EMAIL) params.set('de', MYMEMORY_EMAIL);

  const reponse = await fetch(`${MYMEMORY_URL}?${params}`);
  if (!reponse.ok) throw new Error(`MyMemory HTTP ${reponse.status}`);

  const json = await reponse.json();

  if (json.responseStatus === 429) {
    throw new Error('Quota journalier atteint.');
  }
  if (json.responseStatus !== 200 || !json.responseData?.translatedText) {
    throw new Error(`MyMemory: ${json.responseStatus} — ${json.responseDetails || '?'}`);
  }

  return json.responseData.translatedText;
}

/* Supprime le préambule Project Gutenberg (toujours en anglais)
   pour éviter de "traduire" de l'anglais comme du français */
function _supprimerEnTeteGutenberg(texte) {
  // Les textes Gutenberg finissent leur en-tête par "*** START OF..."
  const marqueur = /\*{3}\s*START OF (THIS |THE )?PROJECT GUTENBERG/i;
  const match = texte.search(marqueur);
  if (match !== -1) {
    // Sauter jusqu'à la fin de la ligne du marqueur
    const apres = texte.indexOf('\n', match);
    return apres !== -1 ? texte.slice(apres + 1).trim() : texte;
  }
  return texte;
}

function _decouper(texte, maxLen) {
  if (texte.length <= maxLen) return [texte];

  const segments = [];
  const phrases  = texte.split(/(?<=[.!?])\s+/); // coupe après ponctuation
  let courant    = '';

  for (const phrase of phrases) {
    if ((courant + ' ' + phrase).trim().length <= maxLen) {
      courant = (courant + ' ' + phrase).trim();
    } else {
      if (courant) segments.push(courant);
      /* phrase seule trop longue → découpage brutal */
      if (phrase.length > maxLen) {
        for (let i = 0; i < phrase.length; i += maxLen) {
          segments.push(phrase.slice(i, i + maxLen));
        }
        courant = '';
      } else {
        courant = phrase;
      }
    }
  }
  if (courant) segments.push(courant);
  return segments;
}

/* ============================================================
   Vider le cache mémoire (ex: changement d'œuvre)
   ============================================================ */

export function viderCacheTraduction() {
  _cacheMemoire.clear();
}

/* ============================================================
   Rendre le panneau langue dans le lecteur
   Remplace le HTML statique de reader.html
   ============================================================ */

export function rendreOptionLangues(conteneur, langueActive, onSelect) {
  if (!conteneur) return;

  conteneur.innerHTML = LANGUES_LECTURE.map(l => `
    <div class="lang-option ${l.code === langueActive ? 'is-active' : ''}"
         data-lang="${l.code}"
         role="option"
         aria-selected="${l.code === langueActive}">
      <span>${l.drapeau} ${l.nom}</span>
      ${l.code === 'original' ? '' : '<span class="lang-option__badge">Auto</span>'}
    </div>
  `).join('');

  conteneur.querySelectorAll('.lang-option').forEach(el => {
    el.addEventListener('click', () => {
      const code = el.dataset.lang;
      conteneur.querySelectorAll('.lang-option').forEach(o => {
        o.classList.remove('is-active');
        o.setAttribute('aria-selected', 'false');
      });
      el.classList.add('is-active');
      el.setAttribute('aria-selected', 'true');
      onSelect(code);
    });
  });
}
