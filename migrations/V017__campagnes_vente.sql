-- V017 — Campagnes de vente livre
-- Objectif : donner à l'admin un outil pour mettre un livre en avant
-- pendant une période, avec une page partageable sur les réseaux sociaux.

CREATE TABLE IF NOT EXISTS campagnes_vente (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  oeuvre_id uuid NOT NULL REFERENCES oeuvres(id) ON DELETE CASCADE,
  offre_id uuid REFERENCES livre_offres(id) ON DELETE SET NULL,
  auteur_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  titre text NOT NULL,
  slogan text,
  visuel_url text,
  slug text NOT NULL UNIQUE,
  statut text NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','programmee','active','terminee','suspendue')),
  date_debut timestamptz NOT NULL DEFAULT now(),
  date_fin timestamptz,
  prix_campagne numeric(12,2) CHECK (prix_campagne IS NULL OR prix_campagne >= 0),
  prix_barre numeric(12,2) CHECK (prix_barre IS NULL OR prix_barre >= 0),
  devise text NOT NULL DEFAULT 'XAF',
  commission_plateforme_pct numeric(5,2) DEFAULT 50
    CHECK (commission_plateforme_pct IS NULL OR commission_plateforme_pct BETWEEN 0 AND 100),
  budget_pub_xaf numeric(12,2) DEFAULT 0 CHECK (budget_pub_xaf >= 0),
  canaux text[] DEFAULT ARRAY['facebook','whatsapp','tiktok'],
  conditions_admin text,
  impressions integer NOT NULL DEFAULT 0,
  clics integer NOT NULL DEFAULT 0,
  intentions_achat integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  revenu_xaf numeric(14,2) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campagnes_vente_active
  ON campagnes_vente(statut, date_debut, date_fin);

CREATE INDEX IF NOT EXISTS idx_campagnes_vente_oeuvre
  ON campagnes_vente(oeuvre_id, statut);

ALTER TABLE campagnes_vente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campagnes_vente_public_actives" ON campagnes_vente;
CREATE POLICY "campagnes_vente_public_actives" ON campagnes_vente
  FOR SELECT TO anon, authenticated
  USING (
    statut = 'active'
    AND date_debut <= now()
    AND (date_fin IS NULL OR date_fin >= now())
  );

DROP POLICY IF EXISTS "campagnes_vente_admin_full" ON campagnes_vente;
CREATE POLICY "campagnes_vente_admin_full" ON campagnes_vente
  FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "campagnes_vente_auteur_lecture" ON campagnes_vente;
CREATE POLICY "campagnes_vente_auteur_lecture" ON campagnes_vente
  FOR SELECT TO authenticated
  USING (auteur_id = auth.uid());

CREATE OR REPLACE FUNCTION set_campagnes_vente_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_campagnes_vente_updated_at ON campagnes_vente;
CREATE TRIGGER trg_campagnes_vente_updated_at
  BEFORE UPDATE ON campagnes_vente
  FOR EACH ROW EXECUTE FUNCTION set_campagnes_vente_updated_at();

CREATE OR REPLACE FUNCTION track_campagne_vente(p_slug text, p_evenement text DEFAULT 'vue')
RETURNS void AS $$
BEGIN
  UPDATE campagnes_vente
  SET
    impressions = impressions + CASE WHEN p_evenement = 'vue' THEN 1 ELSE 0 END,
    clics = clics + CASE WHEN p_evenement = 'clic' THEN 1 ELSE 0 END,
    intentions_achat = intentions_achat + CASE WHEN p_evenement = 'achat' THEN 1 ELSE 0 END
  WHERE slug = p_slug
    AND statut = 'active'
    AND date_debut <= now()
    AND (date_fin IS NULL OR date_fin >= now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION track_campagne_vente(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION track_campagne_vente(text, text) TO anon, authenticated;
