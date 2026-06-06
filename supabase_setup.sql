-- ============================================================
-- KALAMUNDI — Setup complet base de données
-- Coller dans Supabase SQL Editor et exécuter
-- ============================================================

-- TABLE : profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT,
  pays TEXT,
  langue_preferee TEXT DEFAULT 'fr',
  role TEXT CHECK (role IN ('lecteur', 'auteur', 'institution', 'admin')) DEFAULT 'lecteur',
  niveau_auteur TEXT CHECK (niveau_auteur IN ('amateur', 'confirme', 'professionnel')),
  badge_fondateur BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE : oeuvres
CREATE TABLE oeuvres (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auteur_id UUID REFERENCES profiles(id) NOT NULL,
  titre TEXT NOT NULL,
  genre TEXT NOT NULL,
  resume TEXT,
  langue_originale TEXT NOT NULL DEFAULT 'fr',
  statut TEXT CHECK (statut IN ('gratuit', 'premium')) DEFAULT 'gratuit',
  prix DECIMAL(10,2) DEFAULT 0,
  couverture_url TEXT,
  fichier_url TEXT,
  hash_sha256 TEXT,
  horodatage_blockchain TEXT,
  nb_lectures INTEGER DEFAULT 0,
  note_moyenne DECIMAL(3,2) DEFAULT 0,
  public_cible TEXT DEFAULT 'tous',
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE : chapitres
CREATE TABLE chapitres (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  oeuvre_id UUID REFERENCES oeuvres(id) ON DELETE CASCADE NOT NULL,
  numero INTEGER NOT NULL,
  titre TEXT,
  contenu_texte TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE : traductions
CREATE TABLE traductions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chapitre_id UUID REFERENCES chapitres(id) ON DELETE CASCADE NOT NULL,
  langue_cible TEXT NOT NULL,
  contenu_traduit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chapitre_id, langue_cible)
);

-- TABLE : lectures
CREATE TABLE lectures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  oeuvre_id UUID REFERENCES oeuvres(id) ON DELETE CASCADE NOT NULL,
  chapitre_courant INTEGER DEFAULT 1,
  page_courante INTEGER DEFAULT 1,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, oeuvre_id)
);

-- TABLE : commentaires
CREATE TABLE commentaires (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  oeuvre_id UUID REFERENCES oeuvres(id) ON DELETE CASCADE NOT NULL,
  contenu TEXT NOT NULL,
  note INTEGER CHECK (note BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE : revenus
CREATE TABLE revenus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auteur_id UUID REFERENCES profiles(id) NOT NULL,
  oeuvre_id UUID REFERENCES oeuvres(id),
  type TEXT CHECK (type IN ('pub', 'premium', 'abonnement')) NOT NULL,
  montant DECIMAL(10,2) NOT NULL,
  devise TEXT DEFAULT 'USD',
  statut TEXT CHECK (statut IN ('en_attente', 'paye')) DEFAULT 'en_attente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE : institutions
CREATE TABLE institutions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  nom TEXT NOT NULL,
  type TEXT,
  pays TEXT,
  domaine TEXT,
  logo_url TEXT,
  statut_verification TEXT CHECK (statut_verification IN ('en_attente', 'verifie', 'rejete')) DEFAULT 'en_attente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE : signalements
CREATE TABLE signalements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  oeuvre_id UUID REFERENCES oeuvres(id) ON DELETE CASCADE NOT NULL,
  motif TEXT NOT NULL,
  statut TEXT CHECK (statut IN ('ouvert', 'traite', 'ferme')) DEFAULT 'ouvert',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE : security_logs
CREATE TABLE security_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  ip_address TEXT,
  action TEXT NOT NULL,
  statut TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE oeuvres ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapitres ENABLE ROW LEVEL SECURITY;
ALTER TABLE traductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE commentaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenus ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalements ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profils_lecture_publique" ON profiles FOR SELECT USING (true);
CREATE POLICY "profils_insertion_proprio" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profils_modification_proprio" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Oeuvres
CREATE POLICY "oeuvres_lecture_publique" ON oeuvres FOR SELECT USING (visible = true);
CREATE POLICY "oeuvres_gestion_auteur" ON oeuvres FOR ALL USING (auth.uid() = auteur_id);

-- Chapitres
CREATE POLICY "chapitres_lecture_publique" ON chapitres FOR SELECT USING (true);
CREATE POLICY "chapitres_gestion_auteur" ON chapitres FOR ALL USING (
  auth.uid() = (SELECT auteur_id FROM oeuvres WHERE id = chapitres.oeuvre_id)
);

-- Traductions
CREATE POLICY "traductions_lecture_publique" ON traductions FOR SELECT USING (true);
CREATE POLICY "traductions_insertion_auth" ON traductions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Lectures
CREATE POLICY "lectures_proprio" ON lectures FOR ALL USING (auth.uid() = user_id);

-- Commentaires
CREATE POLICY "commentaires_lecture_publique" ON commentaires FOR SELECT USING (true);
CREATE POLICY "commentaires_insertion_auth" ON commentaires FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "commentaires_suppression_proprio" ON commentaires FOR DELETE USING (auth.uid() = user_id);

-- Revenus
CREATE POLICY "revenus_proprio" ON revenus FOR SELECT USING (auth.uid() = auteur_id);

-- Institutions
CREATE POLICY "institutions_lecture_publique" ON institutions FOR SELECT USING (true);
CREATE POLICY "institutions_gestion_proprio" ON institutions FOR ALL USING (auth.uid() = user_id);

-- Signalements
CREATE POLICY "signalements_insertion_auth" ON signalements FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "signalements_lecture_proprio" ON signalements FOR SELECT USING (auth.uid() = user_id);

-- Security logs (admin uniquement)
CREATE POLICY "security_logs_admin_only" ON security_logs FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- ============================================================
-- TRIGGER : updated_at automatique
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_oeuvres_updated_at
  BEFORE UPDATE ON oeuvres
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_lectures_updated_at
  BEFORE UPDATE ON lectures
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- STORAGE BUCKETS (à créer manuellement dans Storage)
-- 1. "couvertures"     → public
-- 2. "oeuvres-privees" → privé
-- ============================================================
