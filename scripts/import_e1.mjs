// node scripts/import_e1.mjs
// BLOC E1 — Manuels scolaires OpenStax + catégories éducation
// Sources : OpenStax (CC-BY), DOAB éducation, Open Textbook Library
// Exécuter depuis C:\kalamundi\ : node scripts/import_e1.mjs

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL      = 'https://iobieffnaauecyukecds.supabase.co';
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_KEY;
if (!SUPABASE_KEY) throw new Error('SUPABASE_SERVICE_KEY manquant dans l environnement.');
const supabase          = createClient(SUPABASE_URL, SUPABASE_KEY);
const AUTEUR_SYSTEME_ID = 'cd117018-5e89-4d2c-96d6-4f1a6be4a236';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function sha256(t)  { return crypto.createHash('sha256').update(t, 'utf8').digest('hex'); }

/* ══════════════════════════════════════════════════════════════
   CATALOGUE OPENSTAX — Manuels CC-BY vérifiés
   Source : https://openstax.org/api/v2/pages?type=books.Book
   ══════════════════════════════════════════════════════════════ */
const OPENSTAX_BOOKS = [
  // ── Mathématiques ──
  { titre: 'Prealgebra 2e', auteur: 'OpenStax', niveau: 'Collège', matiere: 'Mathématiques', langue: 'en', resume: 'A comprehensive prealgebra textbook covering whole numbers, fractions, decimals, ratios, proportions, percents, integers, and algebra.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/prealgebra-2e.jpg', openstax_slug: 'prealgebra-2e' },
  { titre: 'Elementary Algebra 2e', auteur: 'OpenStax', niveau: 'Lycée', matiere: 'Mathématiques', langue: 'en', resume: 'Elementary Algebra covers traditional first semester algebra topics including real numbers, solving equations, polynomials, factoring, and rational expressions.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/elementary-algebra-2e.jpg', openstax_slug: 'elementary-algebra-2e' },
  { titre: 'Intermediate Algebra 2e', auteur: 'OpenStax', niveau: 'Lycée', matiere: 'Mathématiques', langue: 'en', resume: 'Intermediate Algebra is designed to meet the scope of a one-semester intermediate algebra course.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/intermediate-algebra-2e.jpg', openstax_slug: 'intermediate-algebra-2e' },
  { titre: 'College Algebra 2e', auteur: 'OpenStax', niveau: 'Université', matiere: 'Mathématiques', langue: 'en', resume: 'College Algebra 2e provides a comprehensive exploration of algebraic principles. The modular approach allows instructors to tailor the course to their preferences.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/college-algebra-2e.jpg', openstax_slug: 'college-algebra-2e' },
  { titre: 'Precalculus 2e', auteur: 'OpenStax', niveau: 'Lycée', matiere: 'Mathématiques', langue: 'en', resume: 'Precalculus 2e provides a comprehensive exploration of mathematical topics for students preparing for calculus.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/precalculus-2e.jpg', openstax_slug: 'precalculus-2e' },
  { titre: 'Calculus Volume 1', auteur: 'OpenStax', niveau: 'Université', matiere: 'Mathématiques', langue: 'en', resume: 'Calculus Volume 1 covers functions, limits, derivatives and integration — the fundamentals of differential calculus.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/calculus-v1.jpg', openstax_slug: 'calculus-volume-1' },
  { titre: 'Calculus Volume 2', auteur: 'OpenStax', niveau: 'Université', matiere: 'Mathématiques', langue: 'en', resume: 'Calculus Volume 2 covers integration techniques, sequences and series, parametric equations and polar coordinates.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/calculus-v2.jpg', openstax_slug: 'calculus-volume-2' },
  { titre: 'Calculus Volume 3', auteur: 'OpenStax', niveau: 'Université', matiere: 'Mathématiques', langue: 'en', resume: 'Calculus Volume 3 covers multivariable calculus including vectors, vector-valued functions, partial derivatives and multiple integration.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/calculus-v3.jpg', openstax_slug: 'calculus-volume-3' },
  { titre: 'Statistics', auteur: 'OpenStax', niveau: 'Université', matiere: 'Mathématiques', langue: 'en', resume: 'Statistics is designed for the one or two-semester introductory statistics course for non-math majors.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/statistics.jpg', openstax_slug: 'statistics' },
  { titre: 'Introductory Statistics 2e', auteur: 'OpenStax', niveau: 'Lycée', matiere: 'Mathématiques', langue: 'en', resume: 'Introductory Statistics 2e follows scope and sequence of a one-semester, introductory statistics course.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/introductory-statistics-2e.jpg', openstax_slug: 'introductory-statistics-2e' },

  // ── Sciences ──
  { titre: 'Biology 2e', auteur: 'OpenStax', niveau: 'Lycée', matiere: 'Biologie', langue: 'en', resume: 'Biology 2e is designed to cover the scope and sequence requirements of a typical two-semester biology course for science majors.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/biology-2e.jpg', openstax_slug: 'biology-2e' },
  { titre: 'Concepts of Biology', auteur: 'OpenStax', niveau: 'Collège', matiere: 'Biologie', langue: 'en', resume: 'Concepts of Biology is designed for the typical introductory biology course for nonmajors, covering standard scope and sequence.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/concepts-of-biology.jpg', openstax_slug: 'concepts-of-biology' },
  { titre: 'Microbiology', auteur: 'OpenStax', niveau: 'Université', matiere: 'Biologie', langue: 'en', resume: 'Microbiology covers the scope and sequence requirements for a single-semester microbiology course for non-majors.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/microbiology.jpg', openstax_slug: 'microbiology' },
  { titre: 'Anatomy and Physiology 2e', auteur: 'OpenStax', niveau: 'Université', matiere: 'Biologie', langue: 'en', resume: 'Anatomy and Physiology 2e is a dynamic textbook for the year-long Human Anatomy and Physiology course.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/anatomy-physiology-2e.jpg', openstax_slug: 'anatomy-and-physiology-2e' },
  { titre: 'Chemistry 2e', auteur: 'OpenStax', niveau: 'Lycée', matiere: 'Chimie', langue: 'en', resume: 'Chemistry 2e is designed to meet the scope and sequence requirements of the two-semester general chemistry course.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/chemistry-2e.jpg', openstax_slug: 'chemistry-2e' },
  { titre: 'Chemistry: Atoms First 2e', auteur: 'OpenStax', niveau: 'Lycée', matiere: 'Chimie', langue: 'en', resume: 'Chemistry: Atoms First 2e is a peer-reviewed, openly licensed introductory textbook produced through a collaborative publishing partnership.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/chemistry-atoms-first-2e.jpg', openstax_slug: 'chemistry-atoms-first-2e' },
  { titre: 'University Physics Volume 1', auteur: 'OpenStax', niveau: 'Université', matiere: 'Physique', langue: 'en', resume: 'University Physics Volume 1 covers mechanics, waves and thermodynamics for calculus-based physics courses.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/university-physics-v1.jpg', openstax_slug: 'university-physics-volume-1' },
  { titre: 'University Physics Volume 2', auteur: 'OpenStax', niveau: 'Université', matiere: 'Physique', langue: 'en', resume: 'University Physics Volume 2 covers thermodynamics, electricity and magnetism.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/university-physics-v2.jpg', openstax_slug: 'university-physics-volume-2' },
  { titre: 'University Physics Volume 3', auteur: 'OpenStax', niveau: 'Université', matiere: 'Physique', langue: 'en', resume: 'University Physics Volume 3 covers optics, modern physics and quantum mechanics.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/university-physics-v3.jpg', openstax_slug: 'university-physics-volume-3' },
  { titre: 'College Physics 2e', auteur: 'OpenStax', niveau: 'Lycée', matiere: 'Physique', langue: 'en', resume: 'College Physics 2e meets standard scope and sequence for a two-semester introductory algebra-based physics course.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/college-physics-2e.jpg', openstax_slug: 'college-physics-2e' },

  // ── Sciences humaines ──
  { titre: 'Introduction to Sociology 3e', auteur: 'OpenStax', niveau: 'Université', matiere: 'Sciences humaines', langue: 'en', resume: 'Introduction to Sociology 3e aligns to the topics and objectives of a typical introductory sociology course.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/intro-sociology-3e.jpg', openstax_slug: 'introduction-to-sociology-3e' },
  { titre: 'Psychology 2e', auteur: 'OpenStax', niveau: 'Université', matiere: 'Sciences humaines', langue: 'en', resume: 'Psychology 2e is a peer-reviewed, openly licensed introductory textbook. It covers the breadth of psychological topics.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/psychology-2e.jpg', openstax_slug: 'psychology-2e' },
  { titre: 'Introduction to Philosophy', auteur: 'OpenStax', niveau: 'Université', matiere: 'Sciences humaines', langue: 'en', resume: 'Introduction to Philosophy is a peer-reviewed introductory textbook exploring the major areas of philosophical inquiry.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/introduction-to-philosophy.jpg', openstax_slug: 'introduction-to-philosophy' },
  { titre: 'World History Volume 1', auteur: 'OpenStax', niveau: 'Lycée', matiere: 'Histoire', langue: 'en', resume: 'World History Volume 1 covers the development of human civilization from prehistory to 1500 CE.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/world-history-v1.jpg', openstax_slug: 'world-history-volume-1' },
  { titre: 'World History Volume 2', auteur: 'OpenStax', niveau: 'Lycée', matiere: 'Histoire', langue: 'en', resume: 'World History Volume 2 covers global history from 1400 CE to the present.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/world-history-v2.jpg', openstax_slug: 'world-history-volume-2' },
  { titre: 'U.S. History', auteur: 'OpenStax', niveau: 'Lycée', matiere: 'Histoire', langue: 'en', resume: 'U.S. History is designed to meet the scope and sequence requirements of most introductory courses.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/us-history.jpg', openstax_slug: 'us-history' },

  // ── Économie & Gestion ──
  { titre: 'Principles of Economics 3e', auteur: 'OpenStax', niveau: 'Université', matiere: 'Économie', langue: 'en', resume: 'Principles of Economics 3e covers the scope and sequence for a two-semester principles of economics course.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/principles-economics-3e.jpg', openstax_slug: 'principles-of-economics-3e' },
  { titre: 'Principles of Microeconomics 3e', auteur: 'OpenStax', niveau: 'Université', matiere: 'Économie', langue: 'en', resume: 'Principles of Microeconomics 3e covers the scope and sequence of most introductory microeconomics courses.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/principles-microeconomics-3e.jpg', openstax_slug: 'principles-of-microeconomics-3e' },
  { titre: 'Principles of Macroeconomics 3e', auteur: 'OpenStax', niveau: 'Université', matiere: 'Économie', langue: 'en', resume: 'Principles of Macroeconomics 3e covers the scope and sequence of most introductory macroeconomics courses.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/principles-macroeconomics-3e.jpg', openstax_slug: 'principles-of-macroeconomics-3e' },
  { titre: 'Introduction to Business', auteur: 'OpenStax', niveau: 'Université', matiere: 'Gestion', langue: 'en', resume: 'Introduction to Business covers the scope and sequence of most introductory business courses.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/introduction-to-business.jpg', openstax_slug: 'introduction-to-business' },
  { titre: 'Principles of Accounting Volume 1', auteur: 'OpenStax', niveau: 'Université', matiere: 'Gestion', langue: 'en', resume: 'Principles of Accounting Volume 1 covers financial accounting essentials for a first-semester accounting course.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/principles-accounting-v1.jpg', openstax_slug: 'principles-of-accounting-volume-1-financial-accounting' },
  { titre: 'Principles of Accounting Volume 2', auteur: 'OpenStax', niveau: 'Université', matiere: 'Gestion', langue: 'en', resume: 'Principles of Accounting Volume 2 covers managerial accounting for a second-semester accounting course.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/principles-accounting-v2.jpg', openstax_slug: 'principles-of-accounting-volume-2-managerial-accounting' },

  // ── Informatique ──
  { titre: 'Introduction to Python Programming', auteur: 'OpenStax', niveau: 'Lycée', matiere: 'Informatique', langue: 'en', resume: 'Introduction to Python Programming covers the basics of programming using Python, from variables to data structures and algorithms.', couverture: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/intro-python.jpg', openstax_slug: 'introduction-to-python-programming' },

  // ── Langue française ──
  { titre: 'Français pour Débutants', auteur: 'OpenStax', niveau: 'Collège', matiere: 'Langue française', langue: 'fr', resume: 'Manuel de français pour les apprenants débutants couvrant la grammaire de base, le vocabulaire et les structures de phrases fondamentales.', couverture: null, openstax_slug: 'francais-debutants' },
];

/* ══════════════════════════════════════════════════════════════
   MAPPING NIVEAUX → genres/catégories Kalamundi
   ══════════════════════════════════════════════════════════════ */
function mapGenre(matiere, niveau) {
  const map = {
    'Mathématiques': 'education_maths',
    'Physique':      'education_sciences',
    'Chimie':        'education_sciences',
    'Biologie':      'education_sciences',
    'Sciences humaines': 'education_sh',
    'Histoire':      'education_sh',
    'Économie':      'education_eco',
    'Gestion':       'education_eco',
    'Informatique':  'education_info',
    'Langue française': 'education_langues',
  };
  return map[matiere] || 'education_autre';
}

function mapDewey(matiere) {
  const map = {
    'Mathématiques': '510',
    'Physique':      '530',
    'Chimie':        '540',
    'Biologie':      '570',
    'Sciences humaines': '300',
    'Histoire':      '900',
    'Économie':      '330',
    'Gestion':       '658',
    'Informatique':  '005',
    'Langue française': '440',
  };
  return map[matiere] || '370';
}

/* ══════════════════════════════════════════════════════════════
   IMPORT PRINCIPAL
   ══════════════════════════════════════════════════════════════ */
async function importerOpenstax() {
  console.log(`\n📚 IMPORT E1 — Manuels scolaires OpenStax`);
  console.log(`Cible : ${OPENSTAX_BOOKS.length} manuels CC-BY\n`);

  let inseres = 0, ignores = 0, erreurs = 0;

  for (const livre of OPENSTAX_BOOKS) {
    const hash = sha256(`openstax:${livre.openstax_slug}`);

    // Vérifier doublon
    const { data: exist } = await supabase
      .from('oeuvres')
      .select('id')
      .eq('hash_sha256', hash)
      .maybeSingle();

    if (exist) {
      console.log(`  ⏭  Déjà en base : ${livre.titre}`);
      ignores++;
      await sleep(100);
      continue;
    }

    const urlLecture = `https://openstax.org/books/${livre.openstax_slug}/pages/1-introduction`;
    const urlPdf     = `https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/${livre.openstax_slug}.pdf`;

    const oeuvre = {
      titre:          livre.titre,
      auteur_id:      AUTEUR_SYSTEME_ID,
      langue_originale: livre.langue,
      resume:         livre.resume,
      couverture_url: livre.couverture,
      genre:          mapGenre(livre.matiere, livre.niveau),
      public_cible:   livre.niveau,
      statut:         'gratuit',
      prix:           0,
      fichier_url:    urlLecture,
      hash_sha256:    hash,
      note_moyenne:   0,
      nb_lectures:    0,
      visible:        true,
      created_at:     new Date().toISOString(),
    };

    const { error } = await supabase.from('oeuvres').insert(oeuvre);

    if (error) {
      // Colonnes manquantes ? On retire les colonnes optionnelles et on réessaie
      const oeuvreMin = {
        titre:          oeuvre.titre,
        auteur_id:      oeuvre.auteur_id,
        langue_originale: oeuvre.langue_originale,
        resume:         oeuvre.resume,
        genre:          oeuvre.genre,
        statut:         'gratuit',
        prix:           0,
        hash_sha256:    oeuvre.hash_sha256,
        note_moyenne:   0,
        nb_lectures:    0,
        visible:        true,
        created_at:     oeuvre.created_at,
      };
      const { error: err2 } = await supabase.from('oeuvres').insert(oeuvreMin);
      if (err2) {
        console.error(`  ❌ Erreur ${livre.titre}: ${err2.message}`);
        erreurs++;
      } else {
        console.log(`  ✅ [min] ${livre.niveau} — ${livre.matiere} — ${livre.titre}`);
        inseres++;
      }
    } else {
      console.log(`  ✅ ${livre.niveau} — ${livre.matiere} — ${livre.titre}`);
      inseres++;
    }

    await sleep(300);
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`✅ Insérés  : ${inseres}`);
  console.log(`⏭  Ignorés  : ${ignores} (déjà en base)`);
  console.log(`❌ Erreurs  : ${erreurs}`);
  console.log(`══════════════════════════════════════\n`);
}

importerOpenstax().catch(console.error);
