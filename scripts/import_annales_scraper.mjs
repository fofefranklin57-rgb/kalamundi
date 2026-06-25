#!/usr/bin/env node
/* ============================================================
   import_annales_scraper.mjs — Mise à jour des URLs d'annales
   Stratégie : scraper les sources publiques → stocker l'URL
   directement dans la table annales (pas de re-hébergement).

   Usage :
     node scripts/import_annales_scraper.mjs
   Avec SUPABASE_SERVICE_KEY déjà défini dans l'environnement.
   ============================================================ */

import { createClient }  from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import path              from 'path'

const SUPABASE_URL = 'https://iobieffnaauecyukecds.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY manquant')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const DELAI    = 1200
const pause    = ms => new Promise(r => setTimeout(r, ms))

let cptOk = 0, cptSkip = 0, cptErr = 0

/* ── Fetch avec timeout ─────────────────────────────────────── */
async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

/* ── Mettre à jour l'URL d'une annale en base ───────────────── */
async function mettreAJourURL(meta, fichierUrl) {
  // Chercher le record existant
  let query = supabase.from('annales')
    .select('id, fichier_url')
    .eq('examen',  meta.examen)
    .eq('matiere', meta.matiere)
    .eq('annee',   meta.annee)
    .eq('session', meta.session || 'principale')

  if (meta.serie) query = query.eq('serie', meta.serie)
  else            query = query.is('serie', null)

  const { data: existant } = await query.maybeSingle()

  if (existant?.fichier_url) {
    cptSkip++
    return  // Déjà une URL
  }

  if (existant) {
    // Mettre à jour l'URL
    const { error } = await supabase.from('annales')
      .update({ fichier_url: fichierUrl })
      .eq('id', existant.id)
    if (error) throw new Error(error.message)
    console.log(`  ✅ ${meta.examen} ${meta.serie||''} ${meta.matiere} ${meta.annee} → URL ajoutée`)
    cptOk++
  } else {
    // Insérer un nouveau record
    const { error } = await supabase.from('annales').insert({
      examen:      meta.examen,
      serie:       meta.serie || null,
      matiere:     meta.matiere,
      annee:       meta.annee,
      session:     meta.session || 'principale',
      pays:        meta.pays || 'Cameroun',
      fichier_url: fichierUrl,
      description: meta.description || null,
      visible:     true,
    })
    if (error && error.code !== '23505') throw new Error(error.message)
    console.log(`  ✅ ${meta.examen} ${meta.serie||''} ${meta.matiere} ${meta.annee} → inséré`)
    cptOk++
  }
}

/* ============================================================
   SOURCE 1 : sigmaths.net — Mathématiques BAC Cameroun
   URL du lecteur : https://www.sigmaths.net/Reader.php?var=...
   ============================================================ */

