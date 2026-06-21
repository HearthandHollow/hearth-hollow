'use client';

import { usePushSubscription } from '../hooks/usePushSubscription';

/**
 * Small floating opt-in button shown on every admin page (mounted in
 * app/admin/layout.tsx) so Hunter can subscribe this device to push
 * notifications without hunting for a settings page.
 *
 * The fuller version — with status text and a bigger touch target — lives at
 * Settings → Notifications (NotificationsSettings.tsx), sharing the same
 * usePushSubscription hook. That page is the more reliable place to subscribe
 * from on mobile, where a tiny fixed corner button can land in an Android
 * gesture-nav zone or shift when Chrome's toolbar collapses.
 */
export default function PushOptIn() {
  const { status, subscribing, handleSubscribe } = usePushSubscription();

  if (status === 'unsupported' || status === 'subscribed' || status === 'loading') {
    return null;
  }

  if (status === 'blocked') {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-xs bg-white border border-themeBorder text-themeMuted text-xs px-4 py-3 rounded-lg shadow-lg">
        Notifications are blocked for this site in your browser. Tap the
        lock/info icon next to the address bar → Permissions → Notifications →
        Allow, then reload — or use Settings → Notifications.
      </div>
    );
  }

  return (
    <button
      onClick={handleSubscribe}
      disabled={subscribing}
      className="fixed bottom-4 right-4 z-50 bg-brand hover:bg-brandDark disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg transition"
    >
      {subscribing ? 'Enabling…' : 'Enable push notifications'}
    </button>
  );
}
