-- ============================================================
-- BUNDLE V007 -> V014 -- a coller une seule fois dans l'editeur SQL Supabase
-- Genere le 19/07/2026 : aucune de ces migrations n'etait appliquee (seule acces_premium existait).
-- ============================================================

-- ============================================================
-- V007__livres_offres.sql
-- ============================================================
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

-- ============================================================
-- V008__chapitres_normalisation_epub.sql
-- ============================================================
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

-- ============================================================
-- V009__traductions_chapitres_stables.sql
-- ============================================================
-- Kalamundi P1.8 - Traductions ancrées sur le chapitre_id stable.

ALTER TABLE IF EXISTS traductions
  ADD COLUMN IF NOT EXISTS chapitre_ref TEXT,
  ADD COLUMN IF NOT EXISTS langue_source TEXT,
  ADD COLUMN IF NOT EXISTS source_hash TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF to_regclass('public.traductions') IS NOT NULL
     AND to_regclass('public.chapitres') IS NOT NULL THEN
    UPDATE traductions t
    SET chapitre_ref = c.chapitre_id,
        source_hash = COALESCE(t.source_hash, c.source_hash)
    FROM chapitres c
    WHERE t.chapitre_id = c.id
      AND (t.chapitre_ref IS NULL OR t.chapitre_ref = '');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.traductions') IS NOT NULL THEN
    UPDATE traductions
    SET chapitre_ref = COALESCE(chapitre_ref, chapitre_id::TEXT),
        langue_source = COALESCE(langue_source, 'fr')
    WHERE chapitre_ref IS NULL OR chapitre_ref = '' OR langue_source IS NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_traductions_chapitre_ref_langue
  ON traductions(chapitre_ref, langue_cible)
  WHERE chapitre_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_traductions_langue_source
  ON traductions(langue_source);

COMMENT ON COLUMN traductions.chapitre_ref IS
  'Référence stable du chapitre normalisé, indépendante de l’id technique Supabase.';

COMMENT ON COLUMN traductions.langue_source IS
  'Langue originale réellement utilisée pour produire la traduction.';

-- ============================================================
-- V010__etageres_sociales_stats.sql
-- ============================================================
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

-- ============================================================
-- V011__cadeaux_diaspora.sql
-- ============================================================
-- ============================================================
-- V011 — Cadeaux diaspora (D11)
-- Objectif : permettre à la diaspora d'OFFRIR un livre à un proche
-- resté au pays. Le cadeau est un achat payé dont l'accès est mis en
-- attente jusqu'à ce qu'un bénéficiaire le réclame avec un code.
--
-- Modèle : un achat = une ligne dans acces_premium. Un cadeau ne crée
-- donc PAS d'acces_premium pour l'acheteur : il en crée un pour celui
-- qui réclame le code.
-- ============================================================