async function importSigmaths() {
  console.log('\n📐 sigmaths.net — Mathématiques (séries C, D, A, F…)\n')

  let html
  try {
    html = await fetchHtml('https://www.sigmaths.net/bac2/Cameroun.php')
  } catch (e) {
    console.error(`  ❌ Impossible d'accéder à sigmaths.net: ${e.message}`)
    return
  }

  // Extraire tous les liens Reader (ils contiennent le nom de fichier)
  const regex  = /Reader\.php\?var=(bac2ax0by99byCamerounax0by99by[^"&\s]+\.pdf)/gi
  const liens  = new Map() // nomFichier → URL complète

  let m
  while ((m = regex.exec(html)) !== null) {
    const encoded    = m[1]
    const nomFichier = encoded.replace('bac2ax0by99byCamerounax0by99by', '')
    const urlLecteur = `https://www.sigmaths.net/Reader.php?var=${encoded}`
    liens.set(nomFichier, urlLecteur)
  }

  console.log(`  ${liens.size} fichiers détectés\n`)

  for (const [nomFichier, urlLecteur] of liens) {
    const meta = parserSigmaths(nomFichier)
    if (!meta) { cptSkip++; continue }

    try {
      await mettreAJourURL(meta, urlLecteur)
    } catch (e) {
      console.error(`  ❌ ${nomFichier}: ${e.message}`)
      cptErr++
    }
    await pause(200) // pas de téléchargement = pause courte
  }
}

function parserSigmaths(nom) {
  // Format moderne : 2023_Serie_C_SujetCorrection.pdf
  // Format ancien  : bacc1999cmr.pdf
  const anneeM = nom.match(/(\d{4})/)
  if (!anneeM) return null
  const annee = parseInt(anneeM[1])
  if (annee < 1984 || annee > 2030) return null

  const estProba  = /Probatoire/i.test(nom)
  const estRatt   = /Rattrapage|Ratt/i.test(nom)
  const examen    = estProba ? 'Probatoire' : 'BAC'
  const session   = estRatt  ? 'rattrapage' : 'principale'

  // Série — plusieurs formats
  let serie = null
  const serieM1 = nom.match(/Serie[s]?[_-]([A-Z][0-9]?)/i)   // Serie_C, Series_CE
  const serieM2 = nom.match(/_([A-Z][0-9]?)(?:_|\.pdf)/i)     // _C_, _D_
  if (serieM1)      serie = serieM1[1].replace(/E$/,'').toUpperCase() // CE → C
  else if (serieM2) serie = serieM2[1].toUpperCase()

  const avecCorr = /SujetCorrection|Correction|Corrig/i.test(nom)
  const description = avecCorr ? 'Sujet + Corrigé (sigmaths.net)' : 'Sujet uniquement (sigmaths.net)'

  return { examen, serie, matiere: 'Mathématiques', annee, session, description }
}

/* ============================================================
   SOURCE 2 : fomesoutra.com — Toutes matières séries A, B, C, D
   ============================================================ */

const FOMESOUTRA_SERIES = [
  { path: 'sujets-de-terminale-c', serie: 'C' },
  { path: 'sujets-de-terminale-d', serie: 'D' },
  { path: 'sujets-de-terminale-a', serie: 'A' },
]

async function importFomesoutra() {
  console.log('\n📖 fomesoutra.com — Sujets BAC séries A, C, D\n')

  for (const { path: p, serie } of FOMESOUTRA_SERIES) {
    await pause(DELAI)
    const url = `https://www.fomesoutra.com/bac/${p}`
    console.log(`  📂 Série ${serie} — ${url}`)

    let html
    try {
      html = await fetchHtml(url)
    } catch (e) {
      console.error(`  ❌ ${e.message}`)
      continue
    }

    // Extraire les liens vers des PDFs ou pages d'épreuve
    const regexPdf = /href="([^"]+\.pdf)"/gi
    const regexPage = /href="([^"]+\/(?:bac|probatoire|bepc)[^"]*\d{4}[^"]*)"/gi

    let match
    const pdfs = new Set()

    while ((match = regexPdf.exec(html)) !== null) {
      const u = match[1].startsWith('http') ? match[1] : `https://www.fomesoutra.com${match[1]}`
      pdfs.add(u)
    }

    for (const pdfUrl of pdfs) {
      const nomF = decodeURIComponent(path.basename(pdfUrl))
      const meta = parserFomesoutra(nomF, pdfUrl, serie)
      if (!meta) { cptSkip++; continue }
      try {
        await mettreAJourURL(meta, pdfUrl)
      } catch (e) {
        cptErr++
      }
    }
  }
}

function parserFomesoutra(nom, url, serie) {
  const tout  = (nom + ' ' + url).toLowerCase()
  const anneeM = tout.match(/(\d{4})/)
  if (!anneeM) return null
  const annee = parseInt(anneeM[1])
  if (annee < 1990 || annee > 2030) return null

  const examen  = /probatoire/i.test(tout) ? 'Probatoire' : /bepc/i.test(tout) ? 'BEPC' : 'BAC'
  const session = /rattrapage/i.test(tout) ? 'rattrapage' : 'principale'

  const TABLE = [
    [/math/i,         'Mathématiques'],
    [/phys/i,         'Physique-Chimie'],
    [/svt|biol/i,     'SVT'],
    [/chim/i,         'Chimie'],
    [/franc/i,        'Français'],
    [/philo/i,        'Philosophie'],
    [/angl/i,         'Anglais'],
    [/hist|geo/i,     'Histoire-Géographie'],
    [/econ/i,         'Économie'],
    [/compt/i,        'Comptabilité'],
  ]
  let matiere = null
  for (const [r, l] of TABLE) { if (r.test(tout)) { matiere = l; break } }
  if (!matiere) return null

  return { examen, serie, matiere, annee, session, description: `Fomesoutra.com` }
}

/* ============================================================
   SOURCE 3 : epreuvesetcorriges.com — multi-examens
   ============================================================ */

async function importEpreuvesEtCorriges() {
  console.log('\n🗂️  epreuvesetcorriges.com — BAC, BEPC, Probatoire\n')

  // Pages de listing connues
  const pages = [
    { url: 'https://epreuvesetcorriges.com/categories/cameroun/examens/bac',       examen: 'BAC' },
    { url: 'https://epreuvesetcorriges.com/categories/cameroun/examens/probatoire', examen: 'Probatoire' },
    { url: 'https://epreuvesetcorriges.com/categories/cameroun/examens/bepc',       examen: 'BEPC' },
  ]

  for (const { url, examen } of pages) {
    await pause(DELAI)
    let html
    try {
      html = await fetchHtml(url)
    } catch (e) {
      console.warn(`  ⚠️ ${examen}: ${e.message}`)
      continue
    }

    // Extraire les liens vers des ressources
    const regex = /href="(https?:\/\/epreuvesetcorriges\.com\/[^"]+)"/gi
    let m
    const liens = new Set()
    while ((m = regex.exec(html)) !== null) {
      if (/\.(pdf|doc)/.test(m[1]) || /telecharger|download/i.test(m[1])) {
        liens.add(m[1])
      }
    }

    console.log(`  ${examen}: ${liens.size} liens trouvés`)

    for (const lien of liens) {
      const meta = parserEpreuvesEtCorriges(lien, examen)
      if (!meta) { cptSkip++; continue }
      try {
        await mettreAJourURL(meta, lien)
      } catch (e) { cptErr++ }
    }
  }
}

