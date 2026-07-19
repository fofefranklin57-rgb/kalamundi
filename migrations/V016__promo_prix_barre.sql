-- ============================================================
-- V016 — Prix barré / soldé (reste de P3 #12, D17 promo)
-- Objectif : permettre d'afficher un prix "avant/après" sur une offre
-- d'achat numérique, sans toucher au modèle de royalties existant
-- (royalties_auteur_pct / royalties_plateforme_pct restent la source de
-- vérité du partage — une promo peut, si besoin, relever
-- royalties_plateforme_pct sur CETTE offre précise, cf. D17).
--
-- prix_barre NULL ou <= prix => pas de promo affichée (comportement
-- inchangé). prix_barre > prix => badge "-X%" affiché côté client.
-- ============================================================

ALTER TABLE livre_offres
  ADD COLUMN IF NOT EXISTS prix_barre NUMERIC(12,2)
    CHECK (prix_barre IS NULL OR prix_barre >= 0);

COMMENT ON COLUMN livre_offres.prix_barre IS
  'Prix "avant" affiché barré quand > prix (promo). NULL = pas de promo.';
