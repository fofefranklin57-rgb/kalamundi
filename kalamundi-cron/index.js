const SUPABASE_FUNC_URL = 'https://iobieffnaauecyukecds.supabase.co/functions/v1/publier-chapitres';
const SUPABASE_RPC_EXPIRER_EMPRUNTS = 'https://iobieffnaauecyukecds.supabase.co/rest/v1/rpc/expirer_emprunts';

export default {
  async scheduled(event, env, ctx) {
    const res = await fetch(SUPABASE_FUNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.SUPABASE_ANON_KEY,
      },
      body: '{}',
    });
    const data = await res.json().catch(() => ({}));
    console.log('publier-chapitres result:', JSON.stringify(data));

    // Emprunter/prêt (P4 #15) : libère les exemplaires échus et sert la file d'attente.
    const resEmprunts = await fetch(SUPABASE_RPC_EXPIRER_EMPRUNTS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_ANON_KEY,
      },
      body: '{}',
    });
    const empruntsData = await resEmprunts.json().catch(() => ({}));
    console.log('expirer_emprunts result:', JSON.stringify(empruntsData));
  },
};
