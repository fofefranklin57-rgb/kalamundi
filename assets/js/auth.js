/* ============================================================
   auth.js — Authentification Supabase, sessions, protection routes
   Kalamundi — La Plume du Monde
   ============================================================ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://iobieffnaauecyukecds.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvYmllZmZuYWF1ZWN5dWtlY2RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NDIzNTEsImV4cCI6MjA5NjMxODM1MX0.w1_Zv9VeVvoLlt1H0d7wN8To-A5DAxSfszV0kJ_5NRE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ============================================================
   Anti-bruteforce
   ============================================================ */

const MAX_TENTATIVES = 5;
const DUREE_BLOCAGE  = 30 * 60 * 1000; // 30 minutes

function getTentatives() {
  const data = JSON.parse(localStorage.getItem('kala_tentatives') || '{"count":0,"since":0}');
  if (Date.now() - data.since > DUREE_BLOCAGE) {
    localStorage.removeItem('kala_tentatives');
    return { count: 0, since: 0 };
  }
  return data;
}

function incrementTentatives() {
  const data = getTentatives();
  const next = { count: data.count + 1, since: data.since || Date.now() };
  localStorage.setItem('kala_tentatives', JSON.stringify(next));
  return next.count;
}

function resetTentatives() {
  localStorage.removeItem('kala_tentatives');
}

/* ============================================================
   Connexion email + mot de passe
   ============================================================ */

export async function connexion(email, password) {
  const tentatives = getTentatives();
  if (tentatives.count >= MAX_TENTATIVES) {
    const restant = Math.ceil((DUREE_BLOCAGE - (Date.now() - tentatives.since)) / 60000);
    throw new Error(`Compte temporairement bloqué. Réessayez dans ${restant} minute(s).`);
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const nb = incrementTentatives();
    const restantes = MAX_TENTATIVES - nb;
    if (restantes > 0) {
      throw new Error(`Email ou mot de passe incorrect. ${restantes} tentative(s) restante(s).`);
    } else {
      throw new Error('Trop de tentatives échouées. Compte bloqué 30 minutes.');
    }
  }

  resetTentatives();
  await _creerProfilSiAbsent(data.user);
  return data;
}

/* ============================================================
   Inscription
   ============================================================ */

export async function inscription(email, password, nom) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);

  if (data.user) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id:    data.user.id,
      email: email,
      nom:   nom,
      role:  'lecteur',
    });
    if (profileError && profileError.code !== '23505') {
      throw new Error(profileError.message);
    }
  }

  return data;
}

/* ============================================================
   Connexion Google
   ============================================================ */

export async function connexionGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/pages/login.html?callback=1' },
  });
  if (error) throw new Error(error.message);
}

/* ============================================================
   Déconnexion
   ============================================================ */

export async function deconnexion() {
  await supabase.auth.signOut();
  localStorage.removeItem('kala_tentatives');
  window.location.href = '/index.html';
}

/* ============================================================
   Session courante
   ============================================================ */

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/* ============================================================
   Profil étendu (table profiles)
   ============================================================ */

export async function getProfil(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getProfilCourant() {
  const user = await getUser();
  if (!user) return null;
  return getProfil(user.id);
}

/* ============================================================
   Réinitialisation mot de passe
   ============================================================ */

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/pages/login.html?reset=1',
  });
  if (error) throw new Error(error.message);
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

/* ============================================================
   Protection de routes — à appeler en haut de chaque page privée
   ============================================================ */

export async function protegerRoute(roleRequis = null) {
  const session = await getSession();
  if (!session) {
    window.location.href = '/pages/login.html?redirect=' + encodeURIComponent(window.location.pathname);
    return null;
  }
  if (roleRequis) {
    const profil = await getProfil(session.user.id);
    if (profil.role !== roleRequis && profil.role !== 'admin') {
      window.location.href = '/index.html';
      return null;
    }
    return profil;
  }
  return session;
}

/* ============================================================
   Écouteur de changement de session (navbar, état UI)
   ============================================================ */

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}

/* ============================================================
   Interne — créer le profil si absent (connexion OAuth)
   ============================================================ */

async function _creerProfilSiAbsent(user) {
  if (!user) return;
  const { data } = await supabase.from('profiles').select('id').eq('id', user.id).single();
  if (!data) {
    await supabase.from('profiles').insert({
      id:    user.id,
      email: user.email,
      nom:   user.user_metadata?.full_name || user.email.split('@')[0],
      role:  'lecteur',
    });
  }
}
