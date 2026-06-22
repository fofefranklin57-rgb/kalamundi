-- ============================================================
-- Migration V003 — Espace Étudiant : Fax, Épreuves, Concours
-- Kalamundi — À exécuter dans Supabase SQL Editor
-- ============================================================
-- Ordre d'exécution : après V001 et V002
-- Tables créées :
--   etablissements, filieres, epreuves, corriges,
--   acces_corriges, favoris_etudiant
-- Modifs :
--   profiles.role  → ajoute 'tuteur' et 'etudiant'
--   paiements.type → ajoute 'acces_corrige', 'abonnement_etudiant'
-- ============================================================


-- ============================================================
-- 0. MISE À JOUR DES CONTRAINTES EXISTANTES
-- ============================================================

-- Ajouter les rôles 'tuteur' et 'etudiant' à profiles
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('lecteur','auteur','tuteur','etudiant','institution','admin'));

-- Ajouter les types de paiement pour l'espace étudiant
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
-- Universités, grandes écoles, IUT, prépas, instituts
-- ============================================================
CREATE TABLE IF NOT EXISTS etablissements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,  -- ex: 'UY1', 'ENAM', 'ENSET'
  nom         TEXT NOT NULL,         -- ex: 'Université de Yaoundé I'
  nom_court   TEXT,                  -- ex: 'UY1'
  type        TEXT NOT NULL CHECK (type IN (
                 'universite',
                 'grande_ecole',
                 'iut',
                 'preparatoire',
                 'national'          -- pour les concours nationaux sans établissement fixe
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
-- Programmes d'études : Droit, Médecine, Sciences, Concours…
-- Une filière peut exister dans plusieurs établissements.
-- ============================================================
CREATE TABLE IF NOT EXISTS filieres (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID REFERENCES etablissements(id) ON DELETE SET NULL,
  code           TEXT NOT NULL,   -- ex: 'DROIT_L1', 'MEDECINE_PCEM1', 'CONCOURS_ENAM'
  nom            TEXT NOT NULL,   -- ex: 'Droit Privé — Licence 1'
  categorie      TEXT NOT NULL CHECK (categorie IN (
                   'droit_sciences_juridiques',
                   'medecine_sante',
                   'sciences_exactes',
                   'sciences_humaines',
                   'lettres_langues',
                   'economie_gestion',
                   'informatique_tech',
                   'sciences_education',
                   'agronomie',
                   'architecture',
                   'concours_grandes_ecoles',
                   'concours_fonctions_publiques',
                   'autre'
                 )),
  niveau         TEXT CHECK (niveau IN (
                   'L1','L2','L3',
                   'M1','M2',
                   'Doctorat',
                   'PCEM1','PCEM2','DCEM1','DCEM2','DCEM3','DCEM4',
                   'BTS1','BTS2',
                   'DUT1','DUT2',
                   'Concours',
                   'Prépa'
                 )),
  description    TEXT,
  icone          TEXT DEFAULT '🎓',  -- emoji représentatif
  actif          BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE filieres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "filieres_public_read" ON filieres FOR SELECT USING (actif = true);
CREATE POLICY "filieres_admin_all"   ON filieres FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE INDEX IF NOT EXISTS idx_filieres_etablissement ON filieres(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_filieres_categorie     ON filieres(categorie);
CREATE INDEX IF NOT EXISTS idx_filieres_niveau        ON filieres(niveau);


-- ============================================================
-- 3. ÉPREUVES
-- Le sujet d'examen (questions seulement, sans corrigé)
-- Accessible gratuitement (avec pub)
-- ============================================================
CREATE TABLE IF NOT EXISTS epreuves (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filiere_id       UUID NOT NULL REFERENCES filieres(id) ON DELETE CASCADE,
  etablissement_id UUID REFERENCES etablissements(id) ON DELETE SET NULL,
  matiere          TEXT NOT NULL,     -- ex: 'Droit Civil', 'Anatomie', 'Analyse 1'
  annee            INT  NOT NULL CHECK (annee BETWEEN 1990 AND 2035),
  semestre         TEXT CHECK (semestre IN ('S1','S2','Annuel','Non précisé')) DEFAULT 'Non précisé',
  type_epreuve     TEXT NOT NULL CHECK (type_epreuve IN (
                     'cc',              -- Contrôle Continu
                     'session_normale', -- Examen principal
                     'rattrapage',      -- Session de rattrapage
                     'concours',        -- Épreuve de concours
                     'td',              -- Travaux Dirigés
                     'tp',              -- Travaux Pratiques
                     'partiel'          -- Partiel (mi-semestre)
                   )),
  fichier_url      TEXT,    -- PDF du sujet (Supabase Storage bucket "epreuves")
  apercu_url       TEXT,    -- image couverture optionnelle
  description      TEXT,
  nb_pages         INT,
  a_corrige        BOOLEAN DEFAULT false,  -- indique si un corrigé existe
  visible          BOOLEAN DEFAULT true,
  uploadeur_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  nb_telechargements INT DEFAULT 0,
  nb_vues          INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE epreuves ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les épreuves
CREATE POLICY "epreuves_public_read"  ON epreuves FOR SELECT USING (visible = true);
-- Tuteur/admin peut insérer
CREATE POLICY "epreuves_tuteur_insert" ON epreuves FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('tuteur','admin'));
-- Tuteur peut modifier ses propres épreuves, admin peut tout modifier
CREATE POLICY "epreuves_tuteur_update" ON epreuves FOR UPDATE TO authenticated
  USING (uploadeur_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "epreuves_admin_delete"  ON epreuves FOR DELETE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE INDEX IF NOT EXISTS idx_epreuves_filiere      ON epreuves(filiere_id);
CREATE INDEX IF NOT EXISTS idx_epreuves_etablissement ON epreuves(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_epreuves_matiere       ON epreuves(matiere);
CREATE INDEX IF NOT EXISTS idx_epreuves_annee         ON epreuves(annee);
CREATE INDEX IF NOT EXISTS idx_epreuves_type          ON epreuves(type_epreuve);


-- ============================================================
-- 4. CORRIGÉS (les "fax")
-- La solution détaillée d'une épreuve
-- Peut être gratuit (avec pub) ou premium
-- Peut être produit par humain (tuteur) ou IA (Claude)
-- ============================================================
CREATE TABLE IF NOT EXISTS corriges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epreuve_id   UUID NOT NULL REFERENCES epreuves(id) ON DELETE CASCADE,
  auteur_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- tuteur ou null si IA
  source       TEXT NOT NULL CHECK (source IN ('humain','ia','officiel')),
  statut       TEXT NOT NULL CHECK (statut IN ('gratuit','premium')) DEFAULT 'premium',
  prix_fcfa    INT  DEFAULT 500 CHECK (prix_fcfa >= 0),  -- 0 si gratuit
  fichier_url  TEXT,      -- PDF du corrigé (Supabase Storage bucket "corriges")
  contenu_texte TEXT,     -- Texte brut (si pas de PDF, ou généré par IA)
  note_qualite DECIMAL(2,1) DEFAULT 0,  -- 0-5 étoiles
  nb_votes     INT DEFAULT 0,
  verifie      BOOLEAN DEFAULT false,   -- corrigé validé par un admin/expert
  visible      BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE corriges ENABLE ROW LEVEL SECURITY;

-- Gratuit = tout le monde; Premium = seulement si accès payé ou abonnement
CREATE POLICY "corriges_gratuit_read" ON corriges FOR SELECT
  USING (visible = true AND statut = 'gratuit');

CREATE POLICY "corriges_premium_read" ON corriges FOR SELECT TO authenticated
  USING (
    visible = true AND (
      statut = 'gratuit'
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
      OR auteur_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM acces_corriges
        WHERE acces_corriges.corrige_id = corriges.id
          AND acces_corriges.user_id    = auth.uid()
          AND (acces_corriges.expire_at IS NULL OR acces_corriges.expire_at > NOW())
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
          AND abonnement IN ('reader_plus','auteur_pro','institution')
          AND (abonnement_expire_at IS NULL OR abonnement_expire_at > NOW())
      )
    )
  );

CREATE POLICY "corriges_tuteur_insert" ON corriges FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('tuteur','admin'));

CREATE POLICY "corriges_tuteur_update" ON corriges FOR UPDATE TO authenticated
  USING (auteur_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE INDEX IF NOT EXISTS idx_corriges_epreuve ON corriges(epreuve_id);
CREATE INDEX IF NOT EXISTS idx_corriges_auteur  ON corriges(auteur_id);
CREATE INDEX IF NOT EXISTS idx_corriges_source  ON corriges(source);


-- ============================================================
-- 5. ACCÈS CORRIGES (achats individuels)
-- ============================================================
CREATE TABLE IF NOT EXISTS acces_corriges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  corrige_id  UUID NOT NULL REFERENCES corriges(id) ON DELETE CASCADE,
  paiement_id UUID REFERENCES paiements(id) ON DELETE SET NULL,
  expire_at   TIMESTAMPTZ,   -- null = accès permanent
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, corrige_id)
);

ALTER TABLE acces_corriges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acces_corriges_user" ON acces_corriges FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "acces_corriges_insert" ON acces_corriges FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "acces_corriges_admin" ON acces_corriges FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE INDEX IF NOT EXISTS idx_acces_corriges_user   ON acces_corriges(user_id);
CREATE INDEX IF NOT EXISTS idx_acces_corriges_corrige ON acces_corriges(corrige_id);


-- ============================================================
-- 6. FAVORIS ÉTUDIANT
-- Sauvegarder des épreuves ou corrigés
-- ============================================================
CREATE TABLE IF NOT EXISTS favoris_etudiant (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  epreuve_id  UUID REFERENCES epreuves(id)  ON DELETE CASCADE,
  corrige_id  UUID REFERENCES corriges(id)  ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fav_un_seul CHECK (
    (epreuve_id IS NOT NULL AND corrige_id IS NULL) OR
    (epreuve_id IS NULL AND corrige_id IS NOT NULL)
  ),
  UNIQUE(user_id, epreuve_id),
  UNIQUE(user_id, corrige_id)
);

ALTER TABLE favoris_etudiant ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favoris_user_all" ON favoris_etudiant FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 7. VOTES QUALITÉ CORRIGÉS
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

-- Trigger : recalculer la note moyenne du corrigé
CREATE OR REPLACE FUNCTION maj_note_corrige()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE corriges SET
    note_qualite = (SELECT ROUND(AVG(note)::numeric, 1) FROM votes_corriges WHERE corrige_id = COALESCE(NEW.corrige_id, OLD.corrige_id)),
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
-- 8. FONCTIONS UTILITAIRES
-- ============================================================

-- Incrémenter les vues d'une épreuve
CREATE OR REPLACE FUNCTION incrementer_vue_epreuve(p_epreuve_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE epreuves SET nb_vues = nb_vues + 1 WHERE id = p_epreuve_id;
END;
$$;

-- Incrémenter les téléchargements d'une épreuve
CREATE OR REPLACE FUNCTION incrementer_telechargement_epreuve(p_epreuve_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE epreuves
    SET nb_telechargements = nb_telechargements + 1
  WHERE id = p_epreuve_id;
END;
$$;

-- Mettre à jour le flag a_corrige sur l'épreuve quand un corrigé est inséré
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
-- 9. DONNÉES SEED — ÉTABLISSEMENTS CAMEROUN
-- ============================================================
INSERT INTO etablissements (code, nom, nom_court, type, ville) VALUES
  -- Universités d'État
  ('UY1',     'Université de Yaoundé I',                    'UY1',   'universite',    'Yaoundé'),
  ('UY2',     'Université de Yaoundé II (Soa)',             'UY2',   'universite',    'Soa'),
  ('UD',      'Université de Douala',                       'UD',    'universite',    'Douala'),
  ('UDSCHANG','Université de Dschang',                      'UDS',   'universite',    'Dschang'),
  ('UBUEA',   'University of Buea',                         'UB',    'universite',    'Buea'),
  ('UNGAOU',  'Université de Ngaoundéré',                   'UN',    'universite',    'Ngaoundéré'),
  ('UMAROUA', 'Université de Maroua',                       'UM',    'universite',    'Maroua'),
  ('UBAMENDA','Université de Bamenda',                      'UBA',   'universite',    'Bamenda'),
  -- Grandes Écoles
  ('ENAM',    'École Nationale d''Administration et de Magistrature', 'ENAM', 'grande_ecole', 'Yaoundé'),
  ('ENSET',   'École Normale Supérieure d''Enseignement Technique',   'ENSET','grande_ecole', 'Douala'),
  ('ENS',     'École Normale Supérieure de Yaoundé',        'ENS',   'grande_ecole',  'Yaoundé'),
  ('EMIA',    'École Militaire Inter-Armes',                 'EMIA',  'grande_ecole',  'Yaoundé'),
  ('ESSEC',   'École Supérieure des Sciences Économiques et Commerciales', 'ESSEC', 'grande_ecole', 'Douala'),
  ('IRIC',    'Institut des Relations Internationales du Cameroun',   'IRIC', 'grande_ecole', 'Yaoundé'),
  ('FMSB',    'Faculté de Médecine et des Sciences Biomédicales',     'FMSB', 'grande_ecole', 'Yaoundé'),
  ('CUSS',    'Centre Universitaire des Sciences de la Santé',        'CUSS', 'grande_ecole', 'Yaoundé'),
  ('IPD',     'Institut de Pédiatrie Hospitalière',                   'IPD',  'grande_ecole', 'Yaoundé'),
  -- IUT
  ('IUT_DOUALA',    'IUT de Douala',                        'IUT-D', 'iut',           'Douala'),
  ('IUT_NGAOU',     'IUT de Ngaoundéré',                    'IUT-N', 'iut',           'Ngaoundéré'),
  ('IUT_BANDJOUN',  'IUT de Bandjoun',                      'IUT-B', 'iut',           'Bandjoun'),
  -- Concours nationaux (sans établissement fixe)
  ('CONCOURS_POLICE',  'Concours Police Nationale Cameroun',  'Police',     'national', NULL),
  ('CONCOURS_GEND',    'Concours Gendarmerie Nationale',      'Gendarmerie','national', NULL),
  ('CONCOURS_FP',      'Concours Fonctions Publiques',        'FP',         'national', NULL),
  ('CONCOURS_MAGISTRATURE', 'Concours Magistrature',          'Magistrature','national',NULL)
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 10. DONNÉES SEED — FILIÈRES PRINCIPALES
-- ============================================================

-- ── UY2 — Droit / Sciences Juridiques ─────────────────────
INSERT INTO filieres (etablissement_id, code, nom, categorie, niveau, icone) VALUES
  ((SELECT id FROM etablissements WHERE code='UY2'), 'UY2_DROIT_L1', 'Droit — Licence 1',  'droit_sciences_juridiques','L1','⚖️'),
  ((SELECT id FROM etablissements WHERE code='UY2'), 'UY2_DROIT_L2', 'Droit — Licence 2',  'droit_sciences_juridiques','L2','⚖️'),
  ((SELECT id FROM etablissements WHERE code='UY2'), 'UY2_DROIT_L3', 'Droit — Licence 3',  'droit_sciences_juridiques','L3','⚖️'),
  ((SELECT id FROM etablissements WHERE code='UY2'), 'UY2_DROIT_M1', 'Droit — Master 1',   'droit_sciences_juridiques','M1','⚖️'),
  ((SELECT id FROM etablissements WHERE code='UY2'), 'UY2_DROIT_M2', 'Droit — Master 2',   'droit_sciences_juridiques','M2','⚖️'),
  ((SELECT id FROM etablissements WHERE code='UY2'), 'UY2_ECO_L1',   'Économie — L1',       'economie_gestion','L1','📈'),
  ((SELECT id FROM etablissements WHERE code='UY2'), 'UY2_ECO_L2',   'Économie — L2',       'economie_gestion','L2','📈'),
  ((SELECT id FROM etablissements WHERE code='UY2'), 'UY2_ECO_L3',   'Économie — L3',       'economie_gestion','L3','📈'),
  ((SELECT id FROM etablissements WHERE code='UY2'), 'UY2_GESTION_L1','Gestion — L1',       'economie_gestion','L1','📊'),
  ((SELECT id FROM etablissements WHERE code='UY2'), 'UY2_GESTION_L2','Gestion — L2',       'economie_gestion','L2','📊'),
  ((SELECT id FROM etablissements WHERE code='UY2'), 'UY2_GESTION_L3','Gestion — L3',       'economie_gestion','L3','📊')
ON CONFLICT DO NOTHING;

-- ── UY1 — Sciences Exactes ────────────────────────────────
INSERT INTO filieres (etablissement_id, code, nom, categorie, niveau, icone) VALUES
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_MATHS_L1',  'Mathématiques — L1',   'sciences_exactes','L1','📐'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_MATHS_L2',  'Mathématiques — L2',   'sciences_exactes','L2','📐'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_MATHS_L3',  'Mathématiques — L3',   'sciences_exactes','L3','📐'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_PHYSIQUE_L1','Physique — L1',        'sciences_exactes','L1','⚡'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_PHYSIQUE_L2','Physique — L2',        'sciences_exactes','L2','⚡'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_PHYSIQUE_L3','Physique — L3',        'sciences_exactes','L3','⚡'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_CHIMIE_L1',  'Chimie — L1',          'sciences_exactes','L1','🧪'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_CHIMIE_L2',  'Chimie — L2',          'sciences_exactes','L2','🧪'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_INFO_L1',    'Informatique — L1',    'informatique_tech','L1','💻'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_INFO_L2',    'Informatique — L2',    'informatique_tech','L2','💻'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_INFO_L3',    'Informatique — L3',    'informatique_tech','L3','💻'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_SVT_L1',     'Sciences de la Vie — L1','sciences_exactes','L1','🧬'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_SVT_L2',     'Sciences de la Vie — L2','sciences_exactes','L2','🧬'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_SVT_L3',     'Sciences de la Vie — L3','sciences_exactes','L3','🧬')
ON CONFLICT DO NOTHING;

-- ── FMSB — Médecine ───────────────────────────────────────
INSERT INTO filieres (etablissement_id, code, nom, categorie, niveau, icone) VALUES
  ((SELECT id FROM etablissements WHERE code='FMSB'), 'FMSB_PCEM1',  'Médecine — PCEM1 (1ère année)',  'medecine_sante','PCEM1','🏥'),
  ((SELECT id FROM etablissements WHERE code='FMSB'), 'FMSB_PCEM2',  'Médecine — PCEM2 (2ème année)',  'medecine_sante','PCEM2','🏥'),
  ((SELECT id FROM etablissements WHERE code='FMSB'), 'FMSB_DCEM1',  'Médecine — DCEM1 (3ème année)',  'medecine_sante','DCEM1','🩺'),
  ((SELECT id FROM etablissements WHERE code='FMSB'), 'FMSB_DCEM2',  'Médecine — DCEM2 (4ème année)',  'medecine_sante','DCEM2','🩺'),
  ((SELECT id FROM etablissements WHERE code='FMSB'), 'FMSB_DCEM3',  'Médecine — DCEM3 (5ème année)',  'medecine_sante','DCEM3','🩺'),
  ((SELECT id FROM etablissements WHERE code='FMSB'), 'FMSB_DCEM4',  'Médecine — DCEM4 (6ème année)',  'medecine_sante','DCEM4','🩺')
ON CONFLICT DO NOTHING;

-- ── CUSS — Santé ──────────────────────────────────────────
INSERT INTO filieres (etablissement_id, code, nom, categorie, niveau, icone) VALUES
  ((SELECT id FROM etablissements WHERE code='CUSS'), 'CUSS_PCEM1', 'Médecine CUSS — PCEM1', 'medecine_sante','PCEM1','🏥'),
  ((SELECT id FROM etablissements WHERE code='CUSS'), 'CUSS_PCEM2', 'Médecine CUSS — PCEM2', 'medecine_sante','PCEM2','🏥')
ON CONFLICT DO NOTHING;

-- ── UY1 — Lettres / Sciences Humaines ─────────────────────
INSERT INTO filieres (etablissement_id, code, nom, categorie, niveau, icone) VALUES
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_LETTRES_L1','Lettres Modernes — L1',  'lettres_langues','L1','📖'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_LETTRES_L2','Lettres Modernes — L2',  'lettres_langues','L2','📖'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_LETTRES_L3','Lettres Modernes — L3',  'lettres_langues','L3','📖'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_ANGLAIS_L1','Anglais — L1',           'lettres_langues','L1','🇬🇧'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_ANGLAIS_L2','Anglais — L2',           'lettres_langues','L2','🇬🇧'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_HIST_L1',   'Histoire — L1',          'sciences_humaines','L1','🌍'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_HIST_L2',   'Histoire — L2',          'sciences_humaines','L2','🌍'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_GEO_L1',    'Géographie — L1',        'sciences_humaines','L1','🗺️'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_GEO_L2',    'Géographie — L2',        'sciences_humaines','L2','🗺️'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_SOCIO_L1',  'Sociologie — L1',        'sciences_humaines','L1','👥'),
  ((SELECT id FROM etablissements WHERE code='UY1'), 'UY1_PHILO_L1',  'Philosophie — L1',       'sciences_humaines','L1','🧠')
ON CONFLICT DO NOTHING;

-- ── ENS — Sciences de l'Éducation ─────────────────────────
INSERT INTO filieres (etablissement_id, code, nom, categorie, niveau, icone) VALUES
  ((SELECT id FROM etablissements WHERE code='ENS'), 'ENS_MATHS_L1',  'ENS Maths — L1',          'sciences_education','L1','📐'),
  ((SELECT id FROM etablissements WHERE code='ENS'), 'ENS_MATHS_L2',  'ENS Maths — L2',          'sciences_education','L2','📐'),
  ((SELECT id FROM etablissements WHERE code='ENS'), 'ENS_MATHS_L3',  'ENS Maths — L3',          'sciences_education','L3','📐'),
  ((SELECT id FROM etablissements WHERE code='ENS'), 'ENS_LETTRES_L1','ENS Lettres — L1',         'sciences_education','L1','📖'),
  ((SELECT id FROM etablissements WHERE code='ENS'), 'ENS_LETTRES_L2','ENS Lettres — L2',         'sciences_education','L2','📖'),
  ((SELECT id FROM etablissements WHERE code='ENS'), 'ENS_ANGLAIS_L1','ENS Anglais — L1',         'sciences_education','L1','🇬🇧'),
  ((SELECT id FROM etablissements WHERE code='ENS'), 'ENS_HIST_L1',   'ENS Histoire-Géo — L1',   'sciences_education','L1','🌍')
ON CONFLICT DO NOTHING;

-- ── ENSET — Enseignement Technique ────────────────────────
INSERT INTO filieres (etablissement_id, code, nom, categorie, niveau, icone) VALUES
  ((SELECT id FROM etablissements WHERE code='ENSET'), 'ENSET_GE_L1', 'Génie Électrique — L1',  'informatique_tech','L1','🔌'),
  ((SELECT id FROM etablissements WHERE code='ENSET'), 'ENSET_GE_L2', 'Génie Électrique — L2',  'informatique_tech','L2','🔌'),
  ((SELECT id FROM etablissements WHERE code='ENSET'), 'ENSET_GI_L1', 'Génie Informatique — L1','informatique_tech','L1','💻'),
  ((SELECT id FROM etablissements WHERE code='ENSET'), 'ENSET_GI_L2', 'Génie Informatique — L2','informatique_tech','L2','💻'),
  ((SELECT id FROM etablissements WHERE code='ENSET'), 'ENSET_GM_L1', 'Génie Mécanique — L1',   'informatique_tech','L1','🔧'),
  ((SELECT id FROM etablissements WHERE code='ENSET'), 'ENSET_GM_L2', 'Génie Mécanique — L2',   'informatique_tech','L2','🔧')
ON CONFLICT DO NOTHING;

-- ── IUT Douala ────────────────────────────────────────────
INSERT INTO filieres (etablissement_id, code, nom, categorie, niveau, icone) VALUES
  ((SELECT id FROM etablissements WHERE code='IUT_DOUALA'), 'IUT_D_INFO_1', 'IUT Informatique — DUT1', 'informatique_tech','DUT1','💻'),
  ((SELECT id FROM etablissements WHERE code='IUT_DOUALA'), 'IUT_D_INFO_2', 'IUT Informatique — DUT2', 'informatique_tech','DUT2','💻'),
  ((SELECT id FROM etablissements WHERE code='IUT_DOUALA'), 'IUT_D_TC_1',   'IUT Techniques de Comm — DUT1','economie_gestion','DUT1','📡'),
  ((SELECT id FROM etablissements WHERE code='IUT_DOUALA'), 'IUT_D_GEA_1',  'IUT Gestion Entreprises — DUT1','economie_gestion','DUT1','📊')
ON CONFLICT DO NOTHING;

-- ── Concours Nationaux ────────────────────────────────────
INSERT INTO filieres (etablissement_id, code, nom, categorie, niveau, icone) VALUES
  ((SELECT id FROM etablissements WHERE code='ENAM'),   'CONCOURS_ENAM',   'Concours ENAM (toutes options)',      'concours_grandes_ecoles','Concours','🏛️'),
  ((SELECT id FROM etablissements WHERE code='ENSET'),  'CONCOURS_ENSET',  'Concours ENSET',                      'concours_grandes_ecoles','Concours','🔧'),
  ((SELECT id FROM etablissements WHERE code='ENS'),    'CONCOURS_ENS',    'Concours ENS Yaoundé',                'concours_grandes_ecoles','Concours','📚'),
  ((SELECT id FROM etablissements WHERE code='EMIA'),   'CONCOURS_EMIA',   'Concours EMIA',                       'concours_grandes_ecoles','Concours','🎖️'),
  ((SELECT id FROM etablissements WHERE code='ESSEC'),  'CONCOURS_ESSEC',  'Concours ESSEC Douala',               'concours_grandes_ecoles','Concours','📈'),
  ((SELECT id FROM etablissements WHERE code='IRIC'),   'CONCOURS_IRIC',   'Concours IRIC',                       'concours_grandes_ecoles','Concours','🌐'),
  ((SELECT id FROM etablissements WHERE code='FMSB'),   'CONCOURS_FMSB',   'Concours d''entrée FMSB (Médecine)',  'concours_grandes_ecoles','Concours','🏥'),
  ((SELECT id FROM etablissements WHERE code='CUSS'),   'CONCOURS_CUSS',   'Concours d''entrée CUSS (Médecine)',  'concours_grandes_ecoles','Concours','🏥'),
  ((SELECT id FROM etablissements WHERE code='CONCOURS_POLICE'), 'CONCOURS_POLICE_NAT', 'Concours Police Nationale', 'concours_fonctions_publiques','Concours','👮'),
  ((SELECT id FROM etablissements WHERE code='CONCOURS_GEND'),   'CONCOURS_GENDARMERIE','Concours Gendarmerie',      'concours_fonctions_publiques','Concours','🎖️'),
  ((SELECT id FROM etablissements WHERE code='CONCOURS_FP'),     'CONCOURS_FP_GENERAL', 'Concours Fonctions Publiques (général)', 'concours_fonctions_publiques','Concours','🏢'),
  ((SELECT id FROM etablissements WHERE code='CONCOURS_MAGISTRATURE'), 'CONCOURS_MAGISTRAT', 'Concours Magistrature', 'concours_fonctions_publiques','Concours','⚖️')
ON CONFLICT DO NOTHING;

-- ── UD — Université de Douala ─────────────────────────────
INSERT INTO filieres (etablissement_id, code, nom, categorie, niveau, icone) VALUES
  ((SELECT id FROM etablissements WHERE code='UD'), 'UD_DROIT_L1',  'Droit — L1 (Douala)',    'droit_sciences_juridiques','L1','⚖️'),
  ((SELECT id FROM etablissements WHERE code='UD'), 'UD_DROIT_L2',  'Droit — L2 (Douala)',    'droit_sciences_juridiques','L2','⚖️'),
  ((SELECT id FROM etablissements WHERE code='UD'), 'UD_ECO_L1',    'Économie — L1 (Douala)', 'economie_gestion','L1','📈'),
  ((SELECT id FROM etablissements WHERE code='UD'), 'UD_ECO_L2',    'Économie — L2 (Douala)', 'economie_gestion','L2','📈'),
  ((SELECT id FROM etablissements WHERE code='UD'), 'UD_INFO_L1',   'Informatique — L1 (Douala)','informatique_tech','L1','💻'),
  ((SELECT id FROM etablissements WHERE code='UD'), 'UD_INFO_L2',   'Informatique — L2 (Douala)','informatique_tech','L2','💻')
ON CONFLICT DO NOTHING;


-- ============================================================
-- FIN V003
-- ============================================================
-- RÉCAP DES ACTIONS MANUELLES POST-DÉPLOIEMENT :
--
-- 1. Créer les buckets Supabase Storage :
--    - "epreuves"  (public=false, accès via signed URL)
--    - "corriges"  (public=false, accès via signed URL sécurisé)
--
-- 2. Définir les politiques Storage :
--    - epreuves/  : lecture publique (épreuve = gratuit)
--    - corriges/  : lecture authentifiée après vérification acces_corriges
--
-- 3. Pour ajouter d'autres établissements ou filières :
--    INSERT INTO etablissements (...) ON CONFLICT (code) DO NOTHING;
--    INSERT INTO filieres (...) ON CONFLICT DO NOTHING;
-- ============================================================
