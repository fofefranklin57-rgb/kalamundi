-- Kalamundi P1.6 - Chapitres normalisés pour EPUB, traduction et prêt numérique.

ALTER TABLE IF EXISTS chapitres
  ADD COLUMN IF NOT EXISTS chapitre_id TEXT,
  ADD COLUMN IF NOT EXISTS format_source TEXT DEFAULT 'interne',
  ADD COLUMN IF NOT EXISTS source_hash TEXT,
  ADD COLUMN IF NOT EXISTS structure_path TEXT,
  ADD COLUMN IF NOT EXISTS epub_href TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE chapitres
SET chapitre_id = 'ch-' || LPAD(COALESCE(numero, 1)::TEXT, 3, '0') || '-' || LEFT(REPLACE(id::TEXT, '-', ''), 8)
WHERE chapitre_id IS NULL OR chapitre_id = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chapitres' AND column_name = 'contenu_texte'
  ) THEN
    UPDATE chapitres
    SET source_hash = SUBSTRING(MD5(COALESCE(contenu_texte, '')) FROM 1 FOR 12)
    WHERE source_hash IS NULL OR source_hash = '';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chapitres' AND column_name = 'contenu'
  ) THEN
    UPDATE chapitres
    SET source_hash = SUBSTRING(MD5(COALESCE(contenu, '')) FROM 1 FOR 12)
    WHERE source_hash IS NULL OR source_hash = '';
  ELSE
    UPDATE chapitres
    SET source_hash = SUBSTRING(MD5(COALESCE(id::TEXT, '')) FROM 1 FOR 12)
    WHERE source_hash IS NULL OR source_hash = '';
  END IF;
END $$;

ALTER TABLE IF EXISTS chapitres
  ALTER COLUMN chapitre_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chapitres_oeuvre_chapitre_id
  ON chapitres(oeuvre_id, chapitre_id);

CREATE INDEX IF NOT EXISTS idx_chapitres_format_source
  ON chapitres(format_source);

COMMENT ON COLUMN chapitres.chapitre_id IS
  'Identifiant stable de chapitre, utilisé par EPUB, traductions, annotations et prêts numériques.';

COMMENT ON COLUMN chapitres.format_source IS
  'Format d’origine du chapitre normalisé : interne, txt, docx, pdf, epub, odt.';

COMMENT ON COLUMN chapitres.epub_href IS
  'Chemin XHTML du chapitre dans l’EPUB canonique généré.';
