/* ============================================================
   notifications.js — Initialisation OneSignal cote navigateur
   ============================================================ */

let _initPromise = null;

export function initNotificationsPush() {
  if (_initPromise) return _initPromise;
  _initPromise = _initNotificationsPush();
  return _initPromise;
}

async function _initNotificationsPush() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

  const config = await fetch('/api/public-config').then(r => r.ok ? r.json() : null).catch(() => null);
  const appId = config?.oneSignalAppId;
  if (!appId) return;

  await chargerSDKOneSignal();

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async OneSignal => {
    await OneSignal.init({
      appId,
      serviceWorkerPath: 'OneSignalSDKWorker.js',
      serviceWorkerParam: { scope: '/' },
    });
  });
}

function chargerSDKOneSignal() {
  if (document.querySelector('script[data-onesignal-sdk]')) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    script.dataset.onesignalSdk = 'true';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
