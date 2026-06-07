-- ============================================================
-- supabase_revenus_partage.sql
-- Partage de revenus auteurs — colonnes manquantes + RLS
-- À exécuter dans le SQL Editor Supabase
-- ============================================================

-- Ajouter paiement_id à revenus si absent
ALTER TABLE revenus
  ADD COLUMN IF NOT EXISTS paiement_id UUID REFERENCES paiements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS devise      TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS type        TEXT NOT NULL DEFAULT 'vente_premium'
    CHECK (type IN ('vente_premium', 'abonnement', 'don', 'ajustement'));

-- Index pour éviter les doublons de reversement par paiement
CREATE UNIQUE INDEX IF NOT EXISTS revenus_paiement_auteur_unique
  ON revenus (paiement_id, auteur_id)
  WHERE paiement_id IS NOT NULL;

-- RLS : un auteur ne voit que ses revenus
ALTER TABLE revenus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auteur_voit_ses_revenus" ON revenus;
CREATE POLICY "auteur_voit_ses_revenus" ON revenus
  FOR SELECT USING (auth.uid() = auteur_id);

DROP POLICY IF EXISTS "admin_insert_revenus" ON revenus;
CREATE POLICY "admin_insert_revenus" ON revenus
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RPC pour le dashboard auteur — total revenus par œuvre
CREATE OR REPLACE FUNCTION get_revenus_auteur(p_auteur_id UUID)
RETURNS TABLE (
  oeuvre_id     UUID,
  titre_oeuvre  TEXT,
  nb_ventes     BIGINT,
  total_montant NUMERIC,
  en_attente    NUMERIC
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    r.oeuvre_id,
    o.titre AS titre_oeuvre,
    COUNT(r.id) AS nb_ventes,
    SUM(r.montant) AS total_montant,
    SUM(CASE WHEN r.statut = 'en_attente' THEN r.montant ELSE 0 END) AS en_attente
  FROM revenus r
  JOIN oeuvres o ON o.id = r.oeuvre_id
  WHERE r.auteur_id = p_auteur_id
  GROUP BY r.oeuvre_id, o.titre
  ORDER BY total_montant DESC;
$$;
