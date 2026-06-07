-- ============================================================
-- Kalamundi — Extension du profil utilisateur
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Informations personnelles ─────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS prenom         TEXT,
  ADD COLUMN IF NOT EXISTS telephone      TEXT,
  ADD COLUMN IF NOT EXISTS date_naissance DATE,
  ADD COLUMN IF NOT EXISTS genre_identite TEXT
    CHECK (genre_identite IN ('homme', 'femme', 'non_binaire', 'non_precise')),
  ADD COLUMN IF NOT EXISTS ville          TEXT;

-- ── Présence en ligne ─────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS site_web       TEXT,
  ADD COLUMN IF NOT EXISTS reseaux_sociaux JSONB DEFAULT '{}'::jsonb;
  -- Structure : { "facebook": "url", "twitter": "url", "instagram": "url",
  --              "tiktok": "url", "youtube": "url", "linkedin": "url" }

-- ── Préférences littéraires ───────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS langues_parlees  TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS genres_preferes  TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS genres_ecrits    TEXT[]  DEFAULT '{}';
  -- Ex : ARRAY['roman', 'poesie', 'thriller']

-- ── Compte vérifié ────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS compte_verifie  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS telephone_verifie BOOLEAN DEFAULT false;

-- ── Mettre à jour la politique RLS UPDATE ────────────────────
-- Assurer que chaque utilisateur peut modifier son propre profil
-- (la politique existante couvre déjà ça, mais on s'assure qu'elle existe)

DROP POLICY IF EXISTS "profils_modification_proprio" ON profiles;
CREATE POLICY "profils_modification_proprio"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Les admins peuvent modifier tous les profils
DROP POLICY IF EXISTS "profils_modification_admin" ON profiles;
CREATE POLICY "profils_modification_admin"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
