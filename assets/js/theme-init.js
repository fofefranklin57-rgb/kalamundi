/* ============================================================
   theme-init.js — Auto-init thème sur toutes les pages
   Inclure via <script type="module" src="/assets/js/theme-init.js">
   dans chaque page HTML, APRÈS le script principal.
   Cherche #theme-slot dans le DOM et y injecte le switcher.
   ============================================================ */

import { initTheme, rendreThemeSwitcher } from './theme.js';

initTheme();

const slot = document.getElementById('theme-slot');
if (slot) rendreThemeSwitcher(slot);
