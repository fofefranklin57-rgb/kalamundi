/* Config publique exposee au navigateur. Ne jamais mettre de secret ici. */

export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    oneSignalAppId: env.ONESIGNAL_APP_ID || null,
  }), {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
