-- ============================================================
-- BLOC E3 — Espace École Kalamundi
-- Tables : classes, membres_classe, listes_lecture
-- À exécuter dans le SQL Editor Supabase
-- ============================================================

-- ── Table classes ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prof_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nom           TEXT NOT NULL,
  niveau        TEXT CHECK (niveau IN ('Primaire','Collège','Lycée','Université','Autre')),
  matiere       TEXT,
  code_acces    TEXT NOT NULL UNIQUE,  -- code court pour rejoindre (ex: KALA-7X2P)
  description   TEXT,
  actif         BOOLEAN DEFAULT true,
  nb_eleves     INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Table membres_classe ────────────────────────────────────
CREATE TABLE IF NOT EXISTS membres_classe (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classe_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  eleve_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date_adhesion TIMESTAMPTZ DEFAULT now(),
  UNIQUE(classe_id, eleve_id)
);

-- ── Table listes_lecture ────────────────────────────────────
CREATE TABLE IF NOT EXISTS listes_lecture (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classe_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  oeuvre_id     UUID NOT NULL REFERENCES oeuvres(id) ON DELETE CASCADE,
  ordre         INT DEFAULT 0,
  obligatoire   BOOLEAN DEFAULT true,
  note_prof     TEXT,
  date_limite   DATE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(classe_id, oeuvre_id)
);

-- ── Table progression_eleves ────────────────────────────────
CREATE TABLE IF NOT EXISTS progression_eleves (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  oeuvre_id      UUID NOT NULL REFERENCES oeuvres(id) ON DELETE CASCADE,
  classe_id      UUID REFERENCES classes(id) ON DELETE SET NULL,
  chapitre_lu    INT DEFAULT 0,
  nb_chapitres   INT DEFAULT 0,
  pourcentage    INT DEFAULT 0 CHECK (pourcentage BETWEEN 0 AND 100),
  termine        BOOLEAN DEFAULT false,
  derniere_lecture TIMESTAMPTZ DEFAULT now(),
  UNIQUE(eleve_id, oeuvre_id, classe_id)
);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE membres_classe ENABLE ROW LEVEL SECURITY;
ALTER TABLE listes_lecture ENABLE ROW LEVEL SECURITY;
ALTER TABLE progression_eleves ENABLE ROW LEVEL SECURITY;

-- Classes : le prof peut tout faire sur ses classes, tout le monde peut lire les classes actives
CREATE POLICY "classes_select_all" ON classes FOR SELECT USING (actif = true);
CREATE POLICY "classes_insert_prof" ON classes FOR INSERT WITH CHECK (auth.uid() = prof_id);
CREATE POLICY "classes_update_prof" ON classes FOR UPDATE USING (auth.uid() = prof_id);
CREATE POLICY "classes_delete_prof" ON classes FOR DELETE USING (auth.uid() = prof_id);

-- Membres : les élèves peuvent s'inscrire/se retirer, le prof peut voir
CREATE POLICY "membres_select" ON membres_classe FOR SELECT USING (
  auth.uid() = eleve_id OR
  auth.uid() IN (SELECT prof_id FROM classes WHERE id = classe_id)
);
CREATE POLICY "membres_insert" ON membres_classe FOR INSERT WITH CHECK (auth.uid() = eleve_id);
CREATE POLICY "membres_delete" ON membres_classe FOR DELETE USING (auth.uid() = eleve_id);

-- Listes : le prof gère, les membres peuvent lire
CREATE POLICY "listes_select" ON listes_lecture FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM membres_classe mc
    WHERE mc.classe_id = listes_lecture.classe_id AND mc.eleve_id = auth.uid()
  ) OR
  EXISTS (SELECT 1 FROM classes c WHERE c.id = listes_lecture.classe_id AND c.prof_id = auth.uid())
);
CREATE POLICY "listes_insert_prof" ON listes_lecture FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM classes c WHERE c.id = classe_id AND c.prof_id = auth.uid())
);
CREATE POLICY "listes_delete_prof" ON listes_lecture FOR DELETE USING (
  EXISTS (SELECT 1 FROM classes c WHERE c.id = listes_lecture.classe_id AND c.prof_id = auth.uid())
);

-- Progression : chaque élève gère la sienne
CREATE POLICY "progression_select" ON progression_eleves FOR SELECT USING (
  auth.uid() = eleve_id OR
  EXISTS (SELECT 1 FROM classes c WHERE c.id = classe_id AND c.prof_id = auth.uid())
);
CREATE POLICY "progression_upsert" ON progression_eleves FOR INSERT WITH CHECK (auth.uid() = eleve_id);
CREATE POLICY "progression_update" ON progression_eleves FOR UPDATE USING (auth.uid() = eleve_id);

-- ── Trigger : mettre à jour nb_eleves ──────────────────────
CREATE OR REPLACE FUNCTION maj_nb_eleves()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE classes SET nb_eleves = nb_eleves + 1 WHERE id = NEW.classe_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE classes SET nb_eleves = GREATEST(nb_eleves - 1, 0) WHERE id = OLD.classe_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trig_nb_eleves ON membres_classe;
CREATE TRIGGER trig_nb_eleves
AFTER INSERT OR DELETE ON membres_classe
FOR EACH ROW EXECUTE FUNCTION maj_nb_eleves();

-- ── Index ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_classes_prof      ON classes(prof_id);
CREATE INDEX IF NOT EXISTS idx_membres_classe    ON membres_classe(classe_id);
CREATE INDEX IF NOT EXISTS idx_membres_eleve     ON membres_classe(eleve_id);
CREATE INDEX IF NOT EXISTS idx_listes_classe     ON listes_lecture(classe_id);
CREATE INDEX IF NOT EXISTS idx_progression_eleve ON progression_eleves(eleve_id);
