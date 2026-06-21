'use client';

import { usePushSubscription } from '../hooks/usePushSubscription';

/**
 * Small floating opt-in button shown on every admin page (mounted in
 * app/admin/layout.tsx) so Hunter can subscribe this device/browser to push
 * notifications without having to go find a settings page first.
 *
 * A fuller version of this same flow — with status text and bigger touch
 * target — also lives at Settings > Notifications
 * (app/admin/settings/NotificationsSettings.tsx), sharing the same
 * usePushSubscription hook. That's the more reliable place to subscribe from
 * on mobile: a small fixed-position corner button can land in an Android
 * gesture-nav zone or shift position when Chrome's toolbar collapses,
 * causing taps to silently miss the element entirely.
 */
export default function OneSignalInit() {
  const { status, subscribing, handleSubscribe } = usePushSubscription();

  if (status === 'unsupported' || status === 'subscribed') return null;

  if (status === 'blocked') {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-xs bg-white border border-themeBorder text-themeMuted text-xs px-4 py-3 rounded-lg shadow-lg">
        Notifications are blocked for this site in Chrome. Tap the lock/info
        icon next to the address bar → Permissions → Notifications → Allow,
        then reload this page and try again — or use Settings →
        Notifications for a bigger button.
      </div>
    );
  }

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
