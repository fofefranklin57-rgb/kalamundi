-- ============================================================
-- KALAMUNDI — Optimisations performances
-- Coller dans Supabase SQL Editor et exécuter
-- ============================================================

-- ── Index : accélère getChapitres(oeuvreId) ──────────────────
CREATE INDEX IF NOT EXISTS idx_chapitres_oeuvre_id
  ON chapitres(oeuvre_id);

-- ── Index : accélère getTraduction(chapitreId, langue) ────────
CREATE INDEX IF NOT EXISTS idx_traductions_chapitre_langue
  ON traductions(chapitre_id, langue_cible);

-- ── Index : accélère getOeuvresAuteur(auteurId) ───────────────
CREATE INDEX IF NOT EXISTS idx_oeuvres_auteur_id
  ON oeuvres(auteur_id);

-- ── Index : accélère la bibliothèque (tri par date) ───────────
CREATE INDEX IF NOT EXISTS idx_oeuvres_created_at
  ON oeuvres(created_at DESC) WHERE visible = true;

-- ── Fonction RPC : increment_lectures sans conflit RLS ────────
-- Utilise SECURITY DEFINER pour bypasser le RLS sur oeuvres
CREATE OR REPLACE FUNCTION increment_lectures(oeuvre_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE oeuvres
  SET nb_lectures = nb_lectures + 1
  WHERE id = oeuvre_id;
END;
$$;
