const SUPABASE_FUNC_URL = 'https://iobieffnaauecyukecds.supabase.co/functions/v1/publier-chapitres';

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
  },
};
