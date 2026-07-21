-- V018 — Attribution des ventes aux campagnes
-- Relie un paiement confirme a la campagne qui l'a declenche pour remonter
-- les conversions et le revenu dans le dashboard admin.

ALTER TABLE IF EXISTS paiements
  ADD COLUMN IF NOT EXISTS campagne_id uuid REFERENCES campagnes_vente(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_paiements_campagne
  ON paiements(campagne_id, statut, created_at);

COMMENT ON COLUMN paiements.campagne_id IS
  'Campagne de vente ayant déclenché ce paiement, si achat depuis /pages/campaign.html.';