function parserEpreuvesEtCorriges(url, examen) {
  const tout   = url.toLowerCase()
  const anneeM = tout.match(/(\d{4})/)
  if (!anneeM) return null
  const annee = parseInt(anneeM[1])
  if (annee < 1990 || annee > 2030) return null

  const serieM = tout.match(/serie[_-]?([a-g][0-9]?)/i)
  const serie  = serieM ? serieM[1].toUpperCase() : null

  const TABLE = [
    [/math/i,'Mathématiques'],[/physiq/i,'Physique-Chimie'],[/svt|biol/i,'SVT'],
    [/franc/i,'Français'],[/philo/i,'Philosophie'],[/angl/i,'Anglais'],
    [/hist|geo/i,'Histoire-Géographie'],[/econ/i,'Économie'],[/compt/i,'Comptabilité'],
  ]
  let matiere = null
  for (const [r,l] of TABLE) { if (r.test(tout)) { matiere = l; break } }
  if (!matiere) return null

  return { examen, serie, matiere, annee, session: /rattrapage/i.test(tout) ? 'rattrapage' : 'principale' }
}

/* ============================================================
   SOURCE 4 : cameroongcerevision.com — GCE anglophone
   ============================================================ */

async function importGCE() {
  console.log('\n🇬🇧 cameroongcerevision.com — GCE O-Level / A-Level\n')

  const pages = [
    { url: 'https://cameroongcerevision.com/o-level/', examen: 'GCE O-Level' },
    { url: 'https://cameroongcerevision.com/a-level/', examen: 'GCE A-Level' },
  ]

  for (const { url, examen } of pages) {
    await pause(DELAI)
    let html
    try { html = await fetchHtml(url) }
    catch (e) { console.warn(`  ⚠️ ${examen}: ${e.message}`); continue }

    const regex = /href="(https?:\/\/[^"]+\.pdf)"/gi
    let m
    while ((m = regex.exec(html)) !== null) {
      const pdfUrl = m[1]
      const nomF   = decodeURIComponent(path.basename(pdfUrl))
      const meta   = parserGCE(nomF, pdfUrl, examen)
      if (!meta) { cptSkip++; continue }
      try {
        await mettreAJourURL(meta, pdfUrl)
      } catch { cptErr++ }
    }
  }
}

function parserGCE(nom, url, examen) {
  const tout   = (nom + ' ' + url).toLowerCase()
  const anneeM = tout.match(/(\d{4})/)
  const annee  = anneeM ? parseInt(anneeM[1]) : 2020
  if (annee < 1990 || annee > 2030) return null

  const TABLE = [
    [/math/i,'Mathematics'],[/physics/i,'Physics'],[/chemist/i,'Chemistry'],
    [/biol/i,'Biology'],[/english/i,'English Language'],[/french/i,'French'],
    [/geograph/i,'Geography'],[/history/i,'History'],[/economics/i,'Economics'],
    [/computer/i,'Computer Science'],[/account/i,'Accounting'],
  ]
  let matiere = null
  for (const [r,l] of TABLE) { if (r.test(tout)) { matiere = l; break } }
  if (!matiere) return null

  return { examen, serie: null, matiere, annee, session: 'principale', pays: 'Cameroun' }
}

/* ============================================================
   MAIN
   ============================================================ */
async function main() {
  console.log('╔════════════════════════════════════════════╗')
  console.log('║  🎓 Import URLs Annales — Kalamundi         ║')
  console.log('╚════════════════════════════════════════════╝')
  console.log(`\n  Stratégie : lier aux sources publiques (pas de re-hébergement)`)
  console.log(`  Supabase  : ${SUPABASE_URL}\n`)

  await importSigmaths()
  await importFomesoutra()
  await importEpreuvesEtCorriges()
  await importGCE()

  console.log('\n╔════════════════════════════════════════════╗')
  console.log(`║  ✅ ${cptOk} URLs ajoutées`)
  console.log(`║  ⏭  ${cptSkip} ignorés`)
  console.log(`║  ❌ ${cptErr} erreurs`)
  console.log('╚════════════════════════════════════════════╝')
  console.log('\n📌 Les annales avec une URL sont maintenant téléchargeables.')
  console.log('   Ajoute les corrigés manuellement dans le dashboard admin.\n')
}

main().catch(e => { console.error('\n💥', e.message); process.exit(1) })
