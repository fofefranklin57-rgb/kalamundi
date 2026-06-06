/* ============================================================
   theme.js — Gestion des thèmes clair / sombre / sépia
   Kalamundi — La Plume du Monde
   Import dans chaque page : import { initTheme } from './theme.js'
   ============================================================ */

const CLE_STORAGE = 'kala_theme';
const THEMES = [
  { id: 'light', label: '☀️',  title: 'Thème clair'  },
  { id: 'dark',  label: '🌙', title: 'Thème sombre' },
  { id: 'sepia', label: '📜', title: 'Thème sépia'  },
];

/* ============================================================
   Appliquer un thème sur <body>
   ============================================================ */

function appliquerTheme(id) {
  document.body.classList.remove('theme-dark', 'theme-sepia');
  if (id === 'dark')  document.body.classList.add('theme-dark');
  if (id === 'sepia') document.body.classList.add('theme-sepia');

  /* Mettre à jour la meta theme-color (barre navigateur mobile) */
  const couleurs = { light: '#1B4332', dark: '#0D1B12', sepia: '#8B6914' };
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', couleurs[id] || couleurs.light);

  /* Marquer le bouton actif dans tous les sélecteurs de la page */
  document.querySelectorAll('.theme-switcher__btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.theme === id);
    btn.setAttribute('aria-pressed', btn.dataset.theme === id);
  });
}

/* ============================================================
   Lire le thème sauvegardé (sans flash FOUC)
   Appeler ce script le plus tôt possible dans le <head>
   ============================================================ */

export function lireTheme() {
  try {
    const saved = localStorage.getItem(CLE_STORAGE);
    return saved || 'light';
  } catch {
    return 'light';
  }
}

/* ============================================================
   Init — à appeler au DOMContentLoaded
   ============================================================ */

export function initTheme() {
  const theme = lireTheme();
  appliquerTheme(theme);
}

/* ============================================================
   Changer de thème + sauvegarder
   ============================================================ */

export function setTheme(id) {
  if (!THEMES.find(t => t.id === id)) return;
  try { localStorage.setItem(CLE_STORAGE, id); } catch {}
  appliquerTheme(id);
}

/* ============================================================
   Rendre le bouton sélecteur dans un conteneur donné
   ============================================================ */

export function rendreThemeSwitcher(conteneur) {
  if (!conteneur) return;

  const actuel = lireTheme();

  const wrapper = document.createElement('div');
  wrapper.className = 'theme-switcher';
  wrapper.setAttribute('role', 'group');
  wrapper.setAttribute('aria-label', 'Choisir le thème');

  wrapper.innerHTML = THEMES.map(t => `
    <button
      class="theme-switcher__btn ${t.id === actuel ? 'is-active' : ''}"
      data-theme="${t.id}"
      title="${t.label} ${t.title}"
      aria-label="${t.title}"
      aria-pressed="${t.id === actuel}">
      ${t.label}
    </button>
  `).join('');

  wrapper.querySelectorAll('.theme-switcher__btn').forEach(btn => {
    btn.addEventListener('click', () => setTheme(btn.dataset.theme));
  });

  conteneur.appendChild(wrapper);
}

/* ============================================================
   Anti-FOUC — injecter inline dans <head> de chaque page
   (copier-coller ce snippet dans un <script> avant le </head>)

   <script>
     (function(){
       var t = localStorage.getItem('kala_theme') || 'light';
       if (t === 'dark')  document.documentElement.classList.add('theme-dark-pre');
       if (t === 'sepia') document.documentElement.classList.add('theme-sepia-pre');
     })();
   </script>
   ============================================================ */
