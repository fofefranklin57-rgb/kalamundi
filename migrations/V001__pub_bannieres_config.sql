-- Migration V001 — Régie publicitaire + Configuration plateforme
-- À exécuter dans Supabase SQL Editor

-- ============================================================
-- pub_bannieres
-- ============================================================
CREATE TABLE IF NOT EXISTS pub_bannieres (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  titre       text        NOT NULL,
  image_url   text,
  lien_cible  text,
  texte_cta   text        DEFAULT 'En savoir plus',
  page_cible  text        DEFAULT 'all',
  roles_cibles text[]     DEFAULT ARRAY['lecteur'],
  actif       boolean     DEFAULT true,
  impressions integer     DEFAULT 0,
  clics       integer     DEFAULT 0,
  date_debut  date,
  date_fin    date,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE pub_bannieres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_pub" ON pub_bannieres FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "public_read_bannieres_actives" ON pub_bannieres FOR SELECT TO anon, authenticated
  USING (
    actif = true
    AND (date_debut IS NULL OR date_debut <= CURRENT_DATE)
    AND (date_fin   IS NULL OR date_fin   >= CURRENT_DATE)
  );

-- ============================================================
-- config_plateforme
-- ============================================================
CREATE TABLE IF NOT EXISTS config_plateforme (
  cle         text PRIMARY KEY,
  valeur      text,
  description text,
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE config_plateforme ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_config" ON config_plateforme FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "public_read_config" ON config_plateforme FOR SELECT TO anon, authenticated
  USING (true);

-- Valeurs par défaut
INSERT INTO config_plateforme (cle, valeur, description) VALUES
  ('commission_auteur',      '50',    'Pourcentage reversé à l''auteur sur ventes premium (%)'),
  ('message_systeme',        '',      'Bandeau affiché sur toutes les pages (vide = désactivé)'),
  ('maintenance_mode',       'false', 'Mode maintenance (true = accès bloqué pour lecteurs)'),
  ('prix_premium_mensuel',   '2.99',  'Prix abonnement lecteur premium mensuel (USD)'),
  ('prix_premium_annuel',    '24.99', 'Prix abonnement lecteur premium annuel (USD)'),
  ('inscription_ouverte',    'true',  'Autoriser les nouvelles inscriptions (true/false)'),
  ('pub_activee',            'true',  'Activer la régie publicitaire globalement (true/false)')
ON CONFLICT (cle) DO NOTHING;
