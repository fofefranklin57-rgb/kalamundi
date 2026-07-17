-- Kalamundi P1.8 - Traductions ancrées sur le chapitre_id stable.

ALTER TABLE IF EXISTS traductions
  ADD COLUMN IF NOT EXISTS chapitre_ref TEXT,
  ADD COLUMN IF NOT EXISTS langue_source TEXT,
  ADD COLUMN IF NOT EXISTS source_hash TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF to_regclass('public.traductions') IS NOT NULL
     AND to_regclass('public.chapitres') IS NOT NULL THEN
    UPDATE traductions t
    SET chapitre_ref = c.chapitre_id,
        source_hash = COALESCE(t.source_hash, c.source_hash)
    FROM chapitres c
    WHERE t.chapitre_id = c.id
      AND (t.chapitre_ref IS NULL OR t.chapitre_ref = '');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.traductions') IS NOT NULL THEN
    UPDATE traductions
    SET chapitre_ref = COALESCE(chapitre_ref, chapitre_id::TEXT),
        langue_source = COALESCE(langue_source, 'fr')
    WHERE chapitre_ref IS NULL OR chapitre_ref = '' OR langue_source IS NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_traductions_chapitre_ref_langue
  ON traductions(chapitre_ref, langue_cible)
  WHERE chapitre_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_traductions_langue_source
  ON traductions(langue_source);

COMMENT ON COLUMN traductions.chapitre_ref IS
  'Référence stable du chapitre normalisé, indépendante de l’id technique Supabase.';

COMMENT ON COLUMN traductions.langue_source IS
  'Langue originale réellement utilisée pour produire la traduction.';
