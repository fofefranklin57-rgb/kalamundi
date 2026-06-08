-- ============================================================
-- BLOC E5 — Annales BAC / Probatoire / BEPC — Cameroun
-- Toutes séries : A, A4, B, C, D, E, F, G1, G2, G3
-- À exécuter dans le SQL Editor Supabase
-- ============================================================

-- ── Table annales ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS annales (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  examen              TEXT NOT NULL CHECK (examen IN ('BAC','Probatoire','BEPC','CAP')),
  serie               TEXT,   -- null pour BEPC/CAP
  matiere             TEXT NOT NULL,
  annee               INT  NOT NULL CHECK (annee BETWEEN 2000 AND 2030),
  session             TEXT DEFAULT 'principale' CHECK (session IN ('principale','rattrapage')),
  pays                TEXT DEFAULT 'Cameroun',
  region              TEXT,   -- optionnel : Centre, Littoral, etc.
  fichier_url         TEXT,   -- PDF dans Storage bucket "annales" (null = bientôt dispo)
  apercu_url          TEXT,   -- couverture optionnelle
  description         TEXT,
  nb_telechargements  INT DEFAULT 0,
  visible             BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE annales ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les annales visibles
CREATE POLICY "annales_select" ON annales
  FOR SELECT USING (visible = true);

-- Seul l'admin peut gérer (via service role ou rôle admin)
CREATE POLICY "annales_insert_admin" ON annales
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "annales_update_admin" ON annales
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "annales_delete_admin" ON annales
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Index ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_annales_examen  ON annales(examen);
CREATE INDEX IF NOT EXISTS idx_annales_serie   ON annales(serie);
CREATE INDEX IF NOT EXISTS idx_annales_annee   ON annales(annee);
CREATE INDEX IF NOT EXISTS idx_annales_matiere ON annales(matiere);

-- ── Fonction : incrémenter téléchargements ──────────────────
CREATE OR REPLACE FUNCTION incrementer_telechargement_annale(annale_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE annales SET nb_telechargements = nb_telechargements + 1 WHERE id = annale_id;
END;
$$;

-- ── Données seed : toutes séries, matières principales ──────
-- BAC Série C (Mathématiques et Sciences Physiques)
INSERT INTO annales (examen, serie, matiere, annee, session) VALUES
  ('BAC','C','Mathématiques',           2024,'principale'),
  ('BAC','C','Mathématiques',           2023,'principale'),
  ('BAC','C','Mathématiques',           2022,'principale'),
  ('BAC','C','Mathématiques',           2021,'principale'),
  ('BAC','C','Mathématiques',           2020,'principale'),
  ('BAC','C','Mathématiques',           2019,'principale'),
  ('BAC','C','Mathématiques',           2018,'principale'),
  ('BAC','C','Physique-Chimie',         2024,'principale'),
  ('BAC','C','Physique-Chimie',         2023,'principale'),
  ('BAC','C','Physique-Chimie',         2022,'principale'),
  ('BAC','C','Physique-Chimie',         2021,'principale'),
  ('BAC','C','Physique-Chimie',         2020,'principale'),
  ('BAC','C','Physique-Chimie',         2019,'principale'),
  ('BAC','C','Physique-Chimie',         2018,'principale'),
  ('BAC','C','Français',                2024,'principale'),
  ('BAC','C','Français',                2023,'principale'),
  ('BAC','C','Français',                2022,'principale'),
  ('BAC','C','Philosophie',             2024,'principale'),
  ('BAC','C','Philosophie',             2023,'principale'),
  ('BAC','C','Philosophie',             2022,'principale'),
  ('BAC','C','Anglais',                 2024,'principale'),
  ('BAC','C','Anglais',                 2023,'principale'),
  ('BAC','C','SVT',                     2024,'principale'),
  ('BAC','C','SVT',                     2023,'principale'),
  ('BAC','C','Histoire-Géographie',     2024,'principale'),
  ('BAC','C','Histoire-Géographie',     2023,'principale'),
  -- Sessions de rattrapage
  ('BAC','C','Mathématiques',           2024,'rattrapage'),
  ('BAC','C','Physique-Chimie',         2024,'rattrapage'),
  ('BAC','C','Mathématiques',           2023,'rattrapage'),
  ('BAC','C','Physique-Chimie',         2023,'rattrapage')
ON CONFLICT DO NOTHING;

-- BAC Série D (Sciences du Vivant)
INSERT INTO annales (examen, serie, matiere, annee, session) VALUES
  ('BAC','D','SVT',                     2024,'principale'),
  ('BAC','D','SVT',                     2023,'principale'),
  ('BAC','D','SVT',                     2022,'principale'),
  ('BAC','D','SVT',                     2021,'principale'),
  ('BAC','D','SVT',                     2020,'principale'),
  ('BAC','D','SVT',                     2019,'principale'),
  ('BAC','D','SVT',                     2018,'principale'),
  ('BAC','D','Chimie',                  2024,'principale'),
  ('BAC','D','Chimie',                  2023,'principale'),
  ('BAC','D','Chimie',                  2022,'principale'),
  ('BAC','D','Physique',                2024,'principale'),
  ('BAC','D','Physique',                2023,'principale'),
  ('BAC','D','Mathématiques',           2024,'principale'),
  ('BAC','D','Mathématiques',           2023,'principale'),
  ('BAC','D','Mathématiques',           2022,'principale'),
  ('BAC','D','Français',                2024,'principale'),
  ('BAC','D','Français',                2023,'principale'),
  ('BAC','D','Philosophie',             2024,'principale'),
  ('BAC','D','Philosophie',             2023,'principale'),
  ('BAC','D','Anglais',                 2024,'principale'),
  ('BAC','D','SVT',                     2024,'rattrapage'),
  ('BAC','D','Mathématiques',           2024,'rattrapage')
ON CONFLICT DO NOTHING;

-- BAC Série A (Lettres et Sciences Humaines)
INSERT INTO annales (examen, serie, matiere, annee, session) VALUES
  ('BAC','A','Français',                2024,'principale'),
  ('BAC','A','Français',                2023,'principale'),
  ('BAC','A','Français',                2022,'principale'),
  ('BAC','A','Français',                2021,'principale'),
  ('BAC','A','Français',                2020,'principale'),
  ('BAC','A','Philosophie',             2024,'principale'),
  ('BAC','A','Philosophie',             2023,'principale'),
  ('BAC','A','Philosophie',             2022,'principale'),
  ('BAC','A','Histoire-Géographie',     2024,'principale'),
  ('BAC','A','Histoire-Géographie',     2023,'principale'),
  ('BAC','A','Histoire-Géographie',     2022,'principale'),
  ('BAC','A','Anglais',                 2024,'principale'),
  ('BAC','A','Anglais',                 2023,'principale'),
  ('BAC','A','Mathématiques',           2024,'principale'),
  ('BAC','A','Mathématiques',           2023,'principale')
ON CONFLICT DO NOTHING;

-- BAC Série A4 (Lettres Bilingues)
INSERT INTO annales (examen, serie, matiere, annee, session) VALUES
  ('BAC','A4','Français',               2024,'principale'),
  ('BAC','A4','Français',               2023,'principale'),
  ('BAC','A4','Français',               2022,'principale'),
  ('BAC','A4','Anglais',                2024,'principale'),
  ('BAC','A4','Anglais',                2023,'principale'),
  ('BAC','A4','Anglais',                2022,'principale'),
  ('BAC','A4','Philosophie',            2024,'principale'),
  ('BAC','A4','Philosophie',            2023,'principale'),
  ('BAC','A4','Histoire-Géographie',    2024,'principale'),
  ('BAC','A4','Histoire-Géographie',    2023,'principale'),
  ('BAC','A4','Latin',                  2024,'principale'),
  ('BAC','A4','Latin',                  2023,'principale')
ON CONFLICT DO NOTHING;

-- BAC Série B (Économie et Sciences Sociales)
INSERT INTO annales (examen, serie, matiere, annee, session) VALUES
  ('BAC','B','Économie',                2024,'principale'),
  ('BAC','B','Économie',                2023,'principale'),
  ('BAC','B','Économie',                2022,'principale'),
  ('BAC','B','Économie',                2021,'principale'),
  ('BAC','B','Économie',                2020,'principale'),
  ('BAC','B','Comptabilité',            2024,'principale'),
  ('BAC','B','Comptabilité',            2023,'principale'),
  ('BAC','B','Comptabilité',            2022,'principale'),
  ('BAC','B','Mathématiques',           2024,'principale'),
  ('BAC','B','Mathématiques',           2023,'principale'),
  ('BAC','B','Droit',                   2024,'principale'),
  ('BAC','B','Droit',                   2023,'principale'),
  ('BAC','B','Français',                2024,'principale'),
  ('BAC','B','Français',                2023,'principale'),
  ('BAC','B','Histoire-Géographie',     2024,'principale'),
  ('BAC','B','Histoire-Géographie',     2023,'principale')
ON CONFLICT DO NOTHING;

-- BAC Technique Série E
INSERT INTO annales (examen, serie, matiere, annee, session) VALUES
  ('BAC','E','Mathématiques',           2024,'principale'),
  ('BAC','E','Mathématiques',           2023,'principale'),
  ('BAC','E','Sciences Industrielles',  2024,'principale'),
  ('BAC','E','Sciences Industrielles',  2023,'principale'),
  ('BAC','E','Physique-Chimie',         2024,'principale'),
  ('BAC','E','Physique-Chimie',         2023,'principale')
ON CONFLICT DO NOTHING;

-- BAC Technique Série F
INSERT INTO annales (examen, serie, matiere, annee, session) VALUES
  ('BAC','F','Mathématiques',           2024,'principale'),
  ('BAC','F','Mathématiques',           2023,'principale'),
  ('BAC','F','Technologie',             2024,'principale'),
  ('BAC','F','Technologie',             2023,'principale'),
  ('BAC','F','Physique-Chimie',         2024,'principale'),
  ('BAC','F','Physique-Chimie',         2023,'principale')
ON CONFLICT DO NOTHING;

-- BAC Technique Série G1 (Gestion Comptable)
INSERT INTO annales (examen, serie, matiere, annee, session) VALUES
  ('BAC','G1','Comptabilité',           2024,'principale'),
  ('BAC','G1','Comptabilité',           2023,'principale'),
  ('BAC','G1','Comptabilité',           2022,'principale'),
  ('BAC','G1','Économie-Droit',         2024,'principale'),
  ('BAC','G1','Économie-Droit',         2023,'principale'),
  ('BAC','G1','Mathématiques',          2024,'principale'),
  ('BAC','G1','Mathématiques',          2023,'principale'),
  ('BAC','G1','Informatique',           2024,'principale'),
  ('BAC','G1','Informatique',           2023,'principale')
ON CONFLICT DO NOTHING;

-- BAC Technique Série G2 (Commercialisation)
INSERT INTO annales (examen, serie, matiere, annee, session) VALUES
  ('BAC','G2','Techniques Commerciales',2024,'principale'),
  ('BAC','G2','Techniques Commerciales',2023,'principale'),
  ('BAC','G2','Marketing',              2024,'principale'),
  ('BAC','G2','Marketing',              2023,'principale'),
  ('BAC','G2','Économie',               2024,'principale'),
  ('BAC','G2','Économie',               2023,'principale')
ON CONFLICT DO NOTHING;

-- BAC Technique Série G3 (Secrétariat)
INSERT INTO annales (examen, serie, matiere, annee, session) VALUES
  ('BAC','G3','Bureautique',            2024,'principale'),
  ('BAC','G3','Bureautique',            2023,'principale'),
  ('BAC','G3','Correspondance',         2024,'principale'),
  ('BAC','G3','Correspondance',         2023,'principale'),
  ('BAC','G3','Sténo-Dactylo',          2024,'principale'),
  ('BAC','G3','Sténo-Dactylo',          2023,'principale')
ON CONFLICT DO NOTHING;

-- ── PROBATOIRE — toutes séries ───────────────────────────────
INSERT INTO annales (examen, serie, matiere, annee, session) VALUES
  -- C
  ('Probatoire','C','Mathématiques',    2024,'principale'),
  ('Probatoire','C','Mathématiques',    2023,'principale'),
  ('Probatoire','C','Mathématiques',    2022,'principale'),
  ('Probatoire','C','Mathématiques',    2021,'principale'),
  ('Probatoire','C','Mathématiques',    2020,'principale'),
  ('Probatoire','C','Physique-Chimie',  2024,'principale'),
  ('Probatoire','C','Physique-Chimie',  2023,'principale'),
  ('Probatoire','C','Physique-Chimie',  2022,'principale'),
  ('Probatoire','C','Français',         2024,'principale'),
  ('Probatoire','C','Français',         2023,'principale'),
  ('Probatoire','C','Philosophie',      2024,'principale'),
  ('Probatoire','C','Philosophie',      2023,'principale'),
  ('Probatoire','C','Anglais',          2024,'principale'),
  ('Probatoire','C','SVT',              2024,'principale'),
  -- D
  ('Probatoire','D','SVT',              2024,'principale'),
  ('Probatoire','D','SVT',              2023,'principale'),
  ('Probatoire','D','SVT',              2022,'principale'),
  ('Probatoire','D','Mathématiques',    2024,'principale'),
  ('Probatoire','D','Mathématiques',    2023,'principale'),
  ('Probatoire','D','Chimie',           2024,'principale'),
  ('Probatoire','D','Chimie',           2023,'principale'),
  ('Probatoire','D','Français',         2024,'principale'),
  -- A
  ('Probatoire','A','Français',         2024,'principale'),
  ('Probatoire','A','Français',         2023,'principale'),
  ('Probatoire','A','Philosophie',      2024,'principale'),
  ('Probatoire','A','Histoire-Géographie',2024,'principale'),
  ('Probatoire','A','Anglais',          2024,'principale'),
  -- A4
  ('Probatoire','A4','Français',        2024,'principale'),
  ('Probatoire','A4','Anglais',         2024,'principale'),
  ('Probatoire','A4','Philosophie',     2024,'principale'),
  -- B
  ('Probatoire','B','Économie',         2024,'principale'),
  ('Probatoire','B','Économie',         2023,'principale'),
  ('Probatoire','B','Comptabilité',     2024,'principale'),
  ('Probatoire','B','Comptabilité',     2023,'principale'),
  ('Probatoire','B','Mathématiques',    2024,'principale'),
  -- G1
  ('Probatoire','G1','Comptabilité',    2024,'principale'),
  ('Probatoire','G1','Économie-Droit',  2024,'principale'),
  -- G2
  ('Probatoire','G2','Techniques Commerciales',2024,'principale'),
  -- G3
  ('Probatoire','G3','Bureautique',     2024,'principale')
ON CONFLICT DO NOTHING;

-- ── BEPC (Brevet d'Études du Premier Cycle) ──────────────────
INSERT INTO annales (examen, serie, matiere, annee, session) VALUES
  ('BEPC',NULL,'Mathématiques',         2024,'principale'),
  ('BEPC',NULL,'Mathématiques',         2023,'principale'),
  ('BEPC',NULL,'Mathématiques',         2022,'principale'),
  ('BEPC',NULL,'Mathématiques',         2021,'principale'),
  ('BEPC',NULL,'Mathématiques',         2020,'principale'),
  ('BEPC',NULL,'Mathématiques',         2019,'principale'),
  ('BEPC',NULL,'Mathématiques',         2018,'principale'),
  ('BEPC',NULL,'Français',              2024,'principale'),
  ('BEPC',NULL,'Français',              2023,'principale'),
  ('BEPC',NULL,'Français',              2022,'principale'),
  ('BEPC',NULL,'Français',              2021,'principale'),
  ('BEPC',NULL,'Français',              2020,'principale'),
  ('BEPC',NULL,'Français',              2019,'principale'),
  ('BEPC',NULL,'Français',              2018,'principale'),
  ('BEPC',NULL,'Anglais',               2024,'principale'),
  ('BEPC',NULL,'Anglais',               2023,'principale'),
  ('BEPC',NULL,'Anglais',               2022,'principale'),
  ('BEPC',NULL,'Anglais',               2021,'principale'),
  ('BEPC',NULL,'Anglais',               2020,'principale'),
  ('BEPC',NULL,'Sciences Physiques',    2024,'principale'),
  ('BEPC',NULL,'Sciences Physiques',    2023,'principale'),
  ('BEPC',NULL,'Sciences Physiques',    2022,'principale'),
  ('BEPC',NULL,'Sciences Physiques',    2021,'principale'),
  ('BEPC',NULL,'Sciences Physiques',    2020,'principale'),
  ('BEPC',NULL,'SVT',                   2024,'principale'),
  ('BEPC',NULL,'SVT',                   2023,'principale'),
  ('BEPC',NULL,'SVT',                   2022,'principale'),
  ('BEPC',NULL,'SVT',                   2021,'principale'),
  ('BEPC',NULL,'Histoire-Géographie',   2024,'principale'),
  ('BEPC',NULL,'Histoire-Géographie',   2023,'principale'),
  ('BEPC',NULL,'Histoire-Géographie',   2022,'principale'),
  ('BEPC',NULL,'Histoire-Géographie',   2021,'principale'),
  ('BEPC',NULL,'Économie de Marché',    2024,'principale'),
  ('BEPC',NULL,'Économie de Marché',    2023,'principale'),
  -- Sessions de rattrapage
  ('BEPC',NULL,'Mathématiques',         2024,'rattrapage'),
  ('BEPC',NULL,'Français',              2024,'rattrapage'),
  ('BEPC',NULL,'Anglais',               2024,'rattrapage'),
  ('BEPC',NULL,'Mathématiques',         2023,'rattrapage'),
  ('BEPC',NULL,'Français',              2023,'rattrapage')
ON CONFLICT DO NOTHING;
