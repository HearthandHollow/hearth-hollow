'use client';

import { useEffect, useRef, useState } from 'react';

export type PushStatus =
  | 'loading'
  | 'subscribed'
  | 'unsubscribed'
  | 'unsupported'
  | 'blocked';

const SW_URL = '/push-sw.js';

// VAPID public keys are base64url; PushManager.subscribe needs the raw bytes.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  // Allocate an explicit ArrayBuffer so the result is Uint8Array<ArrayBuffer>,
  // which satisfies PushManager.subscribe's BufferSource type (a bare
  // `new Uint8Array(n)` infers Uint8Array<ArrayBufferLike> and is rejected).
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Clean up any leftover OneSignal service workers from the previous
// integration so they can't intercept push events or confuse scope.
async function unregisterLegacyWorkers() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.map(async (r) => {
        const script =
          r.active?.scriptURL ||
          r.installing?.scriptURL ||
          r.waiting?.scriptURL ||
          '';
        if (script.includes('OneSignal')) {
          await r.unregister();
        }
      })
    );
  } catch {
    /* best-effort */
  }
}

/**
 * Native Web Push subscription logic, shared by the floating opt-in button
 * (PushOptIn) and the Settings → Notifications tab. Registers our own service
 * worker (/push-sw.js), subscribes via the browser's PushManager using our
 * VAPID public key, and saves the resulting subscription (endpoint + p256dh +
 * auth) to our server so lib/push.ts can deliver to it directly. No third
 * party involved.
 */
export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [subscribing, setSubscribing] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const regRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    let cancelled = false;
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    async function init() {
      const supported =
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;
      if (!supported) {
        setStatus('unsupported');
        return;
      }
      if (!vapid) {
        setErrorDetail('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set in this build');
        setStatus('unsupported');
        return;
      }

      try {
        await unregisterLegacyWorkers();
        const reg = await navigator.serviceWorker.register(SW_URL, {
          scope: '/',
        });
        await navigator.serviceWorker.ready;
        if (cancelled) return;
        regRef.current = reg;

        if (Notification.permission === 'denied') {
          setStatus('blocked');
          return;
        }
        const existing = await reg.pushManager.getSubscription();
        setStatus(
          existing && Notification.permission === 'granted'
            ? 'subscribed'
            : 'unsubscribed'
        );
      } catch (err: any) {
        if (cancelled) return;
        setErrorDetail(err?.message ? String(err.message) : String(err));
        setStatus('unsupported');
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubscribe = async () => {
    if (subscribing) return;
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const reg = regRef.current;
    if (!reg || !vapid) return;

    // A prior "deny" sticks — Chrome won't re-prompt. Surface it instead of
    // spinning silently.
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setStatus('blocked');
      return;
    }

    setSubscribing(true);
    setErrorDetail(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'denied') {
        setStatus('blocked');
        return;
      }
      if (permission !== 'granted') {
        setStatus('unsubscribed');
        return;
      }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        });
      }

      const res = await fetch('/api/admin/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        throw new Error(`Saving subscription failed: ${res.status}`);
      }
      setStatus('subscribed');
    } catch (err: any) {
      setErrorDetail(err?.message ? String(err.message) : String(err));
      setStatus('unsubscribed');
    } finally {
      setSubscribing(false);
    }
  };

  return { status, subscribing, handleSubscribe, errorDetail };
}
