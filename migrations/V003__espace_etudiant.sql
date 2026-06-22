-- ============================================================
-- Migration V003 — Espace Étudiant : Fax, Épreuves, Concours
-- Kalamundi — À exécuter dans Supabase SQL Editor
-- ============================================================
-- Ordre d'exécution : après V001 et V002
-- Tables créées :
--   etablissements, filieres, epreuves, corriges,
--   acces_corriges, favoris_etudiant, votes_corriges
-- ============================================================


-- ============================================================
-- 0. MISE À JOUR DES CONTRAINTES EXISTANTES
-- ============================================================

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('lecteur','auteur','tuteur','etudiant','institution','admin'));

ALTER TABLE paiements
  DROP CONSTRAINT IF EXISTS paiements_type_check;
ALTER TABLE paiements
  ADD CONSTRAINT paiements_type_check
    CHECK (type IN (
      'achat_oeuvre',
      'abonnement_reader',
      'abonnement_auteur',
      'abonnement_institution',
      'acces_corrige',
      'abonnement_etudiant'
    ));


-- ============================================================
-- 1. ÉTABLISSEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS etablissements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  nom         TEXT NOT NULL,
  nom_court   TEXT,
  type        TEXT NOT NULL CHECK (type IN (
                 'universite','grande_ecole','iut','preparatoire','national'
               )),
  pays        TEXT DEFAULT 'Cameroun',
  ville       TEXT,
  logo_url    TEXT,
  site_web    TEXT,
  description TEXT,
  actif       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE etablissements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "etab_public_read" ON etablissements FOR SELECT USING (actif = true);
CREATE POLICY "etab_admin_all"   ON etablissements FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');


