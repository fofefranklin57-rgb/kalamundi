/* ============================================================
   translate.js — Module de traduction
   Kalamundi — La Plume du Monde
   Règle : clé API Google Translate JAMAIS côté client
           → tout passe par l'Edge Function Supabase
   ============================================================ */

import { api } from './api.js';

const SUPABASE_URL  = 'https://iobieffnaauecyukecds.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvYmllZmZuYWF1ZWN5dWtlY2RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NDIzNTEsImV4cCI6MjA5NjMxODM1MX0.w1_Zv9VeVvoLlt1H0d7wN8To-A5DAxSfszV0kJ_5NRE';

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

export async function traduire(chapitreId, contenu, langueCible) {
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

  /* 3. Edge Function Supabase → Google Translate */
  const traduit = await _appelEdgeFunction(contenu, langueCible);

  /* Sauvegarder en base + cache mémoire */
  await api.saveTraduction(chapitreId, langueCible, traduit).catch(() => {});
  _cacheMemoire.set(cleCache, traduit);

  return traduit;
}

/* ============================================================
   Appel à l'Edge Function Supabase
   ============================================================ */

async function _appelEdgeFunction(texte, langueCible) {
  const reponse = await fetch(`${SUPABASE_URL}/functions/v1/traduire`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON}`,
    },
    body: JSON.stringify({ texte, langue_cible: langueCible }),
  });

  if (!reponse.ok) {
    const err = await reponse.text().catch(() => '');
    throw new Error(`Edge Function erreur ${reponse.status}: ${err}`);
  }

  const json = await reponse.json();
  if (!json.traduit) throw new Error('Réponse Edge Function invalide');
  return json.traduit;
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
