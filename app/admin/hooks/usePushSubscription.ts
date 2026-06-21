'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    OneSignalDeferred?: any[];
  }
}

export type PushStatus = 'loading' | 'subscribed' | 'unsubscribed' | 'unsupported' | 'blocked';

// Polls for OneSignal.User.PushSubscription.id — only present once the
// subscription has actually round-tripped to OneSignal's backend, unlike
// `optedIn` which flips locally and immediately.
async function waitForSubscriptionId(OneSignal: any, timeoutMs: number): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const id = OneSignal.User.PushSubscription.id;
    if (id) return id;
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

/**
 * Shared OneSignal Web SDK init + subscribe logic, used by both the small
 * floating opt-in button (OneSignalInit) and the full Settings > Notifications
 * tab. Centralizing this means there's exactly one place that knows how to
 * load the SDK, check status, and handle the subscribe flow correctly.
 */
export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [subscribing, setSubscribing] = useState(false);
  // Holds the live OneSignal object once init() resolves, so the click
  // handler can call its methods directly instead of re-queueing through
  // OneSignalDeferred — going through the deferred queue detaches the call
  // from the click's user gesture, which makes browsers silently ignore the
  // permission prompt (this was the root cause of the button doing nothing
  // in an earlier version).
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
      try {
        await OneSignal.init({
          appId,
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          notifyButton: { enable: false },
        });
      } catch (err) {
        // If the OneSignal app's Web Push platform isn't fully configured
        // in the dashboard (site URL / icon / permission prompt not saved),
        // init() throws and the button would otherwise stay disabled
        // forever, stuck on "loading". Hide it instead of leaving a dead
        // greyed-out button on screen.
        console.error('[push] OneSignal.init failed:', err);
        setStatus('unsupported');
        return;
      }

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

    // If notification permission was ever denied for this origin before
    // (e.g. during an earlier broken setup), Chrome will never show the
    // permission dialog again no matter how many times this button is
    // tapped — requestPermission() just silently resolves without any
    // prompt or error, and OneSignal can never create a real subscription.
    // Surface that explicitly instead of spinning forever / failing silently.
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setStatus('blocked');
      return;
    }

    setSubscribing(true);
    try {
      await OneSignal.Notifications.requestPermission();
      await OneSignal.User.PushSubscription.optIn();

      // IMPORTANT: `optedIn` flips true as soon as optIn() resolves, but
      // that's just local "user wants to be subscribed" intent — it does
      // NOT mean OneSignal's backend has actually finished creating the
      // player/subscription record yet. That sync happens async over the
      // network right after, and on mobile (user backgrounding the tab/
      // locking the phone the instant the button disappears) it can get
      // cut off, leaving the button gone but OneSignal showing 0 real
      // subscribers. Wait for a real backend-assigned subscription id
      // before declaring success, so we never lie about it.
      const subscriptionId = await waitForSubscriptionId(OneSignal, 8000);
      if (subscriptionId) {
        setStatus('subscribed');
        console.log('[push] subscribed, id:', subscriptionId);
      } else {
        console.error(
          '[push] permission was granted but no OneSignal subscription id appeared within 8s — ' +
            'the backend sync likely did not complete. Keep this tab open and try again.'
        );
        setStatus('unsubscribed');
      }
    } catch (err) {
      console.error('[push] failed to enable notifications:', err);
      setStatus('unsubscribed');
    } finally {
      setSubscribing(false);
    }
  };

  return { status, subscribing, handleSubscribe };
}