-- ============================================================
-- 2. FILIÈRES
-- ============================================================
CREATE TABLE IF NOT EXISTS filieres (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID REFERENCES etablissements(id) ON DELETE SET NULL,
  code             TEXT NOT NULL,
  nom              TEXT NOT NULL,
  categorie        TEXT NOT NULL,
  niveau           TEXT,
  description      TEXT,
  icone            TEXT DEFAULT '',
  actif            BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE filieres ADD CONSTRAINT filieres_categorie_check CHECK (categorie IN (
  'droit_sciences_juridiques','medecine_sante','sciences_exactes',
  'sciences_humaines','lettres_langues','economie_gestion',
  'informatique_tech','sciences_education','agronomie',
  'architecture','concours_grandes_ecoles','concours_fonctions_publiques','autre'
));

ALTER TABLE filieres ADD CONSTRAINT filieres_niveau_check CHECK (niveau IN (
  'L1','L2','L3','M1','M2','Doctorat',
  'PCEM1','PCEM2','DCEM1','DCEM2','DCEM3','DCEM4',
  'BTS1','BTS2','DUT1','DUT2','Concours','Prepa'
));

ALTER TABLE filieres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "filieres_public_read" ON filieres FOR SELECT USING (actif = true);
CREATE POLICY "filieres_admin_all"   ON filieres FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE INDEX IF NOT EXISTS idx_filieres_etablissement ON filieres(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_filieres_categorie     ON filieres(categorie);
CREATE INDEX IF NOT EXISTS idx_filieres_niveau        ON filieres(niveau);


-- ============================================================
-- 3. ÉPREUVES (sujets — gratuits)
-- ============================================================
CREATE TABLE IF NOT EXISTS epreuves (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filiere_id         UUID NOT NULL REFERENCES filieres(id) ON DELETE CASCADE,
  etablissement_id   UUID REFERENCES etablissements(id) ON DELETE SET NULL,
  matiere            TEXT NOT NULL,
  annee              INT  NOT NULL CHECK (annee BETWEEN 1990 AND 2035),
  semestre           TEXT CHECK (semestre IN ('S1','S2','Annuel','Non précisé')) DEFAULT 'Non précisé',
  type_epreuve       TEXT NOT NULL CHECK (type_epreuve IN (
                       'cc','session_normale','rattrapage','concours','td','tp','partiel'
                     )),
  fichier_url        TEXT,
  apercu_url         TEXT,
  description        TEXT,
  nb_pages           INT,
  a_corrige          BOOLEAN DEFAULT false,
  visible            BOOLEAN DEFAULT true,
  uploadeur_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  nb_telechargements INT DEFAULT 0,
  nb_vues            INT DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE epreuves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "epreuves_public_read"    ON epreuves FOR SELECT USING (visible = true);
CREATE POLICY "epreuves_tuteur_insert"  ON epreuves FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('tuteur','admin'));
CREATE POLICY "epreuves_tuteur_update"  ON epreuves FOR UPDATE TO authenticated
  USING (uploadeur_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "epreuves_admin_delete"   ON epreuves FOR DELETE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE INDEX IF NOT EXISTS idx_epreuves_filiere       ON epreuves(filiere_id);
CREATE INDEX IF NOT EXISTS idx_epreuves_etablissement ON epreuves(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_epreuves_matiere       ON epreuves(matiere);
CREATE INDEX IF NOT EXISTS idx_epreuves_annee         ON epreuves(annee);
CREATE INDEX IF NOT EXISTS idx_epreuves_type          ON epreuves(type_epreuve);


-- ============================================================
-- 4. CORRIGÉS — "les fax" (sans policy premium pour l'instant)
-- ============================================================
CREATE TABLE IF NOT EXISTS corriges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epreuve_id    UUID NOT NULL REFERENCES epreuves(id) ON DELETE CASCADE,
  auteur_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source        TEXT NOT NULL CHECK (source IN ('humain','ia','officiel')),
  statut        TEXT NOT NULL CHECK (statut IN ('gratuit','premium')) DEFAULT 'premium',
  prix_fcfa     INT  DEFAULT 500 CHECK (prix_fcfa >= 0),
  fichier_url   TEXT,
  contenu_texte TEXT,
  note_qualite  DECIMAL(2,1) DEFAULT 0,
  nb_votes      INT DEFAULT 0,
  verifie       BOOLEAN DEFAULT false,
  visible       BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE corriges ENABLE ROW LEVEL SECURITY;

-- Lecture des corrigés gratuits : tout le monde
CREATE POLICY "corriges_gratuit_read" ON corriges FOR SELECT
  USING (visible = true AND statut = 'gratuit');

-- Insert/update par tuteur ou admin
CREATE POLICY "corriges_tuteur_insert" ON corriges FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('tuteur','admin'));
CREATE POLICY "corriges_tuteur_update" ON corriges FOR UPDATE TO authenticated
  USING (auteur_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE INDEX IF NOT EXISTS idx_corriges_epreuve ON corriges(epreuve_id);
CREATE INDEX IF NOT EXISTS idx_corriges_auteur  ON corriges(auteur_id);
CREATE INDEX IF NOT EXISTS idx_corriges_source  ON corriges(source);


-- ============================================================
-- 5. ACCÈS CORRIGES (achats individuels)
-- Créé AVANT la policy premium sur corriges
-- ============================================================
CREATE TABLE IF NOT EXISTS acces_corriges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  corrige_id  UUID NOT NULL REFERENCES corriges(id) ON DELETE CASCADE,
  paiement_id UUID REFERENCES paiements(id) ON DELETE SET NULL,
  expire_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, corrige_id)
);

ALTER TABLE acces_corriges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acces_corriges_user"   ON acces_corriges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "acces_corriges_insert" ON acces_corriges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "acces_corriges_admin"  ON acces_corriges FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE INDEX IF NOT EXISTS idx_acces_corriges_user    ON acces_corriges(user_id);
CREATE INDEX IF NOT EXISTS idx_acces_corriges_corrige ON acces_corriges(corrige_id);


-- ============================================================
-- 6. POLICY PREMIUM CORRIGES (maintenant que acces_corriges existe)
-- ============================================================
CREATE POLICY "corriges_premium_read" ON corriges FOR SELECT TO authenticated
  USING (
    visible = true AND (
      statut = 'gratuit'
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
      OR auteur_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM acces_corriges ac
        WHERE ac.corrige_id = corriges.id
          AND ac.user_id    = auth.uid()
          AND (ac.expire_at IS NULL OR ac.expire_at > NOW())
      )
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.abonnement IN ('reader_plus','auteur_pro','institution')
          AND (p.abonnement_expire_at IS NULL OR p.abonnement_expire_at > NOW())
      )
    )
  );


-- ============================================================
-- 7. FAVORIS ÉTUDIANT
-- ============================================================
CREATE TABLE IF NOT EXISTS favoris_etudiant (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  epreuve_id UUID REFERENCES epreuves(id)  ON DELETE CASCADE,
  corrige_id UUID REFERENCES corriges(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fav_un_seul CHECK (
    (epreuve_id IS NOT NULL AND corrige_id IS NULL) OR
    (epreuve_id IS NULL     AND corrige_id IS NOT NULL)
  )
);

ALTER TABLE favoris_etudiant ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favoris_user_all" ON favoris_etudiant FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 8. VOTES QUALITÉ CORRIGÉS
-- ============================================================
CREATE TABLE IF NOT EXISTS votes_corriges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corrige_id UUID NOT NULL REFERENCES corriges(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note       INT  NOT NULL CHECK (note BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(corrige_id, user_id)
);

ALTER TABLE votes_corriges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_read"   ON votes_corriges FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON votes_corriges FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "votes_update" ON votes_corriges FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION maj_note_corrige()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE corriges SET
    note_qualite = (SELECT ROUND(AVG(note)::numeric,1) FROM votes_corriges WHERE corrige_id = COALESCE(NEW.corrige_id, OLD.corrige_id)),
    nb_votes     = (SELECT COUNT(*) FROM votes_corriges WHERE corrige_id = COALESCE(NEW.corrige_id, OLD.corrige_id))
  WHERE id = COALESCE(NEW.corrige_id, OLD.corrige_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trig_note_corrige ON votes_corriges;
CREATE TRIGGER trig_note_corrige
AFTER INSERT OR UPDATE OR DELETE ON votes_corriges
FOR EACH ROW EXECUTE FUNCTION maj_note_corrige();


-- ============================================================
-- 9. FONCTIONS UTILITAIRES
-- ============================================================

CREATE OR REPLACE FUNCTION incrementer_vue_epreuve(p_epreuve_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE epreuves SET nb_vues = nb_vues + 1 WHERE id = p_epreuve_id;
END;
$$;

CREATE OR REPLACE FUNCTION incrementer_telechargement_epreuve(p_epreuve_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE epreuves SET nb_telechargements = nb_telechargements + 1 WHERE id = p_epreuve_id;
END;
$$;

CREATE OR REPLACE FUNCTION maj_a_corrige()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE epreuves SET a_corrige = true WHERE id = NEW.epreuve_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE epreuves SET a_corrige = (
      EXISTS (SELECT 1 FROM corriges WHERE epreuve_id = OLD.epreuve_id AND visible = true)
    ) WHERE id = OLD.epreuve_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trig_a_corrige ON corriges;
CREATE TRIGGER trig_a_corrige
AFTER INSERT OR DELETE ON corriges
FOR EACH ROW EXECUTE FUNCTION maj_a_corrige();


-- ============================================================
-- 10. SEED — ÉTABLISSEMENTS CAMEROUN
-- ============================================================
INSERT INTO etablissements (code, nom, nom_court, type, ville) VALUES
  ('UY1',              'Université de Yaoundé I',                                   'UY1',         'universite',    'Yaoundé'),
  ('UY2',              'Université de Yaoundé II (Soa)',                             'UY2',         'universite',    'Soa'),
  ('UD',               'Université de Douala',                                       'UD',          'universite',    'Douala'),
  ('UDSCHANG',         'Université de Dschang',                                      'UDS',         'universite',    'Dschang'),
  ('UBUEA',            'University of Buea',                                         'UB',          'universite',    'Buea'),
  ('UNGAOU',           'Université de Ngaoundéré',                                   'UN',          'universite',    'Ngaoundéré'),
  ('UMAROUA',          'Université de Maroua',                                       'UM',          'universite',    'Maroua'),
  ('UBAMENDA',         'Université de Bamenda',                                      'UBA',         'universite',    'Bamenda'),
  ('ENAM',             'École Nationale d''Administration et de Magistrature',       'ENAM',        'grande_ecole',  'Yaoundé'),
  ('ENSET',            'École Normale Supérieure d''Enseignement Technique',         'ENSET',       'grande_ecole',  'Douala'),
  ('ENS',              'École Normale Supérieure de Yaoundé',                        'ENS',         'grande_ecole',  'Yaoundé'),
  ('EMIA',             'École Militaire Inter-Armes',                                'EMIA',        'grande_ecole',  'Yaoundé'),
  ('ESSEC',            'École Supérieure des Sciences Économiques et Commerciales',  'ESSEC',       'grande_ecole',  'Douala'),
  ('IRIC',             'Institut des Relations Internationales du Cameroun',         'IRIC',        'grande_ecole',  'Yaoundé'),
  ('FMSB',             'Faculté de Médecine et des Sciences Biomédicales (UY1)',     'FMSB',        'grande_ecole',  'Yaoundé'),
  ('CUSS',             'Centre Universitaire des Sciences de la Santé (Yaoundé)',    'CUSS',        'grande_ecole',  'Yaoundé'),
  ('IUT_DOUALA',       'IUT de Douala',                                              'IUT-D',       'iut',           'Douala'),
  ('IUT_NGAOU',        'IUT de Ngaoundéré',                                          'IUT-N',       'iut',           'Ngaoundéré'),
  ('IUT_BANDJOUN',     'IUT de Bandjoun',                                            'IUT-B',       'iut',           'Bandjoun'),
  ('CONCOURS_POLICE',  'Concours Police Nationale Cameroun',                         'Police',      'national',      NULL),
  ('CONCOURS_GEND',    'Concours Gendarmerie Nationale',                             'Gendarmerie', 'national',      NULL),
  ('CONCOURS_FP',      'Concours Fonctions Publiques',                               'FP',          'national',      NULL),
  ('CONCOURS_MAGISTRATURE', 'Concours Magistrature',                                'Magistrature','national',      NULL)
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 11. SEED — FILIÈRES (generiques + ecoles specifiques)
-- Filieres communes : etablissement_id = NULL (toutes universites)
-- Filieres specifiques : liees a l'etablissement unique
-- L'etablissement_id de l'epreuve indique quelle universite a pose le sujet
-- ============================================================

-- ── DROIT / SCIENCES JURIDIQUES ──────────────────────────────
INSERT INTO filieres (code, nom, categorie, niveau, icone) VALUES
  ('DROIT_L1', 'Droit — L1', 'droit_sciences_juridiques', 'L1', '⚖️'),
  ('DROIT_L2', 'Droit — L2', 'droit_sciences_juridiques', 'L2', '⚖️'),
  ('DROIT_L3', 'Droit — L3', 'droit_sciences_juridiques', 'L3', '⚖️'),
  ('DROIT_M1', 'Droit — M1', 'droit_sciences_juridiques', 'M1', '⚖️'),
  ('DROIT_M2', 'Droit — M2', 'droit_sciences_juridiques', 'M2', '⚖️')
ON CONFLICT DO NOTHING;

-- ── ÉCONOMIE / GESTION ───────────────────────────────────────
INSERT INTO filieres (code, nom, categorie, niveau, icone) VALUES
  ('ECO_L1',     'Économie — L1',     'economie_gestion', 'L1', '📈'),
  ('ECO_L2',     'Économie — L2',     'economie_gestion', 'L2', '📈'),
  ('ECO_L3',     'Économie — L3',     'economie_gestion', 'L3', '📈'),
  ('GESTION_L1', 'Gestion — L1',      'economie_gestion', 'L1', '📊'),
  ('GESTION_L2', 'Gestion — L2',      'economie_gestion', 'L2', '📊'),
  ('GESTION_L3', 'Gestion — L3',      'economie_gestion', 'L3', '📊'),
  ('GESTION_M1', 'Gestion — M1',      'economie_gestion', 'M1', '📊'),
  ('COMPTA_L1',  'Comptabilité — L1', 'economie_gestion', 'L1', '🧾'),
  ('COMPTA_L2',  'Comptabilité — L2', 'economie_gestion', 'L2', '🧾')
ON CONFLICT DO NOTHING;

-- ── SCIENCES EXACTES ─────────────────────────────────────────
INSERT INTO filieres (code, nom, categorie, niveau, icone) VALUES
  ('MATHS_L1',    'Mathématiques — L1',    'sciences_exactes', 'L1', '📐'),
  ('MATHS_L2',    'Mathématiques — L2',    'sciences_exactes', 'L2', '📐'),
  ('MATHS_L3',    'Mathématiques — L3',    'sciences_exactes', 'L3', '📐'),
  ('PHYSIQUE_L1', 'Physique — L1',          'sciences_exactes', 'L1', '⚡'),
  ('PHYSIQUE_L2', 'Physique — L2',          'sciences_exactes', 'L2', '⚡'),
  ('PHYSIQUE_L3', 'Physique — L3',          'sciences_exactes', 'L3', '⚡'),
  ('CHIMIE_L1',   'Chimie — L1',            'sciences_exactes', 'L1', '🧪'),
  ('CHIMIE_L2',   'Chimie — L2',            'sciences_exactes', 'L2', '🧪'),
  ('SVT_L1',      'Sciences de la Vie — L1','sciences_exactes', 'L1', '🧬'),
  ('SVT_L2',      'Sciences de la Vie — L2','sciences_exactes', 'L2', '🧬'),
  ('SVT_L3',      'Sciences de la Vie — L3','sciences_exactes', 'L3', '🧬')
ON CONFLICT DO NOTHING;

-- ── INFORMATIQUE ─────────────────────────────────────────────
INSERT INTO filieres (code, nom, categorie, niveau, icone) VALUES
  ('INFO_L1', 'Informatique — L1', 'informatique_tech', 'L1', '💻'),
  ('INFO_L2', 'Informatique — L2', 'informatique_tech', 'L2', '💻'),
  ('INFO_L3', 'Informatique — L3', 'informatique_tech', 'L3', '💻'),
  ('INFO_M1', 'Informatique — M1', 'informatique_tech', 'M1', '💻'),
  ('INFO_M2', 'Informatique — M2', 'informatique_tech', 'M2', '💻')
ON CONFLICT DO NOTHING;

-- ── LETTRES / LANGUES ────────────────────────────────────────
INSERT INTO filieres (code, nom, categorie, niveau, icone) VALUES
  ('LETTRES_L1', 'Lettres Modernes — L1', 'lettres_langues', 'L1', '📖'),
  ('LETTRES_L2', 'Lettres Modernes — L2', 'lettres_langues', 'L2', '📖'),
  ('LETTRES_L3', 'Lettres Modernes — L3', 'lettres_langues', 'L3', '📖'),
  ('ANGLAIS_L1', 'Anglais — L1',           'lettres_langues', 'L1', '🇬🇧'),
  ('ANGLAIS_L2', 'Anglais — L2',           'lettres_langues', 'L2', '🇬🇧'),
  ('ANGLAIS_L3', 'Anglais — L3',           'lettres_langues', 'L3', '🇬🇧')
ON CONFLICT DO NOTHING;

-- ── SCIENCES HUMAINES ────────────────────────────────────────
INSERT INTO filieres (code, nom, categorie, niveau, icone) VALUES
  ('HIST_L1',    'Histoire — L1',          'sciences_humaines', 'L1', '🌍'),
  ('HIST_L2',    'Histoire — L2',          'sciences_humaines', 'L2', '🌍'),
  ('GEO_L1',     'Géographie — L1',        'sciences_humaines', 'L1', '🗺️'),
  ('GEO_L2',     'Géographie — L2',        'sciences_humaines', 'L2', '🗺️'),
  ('SOCIO_L1',   'Sociologie — L1',        'sciences_humaines', 'L1', '👥'),
  ('SOCIO_L2',   'Sociologie — L2',        'sciences_humaines', 'L2', '👥'),
  ('PHILO_L1',   'Philosophie — L1',       'sciences_humaines', 'L1', '🧠'),
  ('PSYCHO_L1',  'Psychologie — L1',       'sciences_humaines', 'L1', '🧠'),
  ('SCI_POL_L1', 'Science Politique — L1', 'sciences_humaines', 'L1', '🏛️')
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- ÉCOLES SPÉCIFIQUES (etablissement_id obligatoire)
-- ══════════════════════════════════════════════════════════════

-- ── FMSB + CUSS — Médecine ───────────────────────────────────
INSERT INTO filieres (etablissement_id, code, nom, categorie, niveau, icone) VALUES
  ((SELECT id FROM etablissements WHERE code='FMSB'), 'FMSB_PCEM1', 'Médecine — PCEM1', 'medecine_sante', 'PCEM1', '🏥'),
  ((SELECT id FROM etablissements WHERE code='FMSB'), 'FMSB_PCEM2', 'Médecine — PCEM2', 'medecine_sante', 'PCEM2', '🏥'),
  ((SELECT id FROM etablissements WHERE code='FMSB'), 'FMSB_DCEM1', 'Médecine — DCEM1', 'medecine_sante', 'DCEM1', '🩺'),
  ((SELECT id FROM etablissements WHERE code='FMSB'), 'FMSB_DCEM2', 'Médecine — DCEM2', 'medecine_sante', 'DCEM2', '🩺'),
  ((SELECT id FROM etablissements WHERE code='FMSB'), 'FMSB_DCEM3', 'Médecine — DCEM3', 'medecine_sante', 'DCEM3', '🩺'),
  ((SELECT id FROM etablissements WHERE code='FMSB'), 'FMSB_DCEM4', 'Médecine — DCEM4', 'medecine_sante', 'DCEM4', '🩺'),
  ((SELECT id FROM etablissements WHERE code='CUSS'), 'CUSS_PCEM1', 'Médecine CUSS — PCEM1', 'medecine_sante', 'PCEM1', '🏥'),
  ((SELECT id FROM etablissements WHERE code='CUSS'), 'CUSS_PCEM2', 'Médecine CUSS — PCEM2', 'medecine_sante', 'PCEM2', '🏥')
ON CONFLICT DO NOTHING;

-- ── ENS Yaoundé ──────────────────────────────────────────────
INSERT INTO filieres (etablissement_id, code, nom, categorie, niveau, icone) VALUES
  ((SELECT id FROM etablissements WHERE code='ENS'), 'ENS_MATHS_L1',    'ENS — Maths L1',        'sciences_education', 'L1', '📐'),
  ((SELECT id FROM etablissements WHERE code='ENS'), 'ENS_MATHS_L2',    'ENS — Maths L2',        'sciences_education', 'L2', '📐'),
  ((SELECT id FROM etablissements WHERE code='ENS'), 'ENS_MATHS_L3',    'ENS — Maths L3',        'sciences_education', 'L3', '📐'),
  ((SELECT id FROM etablissements WHERE code='ENS'), 'ENS_LETTRES_L1',  'ENS — Lettres L1',      'sciences_education', 'L1', '📖'),
  ((SELECT id FROM etablissements WHERE code='ENS'), 'ENS_LETTRES_L2',  'ENS — Lettres L2',      'sciences_education', 'L2', '📖'),
  ((SELECT id FROM etablissements WHERE code='ENS'), 'ENS_ANGLAIS_L1',  'ENS — Anglais L1',      'sciences_education', 'L1', '🇬🇧'),
  ((SELECT id FROM etablissements WHERE code='ENS'), 'ENS_HIST_L1',     'ENS — Histoire-Géo L1', 'sciences_education', 'L1', '🌍'),
  ((SELECT id FROM etablissements WHERE code='ENS'), 'ENS_PHYSIQUE_L1', 'ENS — Physique L1',      'sciences_education', 'L1', '⚡'),
  ((SELECT id FROM etablissements WHERE code='ENS'), 'ENS_SVT_L1',      'ENS — SVT L1',           'sciences_education', 'L1', '🧬')
ON CONFLICT DO NOTHING;

-- ── ENSET Douala ─────────────────────────────────────────────
INSERT INTO filieres (etablissement_id, code, nom, categorie, niveau, icone) VALUES
  ((SELECT id FROM etablissements WHERE code='ENSET'), 'ENSET_GE_L1', 'ENSET — Génie Électrique L1',   'sciences_education', 'L1', '🔌'),
  ((SELECT id FROM etablissements WHERE code='ENSET'), 'ENSET_GE_L2', 'ENSET — Génie Électrique L2',   'sciences_education', 'L2', '🔌'),
  ((SELECT id FROM etablissements WHERE code='ENSET'), 'ENSET_GI_L1', 'ENSET — Génie Informatique L1', 'sciences_education', 'L1', '💻'),
  ((SELECT id FROM etablissements WHERE code='ENSET'), 'ENSET_GI_L2', 'ENSET — Génie Informatique L2', 'sciences_education', 'L2', '💻'),
  ((SELECT id FROM etablissements WHERE code='ENSET'), 'ENSET_GM_L1', 'ENSET — Génie Mécanique L1',    'sciences_education', 'L1', '🔧'),
  ((SELECT id FROM etablissements WHERE code='ENSET'), 'ENSET_GM_L2', 'ENSET — Génie Mécanique L2',    'sciences_education', 'L2', '🔧'),
  ((SELECT id FROM etablissements WHERE code='ENSET'), 'ENSET_GC_L1', 'ENSET — Génie Civil L1',        'sciences_education', 'L1', '🏗️')
ON CONFLICT DO NOTHING;

-- ── IUT (Douala / Ngaoundéré / Bandjoun) ─────────────────────
INSERT INTO filieres (etablissement_id, code, nom, categorie, niveau, icone) VALUES
  ((SELECT id FROM etablissements WHERE code='IUT_DOUALA'),   'IUT_D_INFO_1', 'IUT-D — Informatique DUT1',         'informatique_tech', 'DUT1', '💻'),
  ((SELECT id FROM etablissements WHERE code='IUT_DOUALA'),   'IUT_D_INFO_2', 'IUT-D — Informatique DUT2',         'informatique_tech', 'DUT2', '💻'),
  ((SELECT id FROM etablissements WHERE code='IUT_DOUALA'),   'IUT_D_GEA_1',  'IUT-D — Gestion Entreprises DUT1',  'economie_gestion',  'DUT1', '📊'),
  ((SELECT id FROM etablissements WHERE code='IUT_DOUALA'),   'IUT_D_TC_1',   'IUT-D — Techniques de Comm DUT1',   'economie_gestion',  'DUT1', '📡'),
  ((SELECT id FROM etablissements WHERE code='IUT_NGAOU'),    'IUT_N_INFO_1', 'IUT-N — Informatique DUT1',         'informatique_tech', 'DUT1', '💻'),
  ((SELECT id FROM etablissements WHERE code='IUT_NGAOU'),    'IUT_N_GEA_1',  'IUT-N — Gestion Entreprises DUT1',  'economie_gestion',  'DUT1', '📊'),
  ((SELECT id FROM etablissements WHERE code='IUT_BANDJOUN'), 'IUT_B_INFO_1', 'IUT-B — Informatique DUT1',         'informatique_tech', 'DUT1', '💻'),
  ((SELECT id FROM etablissements WHERE code='IUT_BANDJOUN'), 'IUT_B_GEA_1',  'IUT-B — Gestion Entreprises DUT1',  'economie_gestion',  'DUT1', '📊')
ON CONFLICT DO NOTHING;

-- ── ESSEC + IRIC ─────────────────────────────────────────────
INSERT INTO filieres (etablissement_id, code, nom, categorie, niveau, icone) VALUES
  ((SELECT id FROM etablissements WHERE code='ESSEC'), 'ESSEC_GESTION_L1',  'ESSEC — Gestion L1',    'economie_gestion', 'L1', '📈'),
  ((SELECT id FROM etablissements WHERE code='ESSEC'), 'ESSEC_GESTION_L2',  'ESSEC — Gestion L2',    'economie_gestion', 'L2', '📈'),
  ((SELECT id FROM etablissements WHERE code='ESSEC'), 'ESSEC_FINANCE_M1',  'ESSEC — Finance M1',    'economie_gestion', 'M1', '💰'),
  ((SELECT id FROM etablissements WHERE code='ESSEC'), 'ESSEC_MARKETING_M1','ESSEC — Marketing M1',  'economie_gestion', 'M1', '📢'),
  ((SELECT id FROM etablissements WHERE code='IRIC'),  'IRIC_RI_L1',        'IRIC — Relations Int. L1','sciences_humaines','L1','🌐'),
  ((SELECT id FROM etablissements WHERE code='IRIC'),  'IRIC_RI_L2',        'IRIC — Relations Int. L2','sciences_humaines','L2','🌐'),
  ((SELECT id FROM etablissements WHERE code='IRIC'),  'IRIC_RI_M1',        'IRIC — Relations Int. M1','sciences_humaines','M1','🌐')
ON CONFLICT DO NOTHING;

-- ── CONCOURS NATIONAUX ───────────────────────────────────────
INSERT INTO filieres (etablissement_id, code, nom, categorie, niveau, icone) VALUES
  ((SELECT id FROM etablissements WHERE code='ENAM'),               'CONCOURS_ENAM_ADM',   'ENAM — Administration',         'concours_grandes_ecoles',      'Concours', '🏛️'),
  ((SELECT id FROM etablissements WHERE code='ENAM'),               'CONCOURS_ENAM_DIPL',  'ENAM — Diplomatie',             'concours_grandes_ecoles',      'Concours', '🏛️'),
  ((SELECT id FROM etablissements WHERE code='ENAM'),               'CONCOURS_ENAM_FISC',  'ENAM — Fiscalité',              'concours_grandes_ecoles',      'Concours', '🏛️'),
  ((SELECT id FROM etablissements WHERE code='ENSET'),              'CONCOURS_ENSET',      'Concours ENSET',                'concours_grandes_ecoles',      'Concours', '🔧'),
  ((SELECT id FROM etablissements WHERE code='ENS'),                'CONCOURS_ENS',        'Concours ENS Yaoundé',          'concours_grandes_ecoles',      'Concours', '📚'),
  ((SELECT id FROM etablissements WHERE code='EMIA'),               'CONCOURS_EMIA',       'Concours EMIA',                 'concours_grandes_ecoles',      'Concours', '🎖️'),
  ((SELECT id FROM etablissements WHERE code='ESSEC'),              'CONCOURS_ESSEC',      'Concours ESSEC',                'concours_grandes_ecoles',      'Concours', '📈'),
  ((SELECT id FROM etablissements WHERE code='IRIC'),               'CONCOURS_IRIC',       'Concours IRIC',                 'concours_grandes_ecoles',      'Concours', '🌐'),
  ((SELECT id FROM etablissements WHERE code='FMSB'),               'CONCOURS_FMSB',       'Concours entrée FMSB',          'concours_grandes_ecoles',      'Concours', '🏥'),
  ((SELECT id FROM etablissements WHERE code='CUSS'),               'CONCOURS_CUSS',       'Concours entrée CUSS',          'concours_grandes_ecoles',      'Concours', '🏥'),
  ((SELECT id FROM etablissements WHERE code='CONCOURS_POLICE'),    'CONCOURS_POLICE_NAT', 'Concours Police Nationale',     'concours_fonctions_publiques', 'Concours', '👮'),
  ((SELECT id FROM etablissements WHERE code='CONCOURS_GEND'),      'CONCOURS_GENDARMERIE','Concours Gendarmerie',          'concours_fonctions_publiques', 'Concours', '🎖️'),
  ((SELECT id FROM etablissements WHERE code='CONCOURS_FP'),        'CONCOURS_FP_GENERAL', 'Concours Fonctions Publiques',  'concours_fonctions_publiques', 'Concours', '🏢'),
  ((SELECT id FROM etablissements WHERE code='CONCOURS_MAGISTRATURE'),'CONCOURS_MAGISTRAT','Concours Magistrature',         'concours_fonctions_publiques', 'Concours', '⚖️')
ON CONFLICT DO NOTHING;


-- ============================================================
-- FIN V003
-- ============================================================
-- ACTIONS MANUELLES POST-DÉPLOIEMENT :
--
-- Storage → New Bucket :
--   "epreuves"  → Public access : OUI  (sujets gratuits)
--   "corriges"  → Public access : NON  (fax protégés)
-- ============================================================
