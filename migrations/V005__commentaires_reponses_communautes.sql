-- Migration V005 — Reponses aux commentaires + communautes

ALTER TABLE commentaires
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES commentaires(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_commentaires_parent
  ON commentaires(parent_id);

CREATE INDEX IF NOT EXISTS idx_commentaires_oeuvre_parent_created
  ON commentaires(oeuvre_id, parent_id, created_at);

ALTER TABLE paiements
  DROP CONSTRAINT IF EXISTS paiements_methode_check;

ALTER TABLE paiements
  ADD CONSTRAINT paiements_methode_check
    CHECK (methode IN ('mtn_momo','orange_money','paypal','fapshi'));

ALTER TABLE paiements
  DROP CONSTRAINT IF EXISTS paiements_type_check;

ALTER TABLE paiements
  ADD CONSTRAINT paiements_type_check
    CHECK (type IN (
      'achat_oeuvre',
      'abonnement_reader',
      'abonnement_auteur',
      'abonnement_institution',
      'abonnement_etudiant'
    ));

ALTER TABLE revenus
  DROP CONSTRAINT IF EXISTS revenus_type_check;

ALTER TABLE revenus
  ADD CONSTRAINT revenus_type_check
    CHECK (type IN ('pub', 'premium', 'abonnement', 'vente_premium'));

DROP POLICY IF EXISTS "commentaires_insertion_auth" ON commentaires;
CREATE POLICY "commentaires_insertion_auth" ON commentaires
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS communautes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  createur_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  nom TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  theme TEXT,
  langue TEXT DEFAULT 'fr',
  pays TEXT,
  image_url TEXT,
  visibilite TEXT CHECK (visibilite IN ('publique', 'privee')) DEFAULT 'publique',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS communaute_membres (
  communaute_id UUID REFERENCES communautes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('membre', 'moderateur', 'admin')) DEFAULT 'membre',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (communaute_id, user_id)
);

CREATE TABLE IF NOT EXISTS communaute_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  communaute_id UUID REFERENCES communautes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  oeuvre_id UUID REFERENCES oeuvres(id) ON DELETE SET NULL,
  contenu TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_communaute_posts_communaute_created
  ON communaute_posts(communaute_id, created_at DESC);

ALTER TABLE communautes ENABLE ROW LEVEL SECURITY;
ALTER TABLE communaute_membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE communaute_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "communautes_lecture_publique" ON communautes
  FOR SELECT USING (visibilite = 'publique' OR createur_id = auth.uid());

CREATE POLICY "communautes_creation_auth" ON communautes
  FOR INSERT WITH CHECK (auth.uid() = createur_id);

CREATE POLICY "communautes_modification_createur" ON communautes
  FOR UPDATE USING (auth.uid() = createur_id);

CREATE POLICY "membres_lecture_publique" ON communaute_membres
  FOR SELECT USING (true);

CREATE POLICY "membres_join_self" ON communaute_membres
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "membres_quit_self" ON communaute_membres
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "posts_lecture_publique" ON communaute_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM communautes c
      WHERE c.id = communaute_posts.communaute_id
        AND c.visibilite = 'publique'
    )
  );

CREATE POLICY "posts_creation_membre" ON communaute_posts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM communaute_membres m
      WHERE m.communaute_id = communaute_posts.communaute_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "posts_suppression_auteur" ON communaute_posts
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_communautes_updated_at ON communautes;
CREATE TRIGGER trg_communautes_updated_at
  BEFORE UPDATE ON communautes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_communaute_posts_updated_at ON communaute_posts;
CREATE TRIGGER trg_communaute_posts_updated_at
  BEFORE UPDATE ON communaute_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
