'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    OneSignalDeferred?: any[];
  }
}

/**
 * Loads the OneSignal Web SDK on admin pages only and shows a small opt-in
 * button so Hunter can subscribe this device/browser to push notifications.
 * Targets all subscribers with "Subscribed Users" segment when sending —
 * there's only ever one (Hunter), so no per-user player ID storage needed.
 */
export default function OneSignalInit() {
  const [status, setStatus] = useState<'loading' | 'subscribed' | 'unsubscribed' | 'unsupported'>(
    'loading'
  );

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (!appId) {
      setStatus('unsupported');
      return;
    }

    if (!document.getElementById('onesignal-sdk-script')) {
      const script = document.createElement('script');
      script.id = 'onesignal-sdk-script';
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.defer = true;
      document.head.appendChild(script);
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      await OneSignal.init({
        appId,
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        notifyButton: { enable: false },
      });

      const refreshStatus = async () => {
        try {
          const optedIn = await OneSignal.User.PushSubscription.optedIn;
          setStatus(optedIn ? 'subscribed' : 'unsubscribed');
        } catch {
          setStatus('unsubscribed');
        }
      };
      await refreshStatus();
      OneSignal.User.PushSubscription.addEventListener('change', refreshStatus);
    });
  }, []);

  const handleSubscribe = () => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      await OneSignal.User.PushSubscription.optIn();
      try {
        await OneSignal.Notifications.requestPermission();
      } catch {
        // permission prompt may already be resolved; ignore
      }
    });
  };

  if (status === 'unsupported' || status === 'subscribed') return null;

  return (
    <button
      onClick={handleSubscribe}
      className="fixed bottom-4 right-4 z-50 bg-brand hover:bg-brandDark text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg transition"
    >
      Enable push notifications
    </button>
  );
}
