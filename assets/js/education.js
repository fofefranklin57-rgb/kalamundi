/* ============================================================
   education.js — Hub Éducation Kalamundi
   Gestion des onglets avec iframes lazy-loaded
   ============================================================ */

/* ── Mapping onglets ────────────────────────────────────────── */
const ONGLETS = ['annales', 'simulateur', 'repetiteur', 'ecole']

/* ── Init navbar hub ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar()
  initOnglets()
  initDepuisHash()
})

function initNavbar() {
  const toggle = document.getElementById('nav-toggle')
  const menu   = document.getElementById('nav-menu')
  toggle?.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open')
    toggle.setAttribute('aria-expanded', open)
  })

  // Navbar actions
  const actions = document.getElementById('navbar-actions')
  if (!actions) return
  import('./auth.js').then(({ getUser }) => {
    getUser().then(u => {
      actions.innerHTML = u
        ? `<a href="/pages/author-dashboard.html" class="btn btn--ghost btn--sm">Mon espace</a>`
        : `<a href="/pages/login.html" class="btn btn--ghost btn--sm">Connexion</a>
           <a href="/pages/login.html?mode=inscription" class="btn btn--accent btn--sm">S'inscrire</a>`
    })
  }).catch(() => {})
}

/* ── Gestion des onglets ────────────────────────────────────── */

function initOnglets() {
  document.querySelectorAll('.edu-tab[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => activerOnglet(btn.dataset.tab))
  })
}

function activerOnglet(tab) {
  if (!ONGLETS.includes(tab)) return

  // UI : activer le bon onglet
  document.querySelectorAll('.edu-tab').forEach(b =>
    b.classList.toggle('edu-tab--active', b.dataset.tab === tab))
  document.querySelectorAll('.edu-panel').forEach(p =>
    p.classList.remove('edu-panel--active'))
  document.getElementById('panel-' + tab)?.classList.add('edu-panel--active')

  // Mettre à jour le hash sans recharger
  history.replaceState(null, '', '#' + tab)

  // Charger l'iframe si pas encore fait
  chargerIframe(tab)
}

/* ── Chargement lazy des iframes ────────────────────────────── */

const iframesCharges = new Set()

function chargerIframe(tab) {
  if (iframesCharges.has(tab)) return
  iframesCharges.add(tab)

  const iframe = document.getElementById('iframe-' + tab)
  const loader = document.getElementById('loader-' + tab)
  if (!iframe) return

  // Charger la page dans l'iframe
  iframe.src = iframe.dataset.src

  iframe.addEventListener('load', () => {
    try {
      // Masquer navbar, hero et footer de la page embedded
      const doc = iframe.contentDocument
      if (!doc) return

      const selecteurs = [
        '#navbar', '.navbar',
        '.annales-hero', '.sim-hero', '.rep-hero', '.ecole-hero',
        '.edu-hero', 'footer', '.promo-etudiant',
      ]
      selecteurs.forEach(sel => {
        doc.querySelectorAll(sel).forEach(el => { el.style.display = 'none' })
      })

      // Supprimer le padding/margin top du page-wrapper
      doc.querySelectorAll('.page-wrapper, body').forEach(el => {
        el.style.paddingTop = '0'
        el.style.marginTop  = '0'
      })

      // Ajuster la hauteur de l'iframe au contenu
      ajusterHauteur(iframe, doc)

      // Observer les changements de hauteur (chargement asynchrone de contenu)
      const ro = new ResizeObserver(() => ajusterHauteur(iframe, doc))
      if (doc.body) ro.observe(doc.body)

    } catch {}

    // Afficher l'iframe, masquer le loader
    loader && (loader.style.display = 'none')
    iframe.classList.add('loaded')
  }, { once: true })
}

function ajusterHauteur(iframe, doc) {
  try {
    const h = doc.documentElement.scrollHeight || doc.body.scrollHeight
    if (h > 200) iframe.style.minHeight = h + 'px'
  } catch {}
}

/* ── Navigation par hash ─────────────────────────────────────── */

function initDepuisHash() {
  const hash = window.location.hash.replace('#', '')
  const tab  = ONGLETS.includes(hash) ? hash : 'annales'

  // Activer l'onglet initial
  activerOnglet(tab)

  // Écouter les changements de hash (bouton retour/avant)
  window.addEventListener('hashchange', () => {
    const h = window.location.hash.replace('#', '')
    if (ONGLETS.includes(h)) activerOnglet(h)
  })
}
