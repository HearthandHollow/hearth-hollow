'use client';

import { useEffect, useRef, useState } from 'react';

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
  const [subscribing, setSubscribing] = useState(false);
  // Holds the live OneSignal object once init() resolves, so the click
  // handler can call its methods directly instead of re-queueing through
  // OneSignalDeferred — going through the deferred queue detaches the call
  // from the click's user gesture, which makes browsers silently ignore the
  // permission prompt (this was the root cause of the button doing nothing).
  const oneSignalRef = useRef<any>(null);

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

      oneSignalRef.current = OneSignal;

      const refreshStatus = () => {
        const optedIn = !!OneSignal.User.PushSubscription.optedIn;
        setStatus(optedIn ? 'subscribed' : 'unsubscribed');
      };
      refreshStatus();
      OneSignal.User.PushSubscription.addEventListener('change', refreshStatus);
    });
  }, []);

  const handleSubscribe = async () => {
    const OneSignal = oneSignalRef.current;
    if (!OneSignal || subscribing) return;

    setSubscribing(true);
    try {
      await OneSignal.Notifications.requestPermission();
      await OneSignal.User.PushSubscription.optIn();
      // Don't rely solely on the SDK's "change" event — check directly so
      // the button reliably disappears the moment subscribing succeeds.
      const optedIn = !!OneSignal.User.PushSubscription.optedIn;
      setStatus(optedIn ? 'subscribed' : 'unsubscribed');
      if (!optedIn) {
        console.warn('[push] permission was not granted; still showing the button');
      }
    } catch (err) {
      console.error('[push] failed to enable notifications:', err);
    } finally {
      setSubscribing(false);
    }
  };

  if (status === 'unsupported' || status === 'subscribed') return null;

  const sdkReady = status !== 'loading';

  return (
    <button
      onClick={handleSubscribe}
      disabled={!sdkReady || subscribing}
      className="fixed bottom-4 right-4 z-50 bg-brand hover:bg-brandDark disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg transition"
    >
      {subscribing ? 'Enabling…' : 'Enable push notifications'}
    </button>
  );
}
