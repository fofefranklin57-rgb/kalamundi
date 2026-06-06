-- TABLE : paiements (achats + abonnements en attente de confirmation)
CREATE TABLE paiements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  oeuvre_id UUID REFERENCES oeuvres(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('achat_oeuvre','abonnement_reader','abonnement_auteur','abonnement_institution')) NOT NULL,
  montant DECIMAL(10,2) NOT NULL,
  devise TEXT DEFAULT 'USD',
  methode TEXT CHECK (methode IN ('mtn_momo','orange_money','paypal')) NOT NULL,
  reference_transaction TEXT,
  statut TEXT CHECK (statut IN ('en_attente','confirme','rejete')) DEFAULT 'en_attente',
  note_admin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirme_at TIMESTAMPTZ
);

ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;

-- L'utilisateur voit ses propres paiements
CREATE POLICY "paiements_user" ON paiements
  FOR SELECT USING (auth.uid() = user_id);

-- L'utilisateur peut créer un paiement
CREATE POLICY "paiements_insert" ON paiements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Seul l'admin peut confirmer/rejeter (UPDATE)
CREATE POLICY "paiements_admin_update" ON paiements
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seul l'admin peut voir tous les paiements
CREATE POLICY "paiements_admin_select" ON paiements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Colonne abonnement dans profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS abonnement TEXT
  CHECK (abonnement IN ('gratuit','reader_plus','auteur_pro','institution'))
  DEFAULT 'gratuit';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS abonnement_expire_at TIMESTAMPTZ;

-- Colonne acces_premium dans oeuvres (liste des user_id ayant acheté)
-- On utilise une table séparée pour les accès
CREATE TABLE IF NOT EXISTS acces_premium (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  oeuvre_id UUID REFERENCES oeuvres(id) ON DELETE CASCADE NOT NULL,
  paiement_id UUID REFERENCES paiements(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, oeuvre_id)
);

ALTER TABLE acces_premium ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acces_premium_user" ON acces_premium
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "acces_premium_admin" ON acces_premium
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
