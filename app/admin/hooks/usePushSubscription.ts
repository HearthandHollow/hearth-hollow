'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    OneSignalDeferred?: any[];
    __oneSignalInitPromise?: Promise<any>;
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

// Singleton guard: OneSignal.init() can only run once per page load — calling
// it a second time throws "SDK already initialized". usePushSubscription is
// mounted twice at once on /admin/settings (the floating OneSignalInit button
// lives in the shared admin layout chunk, and the Notifications tab mounts
// its own instance from the page chunk), so every hook instance must share
// one underlying init() call instead of racing to call it themselves.
//
// IMPORTANT: this guard lives on `window`, not as a module-level variable.
// A module-level `let initPromise` only dedupes correctly if every consumer
// shares the exact same evaluated copy of this module — but webpack can
// (and here, did) put OneSignalInit's copy in the shared admin layout chunk
// and NotificationsSettings' copy in the /admin/settings page chunk as two
// separate module instances, each with its own independent `initPromise`.
// That looked like a working singleton in isolated testing but still let
// both chunks call OneSignal.init() in production. `window` is the one thing
// guaranteed to be shared no matter how the code gets split, so the guard
// has to live there.
function getOneSignal(appId: string): Promise<any> {
  if (window.__oneSignalInitPromise) return window.__oneSignalInitPromise;

  window.__oneSignalInitPromise = new Promise((resolve, reject) => {
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
        resolve(OneSignal);
      } catch (err: any) {
        // Belt-and-suspenders: if something outside our control still
        // manages to call init() twice (e.g. a future second consumer, or
        // a leftover queued call from before this guard ran), don't treat
        // "already initialized" as fatal — OneSignal is still usable via
        // the global it attaches to window in that case.
        if (typeof err?.message === 'string' && err.message.includes('already initialized') && (window as any).OneSignal) {
          resolve((window as any).OneSignal);
        } else {
          reject(err);
        }
      }
    });
  });

  return window.__oneSignalInitPromise;
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

    let cancelled = false;

    getOneSignal(appId)
      .then((OneSignal: any) => {
        if (cancelled) return;
        oneSignalRef.current = OneSignal;

        const refreshStatus = () => {
          const optedIn = !!OneSignal.User.PushSubscription.optedIn;
          setStatus(optedIn ? 'subscribed' : 'unsubscribed');
        };
        refreshStatus();
        OneSignal.User.PushSubscription.addEventListener('change', refreshStatus);
      })
      .catch((err: any) => {
        // If the OneSignal app's Web Push platform isn't fully configured
        // in the dashboard (site URL / icon / permission prompt not saved),
        // init() throws and the button would otherwise stay disabled
        // forever, stuck on "loading". Hide it instead of leaving a dead
        // greyed-out button on screen.
        if (cancelled) return;
        console.error('[push] OneSignal.init failed:', err);
        setStatus('unsupported');
      });

    return () => {
      cancelled = true;
    };
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
