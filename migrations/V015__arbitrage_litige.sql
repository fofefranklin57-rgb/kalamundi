-- ============================================================
-- V015 — Arbitrage admin des litiges occasion (reste de P4 #14)
-- Objectif : un litige ouvert (acheteur ou vendeur) doit pouvoir être
-- tranché par un administrateur. `scripts/lib/occasion-etats.mjs` prévoit
-- déjà les transitions admin (litige→clos, litige→rembourse) : cette
-- migration ajoute la RPC SECURITY DEFINER manquante côté SQL, ainsi que
-- la visibilité admin sur les commandes (le RLS actuel ne laisse voir une
-- commande qu'à l'acheteur ou au vendeur).
--
-- 'clos'      = litige tranché en faveur du VENDEUR (fonds à verser, comme une clôture normale)
-- 'rembourse' = litige tranché en faveur de l'ACHETEUR (aucun compte de
--               remboursement n'est capturé à la commande : le virement
--               retour reste une action manuelle de l'admin via Fapshi)
-- ============================================================

DROP POLICY IF EXISTS "cmd_occasion_lecture_admin" ON commandes_occasion;
CREATE POLICY "cmd_occasion_lecture_admin" ON commandes_occasion
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE OR REPLACE FUNCTION resoudre_litige(p_commande_id UUID, p_decision TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cmd commandes_occasion%ROWTYPE;
  v_est_admin BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') INTO v_est_admin;
  IF NOT v_est_admin THEN
    RAISE EXCEPTION 'Seul un administrateur peut trancher un litige.';
  END IF;

  IF p_decision NOT IN ('clos', 'rembourse') THEN
    RAISE EXCEPTION 'Décision invalide (clos ou rembourse).';
  END IF;

  SELECT * INTO v_cmd FROM commandes_occasion WHERE id = p_commande_id FOR UPDATE;
  IF v_cmd.id IS NULL THEN RAISE EXCEPTION 'Commande introuvable.'; END IF;
  IF v_cmd.statut <> 'litige' THEN RAISE EXCEPTION 'Cette commande n''est pas en litige.'; END IF;

  IF p_decision = 'clos' THEN
    UPDATE commandes_occasion
       SET statut = 'clos', clos_at = now(), fonds_liberes = true, payout_statut = 'a_verser'
     WHERE id = p_commande_id;
  ELSE
    UPDATE commandes_occasion
       SET statut = 'rembourse', clos_at = now(), fonds_liberes = false, payout_statut = 'rembourse'
     WHERE id = p_commande_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION resoudre_litige(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resoudre_litige(UUID, TEXT) TO authenticated;
