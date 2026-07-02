-- Migration V006 — Paywall progressif par chapitres gratuits

ALTER TABLE oeuvres
  ADD COLUMN IF NOT EXISTS chapitres_gratuits INTEGER DEFAULT 0
  CHECK (chapitres_gratuits >= 0 AND chapitres_gratuits <= 50);

ALTER TABLE oeuvres
  DROP CONSTRAINT IF EXISTS oeuvres_frequence_publication_check;

ALTER TABLE oeuvres
  ADD CONSTRAINT oeuvres_frequence_publication_check
    CHECK (frequence_publication IN (
      'immediate',
      'quotidien',
      'biquotidien',
      'hebdomadaire',
      'bihebdomadaire',
      'mensuel',
      'bimensuel'
    ));

UPDATE oeuvres
  SET chapitres_gratuits = 3
  WHERE statut = 'premium'
    AND (chapitres_gratuits IS NULL OR chapitres_gratuits = 0);

CREATE INDEX IF NOT EXISTS idx_chapitres_publication_visible
  ON chapitres(oeuvre_id, visible, date_publication, numero);

DROP POLICY IF EXISTS "chapitres_lecture_publique" ON chapitres;
CREATE POLICY "chapitres_lecture_publique" ON chapitres
  FOR SELECT USING (
    visible = true
    AND (date_publication IS NULL OR date_publication <= NOW())
  );