CREATE TABLE IF NOT EXISTS cadeaux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Qui offre
  offreur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Ce qui est offert
  oeuvre_id UUID NOT NULL REFERENCES oeuvres(id) ON DELETE CASCADE,

  -- Le code que le bénéficiaire saisira (unique, non devinable)
  code TEXT NOT NULL UNIQUE CHECK (char_length(code) BETWEEN 8 AND 24),

  -- Destinataire prévu (facultatif : on peut offrir "au porteur du code")
  beneficiaire_contact TEXT,
  message TEXT CHECK (message IS NULL OR char_length(message) <= 500),

  -- Traçabilité monétaire : on garde la devise payée ET l'équivalent XAF
  -- réellement encaissé par Fapshi (cf. scripts/lib/devises.mjs).
  montant NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (montant >= 0),
  devise TEXT NOT NULL DEFAULT 'XAF' CHECK (devise IN ('XAF', 'EUR', 'USD')),
  montant_xaf INT NOT NULL DEFAULT 0 CHECK (montant_xaf >= 0),
  paiement_id TEXT,

  statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'paye', 'reclame', 'annule')),

  -- Qui a réclamé (rempli à la réclamation)
  reclame_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reclame_le TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Un cadeau réclamé doit dire par qui et quand ; un non-réclamé, non.
  CONSTRAINT cadeaux_reclamation_coherente CHECK (
    (statut = 'reclame' AND reclame_par IS NOT NULL AND reclame_le IS NOT NULL)
    OR (statut <> 'reclame' AND reclame_par IS NULL AND reclame_le IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_cadeaux_offreur ON cadeaux(offreur_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cadeaux_statut ON cadeaux(statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cadeaux_paiement ON cadeaux(paiement_id);

ALTER TABLE cadeaux ENABLE ROW LEVEL SECURITY;

-- L'offreur voit ses cadeaux ; le bénéficiaire voit celui qu'il a réclamé.
-- Personne ne peut lister les codes des autres (sinon on les devine).
DROP POLICY IF EXISTS "cadeaux_lecture_offreur" ON cadeaux;
CREATE POLICY "cadeaux_lecture_offreur" ON cadeaux
  FOR SELECT USING (auth.uid() = offreur_id OR auth.uid() = reclame_par);

-- Aucune écriture directe depuis le client : le paiement et la réclamation
-- passent par le serveur / des RPC SECURITY DEFINER (cf. ERROR_LOG 2026-06-23).

CREATE OR REPLACE FUNCTION toucher_cadeaux_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cadeaux_updated_at ON cadeaux;
CREATE TRIGGER trg_cadeaux_updated_at
  BEFORE UPDATE ON cadeaux
  FOR EACH ROW EXECUTE FUNCTION toucher_cadeaux_updated_at();

-- ============================================================
-- RPC reclamer_cadeau — le bénéficiaire échange un code contre l'accès
-- SECURITY DEFINER : la vérification se fait ici, pas côté client.
-- ============================================================

CREATE OR REPLACE FUNCTION reclamer_cadeau(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cadeau   cadeaux%ROWTYPE;
  v_user_id  UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous pour reclamer un cadeau.';
  END IF;

  -- Verrou : deux personnes ne peuvent pas reclamer le meme code.
  SELECT * INTO v_cadeau
  FROM cadeaux
  WHERE code = upper(btrim(p_code))
  FOR UPDATE;

  IF v_cadeau.id IS NULL THEN
    RAISE EXCEPTION 'Code cadeau introuvable.';
  END IF;

  IF v_cadeau.statut = 'reclame' THEN
    RAISE EXCEPTION 'Ce cadeau a deja ete reclame.';
  END IF;

  IF v_cadeau.statut = 'annule' THEN
    RAISE EXCEPTION 'Ce cadeau a ete annule.';
  END IF;

  -- Un cadeau non paye ne donne aucun acces.
  IF v_cadeau.statut <> 'paye' THEN
    RAISE EXCEPTION 'Ce cadeau n''est pas encore paye.';
  END IF;

  -- On n'offre pas a soi-meme.
  IF v_cadeau.offreur_id = v_user_id THEN
    RAISE EXCEPTION 'Vous ne pouvez pas reclamer votre propre cadeau.';
  END IF;

  -- L'acces est accorde a celui qui reclame, pas a l'acheteur.
  INSERT INTO acces_premium (user_id, oeuvre_id)
  VALUES (v_user_id, v_cadeau.oeuvre_id)
  ON CONFLICT DO NOTHING;

  UPDATE cadeaux
     SET statut      = 'reclame',
         reclame_par = v_user_id,
         reclame_le  = now()
   WHERE id = v_cadeau.id;

  RETURN json_build_object(
    'ok', true,
    'oeuvre_id', v_cadeau.oeuvre_id,
    'message', v_cadeau.message
  );
END;
$$;

REVOKE ALL ON FUNCTION reclamer_cadeau(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reclamer_cadeau(TEXT) TO authenticated;

-- ============================================================
-- V012__occasion_sequestre.sql
-- ============================================================
-- ============================================================
-- V012 — Occasion : commandes sous séquestre + évaluations vendeur (P4 #14)
-- Objectif : vendre un livre d'occasion entre particuliers en toute confiance.
-- L'argent de l'acheteur est GELÉ (séquestre) au paiement et n'est versé au
-- vendeur qu'à la confirmation de réception (ou auto-libération après délai).
--
-- Le listing occasion existe déjà : livre_offres.type = 'occasion'.
-- États et règles : voir scripts/lib/occasion-etats.mjs (source de vérité).
-- Sur l'occasion, l'AUTEUR ne touche rien (première vente déjà effectuée).
-- ============================================================

CREATE TABLE IF NOT EXISTS commandes_occasion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  offre_id   UUID NOT NULL REFERENCES livre_offres(id) ON DELETE RESTRICT,
  livre_id   UUID NOT NULL REFERENCES livres(id) ON DELETE RESTRICT,
  acheteur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendeur_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Montants (traçabilité : ce que paie l'acheteur, ce que touche le vendeur)
  montant_xaf         INT NOT NULL CHECK (montant_xaf >= 100),
  commission_xaf      INT NOT NULL DEFAULT 0 CHECK (commission_xaf >= 0),
  montant_vendeur_xaf INT NOT NULL DEFAULT 0 CHECK (montant_vendeur_xaf >= 0),
  devise TEXT NOT NULL DEFAULT 'XAF' CHECK (devise IN ('XAF','EUR','USD')),
  paiement_id TEXT,

  -- Séquestre : l'argent est-il encore gelé par la plateforme ?
  fonds_liberes BOOLEAN NOT NULL DEFAULT false,
  payout_statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (payout_statut IN ('en_attente','a_verser','verse','rembourse')),

  -- Logistique de proximité (démarrage léger : main propre ou point relais)
  mode_remise TEXT NOT NULL DEFAULT 'main_propre'
    CHECK (mode_remise IN ('main_propre','point_relais','livraison')),
  remise_infos JSONB NOT NULL DEFAULT '{}'::jsonb,  -- ville, point relais, créneau…

  statut TEXT NOT NULL DEFAULT 'en_attente_paiement'
    CHECK (statut IN (
      'en_attente_paiement','paye_sequestre','remis',
      'receptionne','clos','litige','annule','rembourse'
    )),
  litige_motif TEXT,

  paye_at        TIMESTAMPTZ,
  remis_at       TIMESTAMPTZ,
  receptionne_at TIMESTAMPTZ,
  clos_at        TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- On n'achète pas son propre livre.
  CONSTRAINT commande_pas_soi_meme CHECK (acheteur_id <> vendeur_id)
);

CREATE INDEX IF NOT EXISTS idx_cmd_occasion_acheteur ON commandes_occasion(acheteur_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmd_occasion_vendeur  ON commandes_occasion(vendeur_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmd_occasion_statut   ON commandes_occasion(statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmd_occasion_paiement ON commandes_occasion(paiement_id);

ALTER TABLE commandes_occasion ENABLE ROW LEVEL SECURITY;

-- Acheteur et vendeur voient leur commande ; personne d'autre.
DROP POLICY IF EXISTS "cmd_occasion_lecture_parties" ON commandes_occasion;
CREATE POLICY "cmd_occasion_lecture_parties" ON commandes_occasion
  FOR SELECT USING (auth.uid() = acheteur_id OR auth.uid() = vendeur_id);

-- Aucune écriture directe client : tout passe par les RPC SECURITY DEFINER
-- (les transitions déplacent de l'argent, cf. ERROR_LOG 2026-06-23).

CREATE OR REPLACE FUNCTION toucher_cmd_occasion_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cmd_occasion_updated_at ON commandes_occasion;
CREATE TRIGGER trg_cmd_occasion_updated_at
  BEFORE UPDATE ON commandes_occasion
  FOR EACH ROW EXECUTE FUNCTION toucher_cmd_occasion_updated_at();

-- ============================================================
-- Évaluations vendeur (confiance) — visibles publiquement
-- ============================================================

CREATE TABLE IF NOT EXISTS vendeur_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID NOT NULL UNIQUE REFERENCES commandes_occasion(id) ON DELETE CASCADE,
  vendeur_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acheteur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note INT NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire TEXT CHECK (commentaire IS NULL OR char_length(commentaire) <= 500),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendeur_eval_vendeur ON vendeur_evaluations(vendeur_id);

ALTER TABLE vendeur_evaluations ENABLE ROW LEVEL SECURITY;

-- La réputation d'un vendeur est publique (elle sert la confiance).
DROP POLICY IF EXISTS "vendeur_eval_lecture_publique" ON vendeur_evaluations;
CREATE POLICY "vendeur_eval_lecture_publique" ON vendeur_evaluations
  FOR SELECT USING (true);

-- ============================================================
-- RPC creer_commande_occasion — l'acheteur réserve une annonce
-- ============================================================

CREATE OR REPLACE FUNCTION creer_commande_occasion(
  p_offre_id UUID,
  p_mode_remise TEXT DEFAULT 'main_propre',
  p_remise_infos JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offre    livre_offres%ROWTYPE;
  v_user     UUID := auth.uid();
  v_commission INT;
  v_montant  INT;
  v_cmd_id   UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous pour commander.';
  END IF;

  SELECT * INTO v_offre FROM livre_offres WHERE id = p_offre_id FOR UPDATE;

  IF v_offre.id IS NULL THEN
    RAISE EXCEPTION 'Annonce introuvable.';
  END IF;
  IF v_offre.type <> 'occasion' THEN
    RAISE EXCEPTION 'Cette annonce n''est pas une offre d''occasion.';
  END IF;
  IF v_offre.statut <> 'active' THEN
    RAISE EXCEPTION 'Cette annonce n''est plus disponible.';
  END IF;
  IF v_offre.vendeur_id = v_user THEN
    RAISE EXCEPTION 'Vous ne pouvez pas acheter votre propre annonce.';
  END IF;
  IF v_offre.stock IS NOT NULL AND v_offre.stock < 1 THEN
    RAISE EXCEPTION 'Article épuisé.';
  END IF;

  v_montant := round(v_offre.prix)::INT;
  IF v_montant < 100 THEN
    RAISE EXCEPTION 'Prix invalide.';
  END IF;

  -- Commission plateforme 20 % ; le reste au vendeur ; l'auteur ne touche rien.
  -- La plateforme porte les frais Fapshi (D16) : le vendeur reçoit prix - commission.
  v_commission := round(v_montant * 20 / 100.0)::INT;

  INSERT INTO commandes_occasion (
    offre_id, livre_id, acheteur_id, vendeur_id,
    montant_xaf, commission_xaf, montant_vendeur_xaf, devise,
    mode_remise, remise_infos, statut
  ) VALUES (
    v_offre.id, v_offre.livre_id, v_user, v_offre.vendeur_id,
    v_montant, v_commission, v_montant - v_commission, COALESCE(v_offre.devise, 'XAF'),
    COALESCE(p_mode_remise, 'main_propre'), COALESCE(p_remise_infos, '{}'::jsonb),
    'en_attente_paiement'
  )
  RETURNING id INTO v_cmd_id;

  RETURN v_cmd_id;
END;
$$;

-- ============================================================
-- RPC confirmer_remise — le VENDEUR déclare avoir remis/expédié
-- ============================================================

CREATE OR REPLACE FUNCTION confirmer_remise(p_commande_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_cmd commandes_occasion%ROWTYPE;
BEGIN
  SELECT * INTO v_cmd FROM commandes_occasion WHERE id = p_commande_id FOR UPDATE;
  IF v_cmd.id IS NULL THEN RAISE EXCEPTION 'Commande introuvable.'; END IF;
  IF v_cmd.vendeur_id <> auth.uid() THEN RAISE EXCEPTION 'Seul le vendeur peut confirmer la remise.'; END IF;
  IF v_cmd.statut <> 'paye_sequestre' THEN RAISE EXCEPTION 'La remise n''est possible qu''après paiement.'; END IF;

  UPDATE commandes_occasion SET statut = 'remis', remis_at = now() WHERE id = p_commande_id;
END;
$$;

-- ============================================================
-- RPC confirmer_reception — l'ACHETEUR confirme → libère le vendeur
-- ============================================================

CREATE OR REPLACE FUNCTION confirmer_reception(p_commande_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_cmd commandes_occasion%ROWTYPE;
BEGIN
  SELECT * INTO v_cmd FROM commandes_occasion WHERE id = p_commande_id FOR UPDATE;
  IF v_cmd.id IS NULL THEN RAISE EXCEPTION 'Commande introuvable.'; END IF;
  IF v_cmd.acheteur_id <> auth.uid() THEN RAISE EXCEPTION 'Seul l''acheteur peut confirmer la réception.'; END IF;
  IF v_cmd.statut <> 'remis' THEN RAISE EXCEPTION 'Rien à confirmer pour cette commande.'; END IF;

  -- Réception confirmée → clôture → le vendeur doit être payé (payout externe).
  UPDATE commandes_occasion
     SET statut = 'clos',
         receptionne_at = now(),
         clos_at = now(),
         fonds_liberes = true,
         payout_statut = 'a_verser'
   WHERE id = p_commande_id;
END;
$$;

-- ============================================================
-- RPC ouvrir_litige — acheteur OU vendeur, gèle la commande
-- ============================================================

CREATE OR REPLACE FUNCTION ouvrir_litige(p_commande_id UUID, p_motif TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_cmd commandes_occasion%ROWTYPE;
BEGIN
  SELECT * INTO v_cmd FROM commandes_occasion WHERE id = p_commande_id FOR UPDATE;
  IF v_cmd.id IS NULL THEN RAISE EXCEPTION 'Commande introuvable.'; END IF;
  IF auth.uid() NOT IN (v_cmd.acheteur_id, v_cmd.vendeur_id) THEN
    RAISE EXCEPTION 'Seules les parties peuvent ouvrir un litige.';
  END IF;
  IF v_cmd.statut NOT IN ('paye_sequestre','remis') THEN
    RAISE EXCEPTION 'Aucun litige possible à ce stade.';
  END IF;

  UPDATE commandes_occasion
     SET statut = 'litige', litige_motif = left(COALESCE(p_motif, ''), 500)
   WHERE id = p_commande_id;
END;
$$;

-- ============================================================
-- RPC evaluer_vendeur — l'acheteur note le vendeur après clôture
-- ============================================================

CREATE OR REPLACE FUNCTION evaluer_vendeur(p_commande_id UUID, p_note INT, p_commentaire TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_cmd commandes_occasion%ROWTYPE;
BEGIN
  IF p_note < 1 OR p_note > 5 THEN RAISE EXCEPTION 'Note attendue entre 1 et 5.'; END IF;

  SELECT * INTO v_cmd FROM commandes_occasion WHERE id = p_commande_id;
  IF v_cmd.id IS NULL THEN RAISE EXCEPTION 'Commande introuvable.'; END IF;
  IF v_cmd.acheteur_id <> auth.uid() THEN RAISE EXCEPTION 'Seul l''acheteur peut évaluer.'; END IF;
  IF v_cmd.statut <> 'clos' THEN RAISE EXCEPTION 'Évaluation possible seulement après clôture.'; END IF;

  INSERT INTO vendeur_evaluations (commande_id, vendeur_id, acheteur_id, note, commentaire)
  VALUES (p_commande_id, v_cmd.vendeur_id, v_cmd.acheteur_id, p_note, left(p_commentaire, 500))
  ON CONFLICT (commande_id) DO UPDATE SET note = EXCLUDED.note, commentaire = EXCLUDED.commentaire;
END;
$$;

REVOKE ALL ON FUNCTION creer_commande_occasion(UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION confirmer_remise(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION confirmer_reception(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION ouvrir_litige(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION evaluer_vendeur(UUID, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION creer_commande_occasion(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION confirmer_remise(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION confirmer_reception(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ouvrir_litige(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION evaluer_vendeur(UUID, INT, TEXT) TO authenticated;

-- ============================================================
-- V013__annonce_occasion.sql
-- ============================================================
-- ============================================================
-- V013 — Création d'une annonce d'occasion (P4 #14)
-- Un vendeur d'occasion n'est pas l'auteur du livre : il ne peut donc pas
-- créer la fiche `livres` (bloquée par le RLS auteur). Cette RPC résout le
-- problème côté serveur : elle retrouve la fiche par ISBN ou en crée une
-- minimale (catalogue « import », sans auteur), puis crée l'offre occasion.
--
-- Répartition (D15/D16) : commission 20 %, la plateforme porte les frais
-- Fapshi. Le calcul de ce que touche le vendeur est fait à la commande
-- (creer_commande_occasion, V012) — ici on ne fait que publier l'annonce.
-- ============================================================

CREATE OR REPLACE FUNCTION creer_annonce_occasion(
  p_titre TEXT,
  p_auteur TEXT DEFAULT NULL,
  p_isbn TEXT DEFAULT NULL,
  p_etat TEXT DEFAULT 'bon',
  p_prix NUMERIC DEFAULT 0,
  p_ville TEXT DEFAULT NULL,
  p_mode_remise TEXT DEFAULT 'main_propre',
  p_photos JSONB DEFAULT '[]'::jsonb,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_titre   TEXT := btrim(COALESCE(p_titre, ''));
  v_isbn    TEXT := NULLIF(regexp_replace(COALESCE(p_isbn, ''), '[^0-9Xx]', '', 'g'), '');
  v_prix    INT  := round(COALESCE(p_prix, 0))::INT;
  v_livre_id UUID;
  v_offre_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous pour vendre.';
  END IF;
  IF char_length(v_titre) < 2 THEN
    RAISE EXCEPTION 'Le titre du livre est requis.';
  END IF;
  IF v_prix < 100 THEN
    RAISE EXCEPTION 'Le prix doit être d''au moins 100 FCFA.';
  END IF;
  IF p_etat NOT IN ('neuf','comme_neuf','bon','correct','use') THEN
    RAISE EXCEPTION 'État du livre invalide.';
  END IF;
  IF p_mode_remise NOT IN ('main_propre','point_relais','livraison') THEN
    RAISE EXCEPTION 'Mode de remise invalide.';
  END IF;

  -- 1. Retrouver la fiche livre par ISBN, sinon en créer une (catalogue import).
  IF v_isbn IS NOT NULL THEN
    SELECT id INTO v_livre_id
    FROM livres
    WHERE isbn13 = v_isbn OR isbn10 = v_isbn
    LIMIT 1;
  END IF;

  IF v_livre_id IS NULL THEN
    INSERT INTO livres (titre, auteur_id, isbn13, type_catalogue, statut, metadata)
    VALUES (
      v_titre,
      NULL,                                   -- occasion : pas d'auteur-membre
      CASE WHEN v_isbn IS NOT NULL AND char_length(v_isbn) = 13 THEN v_isbn END,
      'import',
      'actif',
      jsonb_build_object('auteur_nom', NULLIF(btrim(COALESCE(p_auteur, '')), ''))
    )
    RETURNING id INTO v_livre_id;
  END IF;

  -- 2. Créer l'offre occasion (le vendeur est bien auth.uid()).
  INSERT INTO livre_offres (
    livre_id, vendeur_id, type, statut, prix, devise, stock, conditions
  ) VALUES (
    v_livre_id, v_user, 'occasion', 'active', v_prix, 'XAF', 1,
    jsonb_build_object(
      'etat', p_etat,
      'ville', NULLIF(btrim(COALESCE(p_ville, '')), ''),
      'mode_remise', p_mode_remise,
      'photos', COALESCE(p_photos, '[]'::jsonb),
      'description', NULLIF(btrim(COALESCE(p_description, '')), ''),
      'auteur_nom', NULLIF(btrim(COALESCE(p_auteur, '')), '')
    )
  )
  RETURNING id INTO v_offre_id;

  RETURN v_offre_id;
END;
$$;

REVOKE ALL ON FUNCTION creer_annonce_occasion(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION creer_annonce_occasion(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, TEXT) TO authenticated;

-- ============================================================
-- V014__pret_numerique.sql
-- ============================================================
-- ============================================================
-- V014 — Emprunter : prêt numérique à accès temporel + file d'attente (P4 #15)
-- Objectif : reproduire le prêt de bibliothèque sur le fonds maison
-- (D6 : limité aux livres que Kalamundi a le droit de prêter).
--
-- Le "fonds maison" = les livre_offres.type='pret_numerique' créées côté
-- admin/auteur : `stock` = nombre d'exemplaires prêtables en parallèle,
-- `duree_acces_jours` = durée du prêt (défaut 14 jours si non précisé).
--
-- L'accès en lecture réutilise la table acces_premium existante (même
-- porte que l'achat, cf. api.verifierAccesPremium) : un prêt actif y
-- ajoute une ligne avec expire_le renseigné et emprunt_id pour la tracer.
-- Un achat (paiement_id renseigné) n'expire jamais et n'est jamais touché
-- par l'expiration des prêts (cf. expirer_emprunts ci-dessous).
-- ============================================================

ALTER TABLE acces_premium
  ADD COLUMN IF NOT EXISTS expire_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS emprunt_id UUID;

CREATE TABLE IF NOT EXISTS emprunts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offre_id UUID NOT NULL REFERENCES livre_offres(id) ON DELETE RESTRICT,
  livre_id UUID NOT NULL REFERENCES livres(id) ON DELETE RESTRICT,
  oeuvre_id UUID REFERENCES oeuvres(id) ON DELETE SET NULL,
  emprunteur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  statut TEXT NOT NULL DEFAULT 'actif'
    CHECK (statut IN ('actif','rendu','expire')),
  emprunte_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  expire_le TIMESTAMPTZ NOT NULL,
  rendu_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'acces_premium_emprunt_fk'
  ) THEN
    ALTER TABLE acces_premium
      ADD CONSTRAINT acces_premium_emprunt_fk
      FOREIGN KEY (emprunt_id) REFERENCES emprunts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Un seul prêt actif par (offre, emprunteur) — pas d'emprunts en double.
CREATE UNIQUE INDEX IF NOT EXISTS idx_emprunts_actif_unique
  ON emprunts(offre_id, emprunteur_id) WHERE statut = 'actif';

CREATE INDEX IF NOT EXISTS idx_emprunts_emprunteur ON emprunts(emprunteur_id, statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emprunts_offre_actif ON emprunts(offre_id) WHERE statut = 'actif';
CREATE INDEX IF NOT EXISTS idx_emprunts_expiration ON emprunts(expire_le) WHERE statut = 'actif';

ALTER TABLE emprunts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emprunts_lecture_proprietaire" ON emprunts;
CREATE POLICY "emprunts_lecture_proprietaire" ON emprunts
  FOR SELECT USING (auth.uid() = emprunteur_id);

-- Aucune écriture directe : tout passe par les RPC SECURITY DEFINER
-- (mêmes précautions que l'occasion, cf. ERROR_LOG 2026-06-23).

CREATE TABLE IF NOT EXISTS emprunts_file_attente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offre_id UUID NOT NULL REFERENCES livre_offres(id) ON DELETE CASCADE,
  livre_id UUID NOT NULL REFERENCES livres(id) ON DELETE CASCADE,
  oeuvre_id UUID REFERENCES oeuvres(id) ON DELETE SET NULL,
  utilisateur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  statut TEXT NOT NULL DEFAULT 'attente'
    CHECK (statut IN ('attente','servie','abandonnee')),
  created_at TIMESTAMPTZ DEFAULT now(),
  servie_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_attente_unique
  ON emprunts_file_attente(offre_id, utilisateur_id) WHERE statut = 'attente';

CREATE INDEX IF NOT EXISTS idx_file_attente_offre ON emprunts_file_attente(offre_id, created_at) WHERE statut = 'attente';

ALTER TABLE emprunts_file_attente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "file_attente_lecture_proprietaire" ON emprunts_file_attente;
CREATE POLICY "file_attente_lecture_proprietaire" ON emprunts_file_attente
  FOR SELECT USING (auth.uid() = utilisateur_id);

-- ============================================================
-- Helper interne — promeut le premier de la file quand une place se libère
-- ============================================================

CREATE OR REPLACE FUNCTION promouvoir_file_attente(p_offre_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offre livre_offres%ROWTYPE;
  v_file  emprunts_file_attente%ROWTYPE;
  v_duree INTEGER;
  v_nouvel_emprunt_id UUID;
BEGIN
  SELECT * INTO v_offre FROM livre_offres WHERE id = p_offre_id FOR UPDATE;
  IF v_offre.id IS NULL THEN RETURN; END IF;

  -- Place déjà prise entre-temps ?
  IF v_offre.stock IS NOT NULL AND
     (SELECT COUNT(*) FROM emprunts WHERE offre_id = p_offre_id AND statut = 'actif') >= v_offre.stock THEN
    RETURN;
  END IF;

  SELECT * INTO v_file FROM emprunts_file_attente
    WHERE offre_id = p_offre_id AND statut = 'attente'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  IF v_file.id IS NULL THEN RETURN; END IF;

  v_duree := COALESCE(v_offre.duree_acces_jours, 14);

  INSERT INTO emprunts (offre_id, livre_id, oeuvre_id, emprunteur_id, expire_le)
  VALUES (v_offre.id, v_offre.livre_id, v_file.oeuvre_id, v_file.utilisateur_id, now() + (v_duree || ' days')::interval)
  ON CONFLICT (offre_id, emprunteur_id) WHERE statut = 'actif' DO NOTHING
  RETURNING id INTO v_nouvel_emprunt_id;

  IF v_nouvel_emprunt_id IS NOT NULL THEN
    UPDATE acces_premium
      SET expire_le = now() + (v_duree || ' days')::interval, emprunt_id = v_nouvel_emprunt_id
      WHERE user_id = v_file.utilisateur_id AND oeuvre_id = v_file.oeuvre_id;
    IF NOT FOUND THEN
      INSERT INTO acces_premium (user_id, oeuvre_id, expire_le, emprunt_id)
      VALUES (v_file.utilisateur_id, v_file.oeuvre_id, now() + (v_duree || ' days')::interval, v_nouvel_emprunt_id);
    END IF;

    UPDATE emprunts_file_attente SET statut = 'servie', servie_at = now()
      WHERE offre_id = p_offre_id AND utilisateur_id = v_file.utilisateur_id AND statut = 'attente';
  END IF;
END;
$$;

-- ============================================================
-- RPC emprunter_livre — l'utilisateur emprunte un exemplaire du fonds maison
-- ============================================================

CREATE OR REPLACE FUNCTION emprunter_livre(p_offre_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offre livre_offres%ROWTYPE;
  v_user  UUID := auth.uid();
  v_duree INTEGER;
  v_emprunt_id UUID;
  v_deja_acces BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connectez-vous pour emprunter.';
  END IF;

  SELECT * INTO v_offre FROM livre_offres WHERE id = p_offre_id FOR UPDATE;
  IF v_offre.id IS NULL THEN
    RAISE EXCEPTION 'Offre de prêt introuvable.';
  END IF;
  IF v_offre.type <> 'pret_numerique' THEN
    RAISE EXCEPTION 'Cette offre n''est pas un prêt numérique.';
  END IF;
  IF v_offre.statut <> 'active' THEN
    RAISE EXCEPTION 'Ce prêt n''est plus disponible.';
  END IF;
  IF v_offre.source_oeuvre_id IS NULL THEN
    RAISE EXCEPTION 'Ce livre n''a pas encore d''édition lisible.';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM acces_premium
    WHERE user_id = v_user AND oeuvre_id = v_offre.source_oeuvre_id
      AND (expire_le IS NULL OR expire_le > now())
  ) INTO v_deja_acces;
  IF v_deja_acces THEN
    RAISE EXCEPTION 'Vous avez déjà accès à ce livre.';
  END IF;

  IF v_offre.stock IS NOT NULL AND
     (SELECT COUNT(*) FROM emprunts WHERE offre_id = p_offre_id AND statut = 'actif') >= v_offre.stock THEN
    RAISE EXCEPTION 'file_attente' USING ERRCODE = 'P0001';
  END IF;

  v_duree := COALESCE(v_offre.duree_acces_jours, 14);

  INSERT INTO emprunts (offre_id, livre_id, oeuvre_id, emprunteur_id, expire_le)
  VALUES (v_offre.id, v_offre.livre_id, v_offre.source_oeuvre_id, v_user, now() + (v_duree || ' days')::interval)
  RETURNING id INTO v_emprunt_id;

  INSERT INTO acces_premium (user_id, oeuvre_id, expire_le, emprunt_id)
  VALUES (v_user, v_offre.source_oeuvre_id, now() + (v_duree || ' days')::interval, v_emprunt_id)
  ON CONFLICT (user_id, oeuvre_id) DO UPDATE
    SET expire_le = EXCLUDED.expire_le, emprunt_id = EXCLUDED.emprunt_id;

  -- Si l'utilisateur patientait dans la file, il en sort.
  UPDATE emprunts_file_attente SET statut = 'servie', servie_at = now()
    WHERE offre_id = p_offre_id AND utilisateur_id = v_user AND statut = 'attente';

  RETURN v_emprunt_id;
END;
$$;

-- ============================================================
-- RPC rendre_livre — retour anticipé, libère la place pour la file
-- ============================================================

CREATE OR REPLACE FUNCTION rendre_livre(p_emprunt_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_emprunt emprunts%ROWTYPE;
BEGIN
  SELECT * INTO v_emprunt FROM emprunts WHERE id = p_emprunt_id FOR UPDATE;
  IF v_emprunt.id IS NULL THEN RAISE EXCEPTION 'Emprunt introuvable.'; END IF;
  IF v_emprunt.emprunteur_id <> auth.uid() THEN RAISE EXCEPTION 'Seul l''emprunteur peut rendre ce livre.'; END IF;
  IF v_emprunt.statut <> 'actif' THEN RAISE EXCEPTION 'Cet emprunt n''est plus actif.'; END IF;

  UPDATE emprunts SET statut = 'rendu', rendu_le = now() WHERE id = p_emprunt_id;

  DELETE FROM acces_premium WHERE emprunt_id = p_emprunt_id;

  PERFORM promouvoir_file_attente(v_emprunt.offre_id);
END;
$$;

-- ============================================================
-- RPC rejoindre_file_attente / quitter_file_attente
-- ============================================================

CREATE OR REPLACE FUNCTION rejoindre_file_attente(p_offre_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offre livre_offres%ROWTYPE;
  v_user  UUID := auth.uid();
  v_position INTEGER;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Connectez-vous pour rejoindre la file.'; END IF;

  SELECT * INTO v_offre FROM livre_offres WHERE id = p_offre_id;
  IF v_offre.id IS NULL OR v_offre.type <> 'pret_numerique' THEN
    RAISE EXCEPTION 'Offre de prêt introuvable.';
  END IF;

  IF EXISTS(SELECT 1 FROM emprunts WHERE offre_id = p_offre_id AND emprunteur_id = v_user AND statut = 'actif') THEN
    RAISE EXCEPTION 'Vous avez déjà ce livre en cours d''emprunt.';
  END IF;

  INSERT INTO emprunts_file_attente (offre_id, livre_id, oeuvre_id, utilisateur_id)
  VALUES (v_offre.id, v_offre.livre_id, v_offre.source_oeuvre_id, v_user)
  ON CONFLICT (offre_id, utilisateur_id) WHERE statut = 'attente' DO NOTHING;

  SELECT COUNT(*) INTO v_position FROM emprunts_file_attente
    WHERE offre_id = p_offre_id AND statut = 'attente'
      AND created_at <= (SELECT created_at FROM emprunts_file_attente
                          WHERE offre_id = p_offre_id AND utilisateur_id = v_user AND statut = 'attente');

  RETURN v_position;
END;
$$;

CREATE OR REPLACE FUNCTION quitter_file_attente(p_offre_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE emprunts_file_attente SET statut = 'abandonnee'
    WHERE offre_id = p_offre_id AND utilisateur_id = auth.uid() AND statut = 'attente';
END;
$$;

-- ============================================================
-- RPC expirer_emprunts — appelée par le cron horaire (kalamundi-cron)
-- ============================================================

CREATE OR REPLACE FUNCTION expirer_emprunts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_emprunt RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_emprunt IN
    SELECT * FROM emprunts WHERE statut = 'actif' AND expire_le <= now()
  LOOP
    UPDATE emprunts SET statut = 'expire' WHERE id = v_emprunt.id;
    DELETE FROM acces_premium WHERE emprunt_id = v_emprunt.id;
    PERFORM promouvoir_file_attente(v_emprunt.offre_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION emprunter_livre(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION rendre_livre(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION rejoindre_file_attente(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION quitter_file_attente(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION promouvoir_file_attente(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION expirer_emprunts() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION emprunter_livre(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rendre_livre(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rejoindre_file_attente(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION quitter_file_attente(UUID) TO authenticated;
-- expirer_emprunts est appelée par le cron via la clé anon (pas d'auth utilisateur,
-- ne dépend d'aucune donnée fournie par l'appelant, n'agit que sur les emprunts
-- déjà expirés en base) — cf. kalamundi-cron/index.js.
GRANT EXECUTE ON FUNCTION expirer_emprunts() TO anon, authenticated;

