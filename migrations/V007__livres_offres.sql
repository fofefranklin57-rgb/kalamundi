-- Migration V007 — Modèle progressif Livre + Éditions + Offres
-- Objectif : poser le pivot commerce sans casser le modèle existant `oeuvres`.
-- Les œuvres restent la source de lecture actuelle ; `livres` devient la fiche produit unifiée.

CREATE TABLE IF NOT EXISTS livres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oeuvre_id UUID UNIQUE REFERENCES oeuvres(id) ON DELETE SET NULL,
  auteur_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  titre TEXT NOT NULL,
  sous_titre TEXT,
  description TEXT,
  langue_originale TEXT NOT NULL DEFAULT 'fr',
  isbn10 TEXT,
  isbn13 TEXT,
  identifiant_kalamundi TEXT NOT NULL UNIQUE DEFAULT ('KAL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  type_catalogue TEXT NOT NULL DEFAULT 'auto_edition'
    CHECK (type_catalogue IN ('auto_edition','editeur','heritage','import','manuel','autre')),
  statut TEXT NOT NULL DEFAULT 'actif'
    CHECK (statut IN ('brouillon','actif','retire','archive')),
  couverture_url TEXT,
  public_cible TEXT DEFAULT 'tous',
  mots_cles TEXT[] DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS livre_editions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livre_id UUID NOT NULL REFERENCES livres(id) ON DELETE CASCADE,
  source_oeuvre_id UUID REFERENCES oeuvres(id) ON DELETE SET NULL,
  format TEXT NOT NULL
    CHECK (format IN ('chapitres','epub','pdf','audio','papier')),
  statut TEXT NOT NULL DEFAULT 'active'
    CHECK (statut IN ('brouillon','active','retiree','archivee')),
  version TEXT DEFAULT '1.0',
  isbn TEXT,
  fichier_url TEXT,
  epub_url TEXT,
  pages_estimees INTEGER CHECK (pages_estimees IS NULL OR pages_estimees >= 0),
  nb_chapitres INTEGER CHECK (nb_chapitres IS NULL OR nb_chapitres >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(livre_id, format, source_oeuvre_id)
);

CREATE TABLE IF NOT EXISTS livre_offres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livre_id UUID NOT NULL REFERENCES livres(id) ON DELETE CASCADE,
  edition_id UUID REFERENCES livre_editions(id) ON DELETE SET NULL,
  source_oeuvre_id UUID REFERENCES oeuvres(id) ON DELETE SET NULL,
  vendeur_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL
    CHECK (type IN (
      'lecture_gratuite',
      'lecture_abonnement',
      'achat_numerique',
      'achat_papier',
      'occasion',
      'pret_numerique',
      'heritage_gratuit',
      'don'
    )),
  statut TEXT NOT NULL DEFAULT 'active'
    CHECK (statut IN ('brouillon','active','suspendue','expiree','retiree')),
  prix NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (prix >= 0),
  devise TEXT NOT NULL DEFAULT 'XAF',
  fapshi_enabled BOOLEAN NOT NULL DEFAULT true,
  stock INTEGER CHECK (stock IS NULL OR stock >= 0),
  duree_acces_jours INTEGER CHECK (duree_acces_jours IS NULL OR duree_acces_jours > 0),
  chapitres_gratuits INTEGER CHECK (chapitres_gratuits IS NULL OR chapitres_gratuits >= 0),
  royalties_auteur_pct NUMERIC(5,2) NOT NULL DEFAULT 50
    CHECK (royalties_auteur_pct >= 0 AND royalties_auteur_pct <= 100),
  royalties_plateforme_pct NUMERIC(5,2) NOT NULL DEFAULT 50
    CHECK (royalties_plateforme_pct >= 0 AND royalties_plateforme_pct <= 100),
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  ordre INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_livre_offres_source_type
  ON livre_offres(source_oeuvre_id, type);

CREATE INDEX IF NOT EXISTS idx_livres_statut_catalogue
  ON livres(statut, type_catalogue, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_livres_oeuvre
  ON livres(oeuvre_id);

CREATE INDEX IF NOT EXISTS idx_livre_editions_livre
  ON livre_editions(livre_id, format, statut);

CREATE INDEX IF NOT EXISTS idx_livre_offres_livre
  ON livre_offres(livre_id, type, statut, prix);

CREATE INDEX IF NOT EXISTS idx_livre_offres_vendeur
  ON livre_offres(vendeur_id, statut);

ALTER TABLE livres ENABLE ROW LEVEL SECURITY;
ALTER TABLE livre_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE livre_offres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "livres_lecture_publique" ON livres;
CREATE POLICY "livres_lecture_publique" ON livres
  FOR SELECT USING (statut = 'actif');

DROP POLICY IF EXISTS "livres_gestion_auteur_admin" ON livres;
CREATE POLICY "livres_gestion_auteur_admin" ON livres
  FOR ALL USING (
    auth.uid() = auteur_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = auteur_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "livre_editions_lecture_publique" ON livre_editions;
CREATE POLICY "livre_editions_lecture_publique" ON livre_editions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM livres
      WHERE livres.id = livre_editions.livre_id
        AND livres.statut = 'actif'
    )
  );

DROP POLICY IF EXISTS "livre_editions_gestion_auteur_admin" ON livre_editions;
CREATE POLICY "livre_editions_gestion_auteur_admin" ON livre_editions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM livres
      WHERE livres.id = livre_editions.livre_id
        AND (
          livres.auteur_id = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM livres
      WHERE livres.id = livre_editions.livre_id
        AND (
          livres.auteur_id = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "livre_offres_lecture_publique" ON livre_offres;
CREATE POLICY "livre_offres_lecture_publique" ON livre_offres
  FOR SELECT USING (
    statut = 'active'
    AND EXISTS (
      SELECT 1 FROM livres
      WHERE livres.id = livre_offres.livre_id
        AND livres.statut = 'actif'
    )
  );

DROP POLICY IF EXISTS "livre_offres_gestion_auteur_vendeur_admin" ON livre_offres;
CREATE POLICY "livre_offres_gestion_auteur_vendeur_admin" ON livre_offres
  FOR ALL USING (
    vendeur_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM livres
      WHERE livres.id = livre_offres.livre_id
        AND livres.auteur_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    vendeur_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM livres
      WHERE livres.id = livre_offres.livre_id
        AND livres.auteur_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP TRIGGER IF EXISTS trg_livres_updated_at ON livres;
CREATE TRIGGER trg_livres_updated_at
  BEFORE UPDATE ON livres
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_livre_editions_updated_at ON livre_editions;
CREATE TRIGGER trg_livre_editions_updated_at
  BEFORE UPDATE ON livre_editions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_livre_offres_updated_at ON livre_offres;
CREATE TRIGGER trg_livre_offres_updated_at
  BEFORE UPDATE ON livre_offres
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE IF EXISTS paiements
  ADD COLUMN IF NOT EXISTS livre_id UUID REFERENCES livres(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offre_id UUID REFERENCES livre_offres(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS revenus
  ADD COLUMN IF NOT EXISTS livre_id UUID REFERENCES livres(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offre_id UUID REFERENCES livre_offres(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS acces_premium
  ADD COLUMN IF NOT EXISTS livre_id UUID REFERENCES livres(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offre_id UUID REFERENCES livre_offres(id) ON DELETE SET NULL;

INSERT INTO livres (
  oeuvre_id,
  auteur_id,
  titre,
  description,
  langue_originale,
  couverture_url,
  public_cible,
  statut,
  type_catalogue,
  created_at,
  updated_at
)
SELECT
  o.id,
  o.auteur_id,
  o.titre,
  o.resume,
  COALESCE(o.langue_originale, 'fr'),
  o.couverture_url,
  COALESCE(o.public_cible, 'tous'),
  CASE WHEN COALESCE(o.visible, true) THEN 'actif' ELSE 'retire' END,
  'auto_edition',
  COALESCE(o.created_at, NOW()),
  COALESCE(o.updated_at, NOW())
FROM oeuvres o
ON CONFLICT (oeuvre_id) DO NOTHING;

INSERT INTO livre_editions (
  livre_id,
  source_oeuvre_id,
  format,
  statut,
  version,
  fichier_url,
  nb_chapitres,
  created_at,
  updated_at
)
SELECT
  l.id,
  o.id,
  'chapitres',
  CASE WHEN COALESCE(o.visible, true) THEN 'active' ELSE 'retiree' END,
  '1.0',
  o.fichier_url,
  (SELECT COUNT(*)::INTEGER FROM chapitres c WHERE c.oeuvre_id = o.id),
  COALESCE(o.created_at, NOW()),
  COALESCE(o.updated_at, NOW())
FROM oeuvres o
JOIN livres l ON l.oeuvre_id = o.id
ON CONFLICT (livre_id, format, source_oeuvre_id) DO NOTHING;

INSERT INTO livre_offres (
  livre_id,
  edition_id,
  source_oeuvre_id,
  vendeur_id,
  type,
  statut,
  prix,
  devise,
  fapshi_enabled,
  chapitres_gratuits,
  royalties_auteur_pct,
  royalties_plateforme_pct,
  ordre,
  created_at,
  updated_at
)
SELECT
  l.id,
  e.id,
  o.id,
  o.auteur_id,
  CASE WHEN o.statut = 'premium' THEN 'achat_numerique' ELSE 'lecture_gratuite' END,
  CASE WHEN COALESCE(o.visible, true) THEN 'active' ELSE 'retiree' END,
  CASE WHEN o.statut = 'premium' THEN COALESCE(o.prix, 0) ELSE 0 END,
  'XAF',
  o.statut = 'premium',
  COALESCE(o.chapitres_gratuits, 0),
  CASE WHEN o.statut = 'premium' THEN 50 ELSE 0 END,
  CASE WHEN o.statut = 'premium' THEN 50 ELSE 0 END,
  CASE WHEN o.statut = 'premium' THEN 20 ELSE 10 END,
  COALESCE(o.created_at, NOW()),
  COALESCE(o.updated_at, NOW())
FROM oeuvres o
JOIN livres l ON l.oeuvre_id = o.id
LEFT JOIN livre_editions e
  ON e.livre_id = l.id
  AND e.source_oeuvre_id = o.id
  AND e.format = 'chapitres'
ON CONFLICT (source_oeuvre_id, type) DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.paiements') IS NOT NULL THEN
    UPDATE paiements p
    SET livre_id = l.id,
        offre_id = off.id
    FROM livres l
    LEFT JOIN livre_offres off
      ON off.source_oeuvre_id = l.oeuvre_id
      AND off.type = 'achat_numerique'
    WHERE p.oeuvre_id = l.oeuvre_id
      AND p.livre_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.revenus') IS NOT NULL THEN
    UPDATE revenus r
    SET livre_id = l.id,
        offre_id = off.id
    FROM livres l
    LEFT JOIN livre_offres off
      ON off.source_oeuvre_id = l.oeuvre_id
      AND off.type = 'achat_numerique'
    WHERE r.oeuvre_id = l.oeuvre_id
      AND r.livre_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.acces_premium') IS NOT NULL THEN
    UPDATE acces_premium a
    SET livre_id = l.id,
        offre_id = off.id
    FROM livres l
    LEFT JOIN livre_offres off
      ON off.source_oeuvre_id = l.oeuvre_id
      AND off.type = 'achat_numerique'
    WHERE a.oeuvre_id = l.oeuvre_id
      AND a.livre_id IS NULL;
  END IF;
END $$;
