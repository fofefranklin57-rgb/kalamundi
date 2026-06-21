-- Migration V002 — Publication programmée + Fapshi
-- À exécuter dans Supabase SQL Editor

-- ============================================================
-- chapitres : colonnes pour publication programmée
-- ============================================================
ALTER TABLE chapitres
  ADD COLUMN IF NOT EXISTS date_publication TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS visible          BOOLEAN     DEFAULT true,
  ADD COLUMN IF NOT EXISTS type_element     TEXT        DEFAULT 'chapitre';

-- Index pour requêtes reader (chapitres visibles triés par date)
CREATE INDEX IF NOT EXISTS idx_chapitres_oeuvre_visible
  ON chapitres (oeuvre_id, visible, numero);

CREATE INDEX IF NOT EXISTS idx_chapitres_date_publication
  ON chapitres (date_publication)
  WHERE date_publication IS NOT NULL;

-- ============================================================
-- oeuvres : colonnes pour programme de publication
-- ============================================================
ALTER TABLE oeuvres
  ADD COLUMN IF NOT EXISTS frequence_publication TEXT
    CHECK (frequence_publication IN ('immediate','quotidien','hebdomadaire','mensuel'))
    DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS date_debut_publication DATE DEFAULT NULL;

-- ============================================================
-- paiements : ajouter 'fapshi' comme méthode valide
-- ============================================================
ALTER TABLE paiements
  DROP CONSTRAINT IF EXISTS paiements_methode_check;

ALTER TABLE paiements
  ADD CONSTRAINT paiements_methode_check
    CHECK (methode IN ('mtn_momo','orange_money','paypal','fapshi'));

-- ============================================================
-- Fonction cron : dépublier/publier les chapitres selon date
-- À appeler via pg_cron ou Supabase Edge Function planifiée
-- ============================================================
CREATE OR REPLACE FUNCTION publier_chapitres_programmes()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  nb INTEGER;
BEGIN
  UPDATE chapitres
    SET visible = true
  WHERE visible = false
    AND date_publication IS NOT NULL
    AND date_publication <= NOW();

  GET DIAGNOSTICS nb = ROW_COUNT;
  RETURN nb;
END;
$$;

-- Optionnel : activer pg_cron (si disponible sur ton plan Supabase)
-- SELECT cron.schedule('publier-chapitres', '0 * * * *', 'SELECT publier_chapitres_programmes()');
