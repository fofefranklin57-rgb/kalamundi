/* ============================================================
   reclamer.js — Réclamation d'un cadeau (diaspora)
   Kalamundi — La Plume du Monde

   Le bénéficiaire saisit le code reçu ; la RPC reclamer_cadeau
   (SECURITY DEFINER) vérifie et accorde l'accès. Aucune logique de
   sécurité ici : tout est dans la RPC côté serveur.
   ============================================================ */

import { getSession, supabase } from './auth.js';

/* Retire tirets/espaces et met en majuscules : le code stocké est brut,
   mais on le partage formaté « ABCD-EFGH-JKMN ». */
function normaliserCode(saisie) {
  return String(saisie || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await getSession();

  if (!session) {
    document.getElementById('claim-card').style.display = 'none';
    document.getElementById('zone-auth').innerHTML = `
      <div class="empty-state" style="margin-bottom:var(--spacing-xl)">
        <div class="empty-state__icon">🔐</div>
        <p class="empty-state__title">Connexion requise</p>
        <p class="empty-state__text">Connectez-vous pour ajouter le cadeau à votre bibliothèque.</p>
        <a href="/pages/login.html?redirect=/pages/reclamer.html${window.location.search}"
           class="btn btn--primary">Se connecter</a>
      </div>`;
    return;
  }

  /* Pré-remplissage possible via ?code=... (lien partagé) */
  const codeUrl = new URLSearchParams(window.location.search).get('code');
  if (codeUrl) document.getElementById('code').value = codeUrl;

  const btn = document.getElementById('btn-reclamer');
  const input = document.getElementById('code');
  btn.addEventListener('click', reclamer);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') reclamer(); });
});

async function reclamer() {
  const btn = document.getElementById('btn-reclamer');
  const zoneMsg = document.getElementById('claim-message');
  const code = normaliserCode(document.getElementById('code').value);
  zoneMsg.innerHTML = '';

  if (code.length < 8) {
    zoneMsg.innerHTML = `<div class="alert alert--warning">Saisissez le code complet reçu.</div>`;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Vérification…';

  const { data, error } = await supabase.rpc('reclamer_cadeau', { p_code: code });

  if (error || !data?.ok) {
    btn.disabled = false;
    btn.textContent = 'Débloquer mon livre';
    zoneMsg.innerHTML = `<div class="alert alert--error">${escapeHtml(messageErreur(error))}</div>`;
    return;
  }

  /* Succès : bascule vers l'écran de confirmation */
  document.getElementById('claim-card').style.display = 'none';
  const succes = document.getElementById('zone-succes');
  succes.style.display = 'block';
  if (data.message) {
    document.getElementById('succes-message').textContent = `« ${data.message} » — le livre est dans votre bibliothèque.`;
  }
  document.getElementById('succes-lire').href = `/pages/reader.html?id=${encodeURIComponent(data.oeuvre_id)}&ch=1`;
}

/* La RPC renvoie des messages métier explicites (déjà réclamé, non payé…) :
   on les affiche tels quels ; sinon, message générique. */
function messageErreur(error) {
  const brut = error?.message || '';
  if (/introuvable/i.test(brut)) return 'Code cadeau introuvable. Vérifiez la saisie.';
  if (/deja ete reclame|déjà/i.test(brut)) return 'Ce cadeau a déjà été réclamé.';
  if (/pas encore paye|payé/i.test(brut)) return 'Ce cadeau n\'est pas encore confirmé. Réessayez dans quelques instants.';
  if (/propre cadeau/i.test(brut)) return 'Vous ne pouvez pas réclamer votre propre cadeau.';
  if (/annule|annulé/i.test(brut)) return 'Ce cadeau a été annulé.';
  return brut || 'Réclamation impossible. Réessayez.';
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
