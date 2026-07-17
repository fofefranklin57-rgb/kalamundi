-- Migration V010 — Couche sociale lecteur : étagères et stats
-- Objectif : permettre "à lire", "en cours", "terminé", "favori" par œuvre.

CREATE TABLE IF NOT EXISTS oeuvre_etageres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  oeuvre_id UUID NOT NULL REFERENCES oeuvres(id) ON DELETE CASCADE,
  statut TEXT NOT NULL DEFAULT 'a_lire'
    CHECK (statut IN ('a_lire', 'en_cours', 'termine', 'favori')),
  progression_pct INT NOT NULL DEFAULT 0 CHECK (progression_pct BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, oeuvre_id)
);

CREATE INDEX IF NOT EXISTS idx_oeuvre_etageres_oeuvre_statut
  ON oeuvre_etageres(oeuvre_id, statut);

CREATE INDEX IF NOT EXISTS idx_oeuvre_etageres_user_updated
  ON oeuvre_etageres(user_id, updated_at DESC);

ALTER TABLE oeuvre_etageres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oeuvre_etageres_lecture_proprietaire" ON oeuvre_etageres;
CREATE POLICY "oeuvre_etageres_lecture_proprietaire" ON oeuvre_etageres
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "oeuvre_etageres_ecriture_proprietaire" ON oeuvre_etageres;
CREATE POLICY "oeuvre_etageres_ecriture_proprietaire" ON oeuvre_etageres
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "oeuvre_etageres_update_proprietaire" ON oeuvre_etageres;
CREATE POLICY "oeuvre_etageres_update_proprietaire" ON oeuvre_etageres
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "oeuvre_etageres_delete_proprietaire" ON oeuvre_etageres;
CREATE POLICY "oeuvre_etageres_delete_proprietaire" ON oeuvre_etageres
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION toucher_oeuvre_etagere_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_oeuvre_etageres_updated_at ON oeuvre_etageres;
CREATE TRIGGER trig_oeuvre_etageres_updated_at
BEFORE UPDATE ON oeuvre_etageres
FOR EACH ROW EXECUTE FUNCTION toucher_oeuvre_etagere_updated_at();

CREATE OR REPLACE FUNCTION get_oeuvre_social_stats(p_oeuvre_id UUID)
RETURNS TABLE (
  a_lire BIGINT,
  en_cours BIGINT,
  termines BIGINT,
  favoris BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE statut = 'a_lire') AS a_lire,
    COUNT(*) FILTER (WHERE statut = 'en_cours') AS en_cours,
    COUNT(*) FILTER (WHERE statut = 'termine') AS termines,
    COUNT(*) FILTER (WHERE statut = 'favori') AS favoris
  FROM oeuvre_etageres
  WHERE oeuvre_id = p_oeuvre_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_oeuvre_social_stats(UUID) TO anon, authenticated;
