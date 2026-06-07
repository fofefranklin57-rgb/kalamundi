-- ============================================================
-- Kalamundi — Annotations & Structure livre
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Ajout du type d'élément sur les chapitres ─────────────
--    Permet de distinguer le corps du livre des éléments
--    paratextuels (dédicace, prologue, épilogue, etc.)

ALTER TABLE chapitres
  ADD COLUMN IF NOT EXISTS type_element TEXT
  DEFAULT 'chapitre'
  CHECK (type_element IN (
    -- Éléments liminaires (avant le corps)
    'dedicace',       -- Dédicace
    'epigraphe',      -- Épigraphe (citation en exergue)
    'avant_propos',   -- Avant-propos (de l'auteur)
    'preface',        -- Préface (d'un tiers)
    'introduction',   -- Introduction
    'prologue',       -- Prologue narratif
    'sommaire',       -- Sommaire / Table des matières
    -- Corps du livre
    'chapitre',       -- Chapitre numéroté (défaut)
    'partie',         -- Titre de partie (niveau supérieur)
    'interlude',      -- Interlude / transition
    -- Éléments terminaux (après le corps)
    'epilogue',       -- Épilogue narratif
    'conclusion',     -- Conclusion
    'postface',       -- Postface
    'remerciements',  -- Remerciements
    'bibliographie',  -- Bibliographie / Sources
    'annexe',         -- Annexe
    'index',          -- Index
    'glossaire'       -- Glossaire
  ));

-- Mettre à jour les chapitres existants dont le titre
-- correspond à un élément paratextuel connu
UPDATE chapitres SET type_element = 'dedicace'
  WHERE LOWER(titre) LIKE '%dédicace%' OR LOWER(titre) LIKE '%dedicace%';

UPDATE chapitres SET type_element = 'avant_propos'
  WHERE LOWER(titre) LIKE '%avant-propos%' OR LOWER(titre) LIKE '%avant propos%';

UPDATE chapitres SET type_element = 'preface'
  WHERE LOWER(titre) LIKE '%préface%' OR LOWER(titre) LIKE '%preface%';

UPDATE chapitres SET type_element = 'introduction'
  WHERE LOWER(titre) LIKE '%introduction%';

UPDATE chapitres SET type_element = 'prologue'
  WHERE LOWER(titre) LIKE '%prologue%';

UPDATE chapitres SET type_element = 'epilogue'
  WHERE LOWER(titre) LIKE '%épilogue%' OR LOWER(titre) LIKE '%epilogue%';

UPDATE chapitres SET type_element = 'conclusion'
  WHERE LOWER(titre) LIKE '%conclusion%';

UPDATE chapitres SET type_element = 'remerciements'
  WHERE LOWER(titre) LIKE '%remerciements%' OR LOWER(titre) LIKE '%merci%';

UPDATE chapitres SET type_element = 'bibliographie'
  WHERE LOWER(titre) LIKE '%bibliographie%' OR LOWER(titre) LIKE '%sources%';


-- ── 2. Table annotations ─────────────────────────────────────
--    Marque-pages, notes de lecture, surlignages
--    Chaque annotation est liée à un utilisateur + une œuvre + un chapitre

CREATE TABLE IF NOT EXISTS annotations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  oeuvre_id       UUID REFERENCES oeuvres(id)  ON DELETE CASCADE NOT NULL,
  chapitre_id     UUID REFERENCES chapitres(id) ON DELETE CASCADE,
  chapitre_num    INTEGER NOT NULL DEFAULT 1,

  -- Type d'annotation
  type            TEXT NOT NULL
    CHECK (type IN ('marque_page', 'note', 'surlignage')),

  -- Texte sélectionné (pour notes et surlignages)
  texte_selectionne TEXT,

  -- Contenu de la note (uniquement pour type = 'note')
  contenu         TEXT,

  -- Couleur (surlignage : jaune, vert, bleu, rose)
  couleur         TEXT DEFAULT 'jaune'
    CHECK (couleur IN ('jaune', 'vert', 'bleu', 'rose')),

  -- Titre du marque-page (facultatif)
  label           TEXT,

  -- Position dans le paragraphe (index du paragraphe, offset caractère)
  paragraphe_index INTEGER,
  char_debut       INTEGER,
  char_fin         INTEGER,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Un seul marque-page par chapitre par utilisateur
  CONSTRAINT unique_marque_page
    UNIQUE NULLS NOT DISTINCT (user_id, chapitre_id, type)
    -- Note : cette contrainte s'applique seulement pour type='marque_page'
    -- Pour notes/surlignages, plusieurs par chapitre sont autorisés
);

-- Contourner la contrainte UNIQUE pour notes/surlignages :
-- on supprime la contrainte générale et on la remplace par un index partiel
ALTER TABLE annotations DROP CONSTRAINT IF EXISTS unique_marque_page;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_marque_page
  ON annotations (user_id, chapitre_id)
  WHERE type = 'marque_page';

-- Index de performance
CREATE INDEX IF NOT EXISTS idx_annotations_user_oeuvre
  ON annotations (user_id, oeuvre_id);

CREATE INDEX IF NOT EXISTS idx_annotations_chapitre
  ON annotations (chapitre_id);


-- ── 3. RLS — Row Level Security ──────────────────────────────

ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur ne voit que ses propres annotations
CREATE POLICY "annotations_proprio"
  ON annotations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── 4. Fonction RPC : compter les annotations d'une œuvre ────

CREATE OR REPLACE FUNCTION get_annotations_count(p_user_id UUID, p_oeuvre_id UUID)
RETURNS TABLE (
  marques_pages   BIGINT,
  notes           BIGINT,
  surlignages     BIGINT
) LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT
    COUNT(*) FILTER (WHERE type = 'marque_page') AS marques_pages,
    COUNT(*) FILTER (WHERE type = 'note')        AS notes,
    COUNT(*) FILTER (WHERE type = 'surlignage')  AS surlignages
  FROM annotations
  WHERE user_id = p_user_id
    AND oeuvre_id = p_oeuvre_id;
$$;
