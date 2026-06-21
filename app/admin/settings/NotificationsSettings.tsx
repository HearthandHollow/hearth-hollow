'use client';

import { usePushSubscription } from '../hooks/usePushSubscription';

/**
 * Full-size push notification opt-in, living in a normal page flow (not a
 * fixed-position overlay) so it isn't subject to mobile-viewport edge cases:
 * Android gesture-nav zones along screen edges, Chrome's address bar
 * collapsing/expanding on scroll and shifting fixed-position elements, or a
 * tiny corner touch target simply being easy to miss. Same underlying logic
 * as the floating button (OneSignalInit), via usePushSubscription.
 */
export default function NotificationsSettings() {
  const { status, subscribing, handleSubscribe, errorDetail } = usePushSubscription();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-themeText">Push Notifications</h2>
        <p className="text-sm text-themeMuted mt-1">
          Get a notification on this device when a new quote request comes
          in, a customer replies by email, or an appointment gets scheduled.
        </p>
      </div>

      <div className="border border-themeBorder rounded-lg p-4 bg-themeBg">
        {status === 'loading' && (
          <p className="text-sm text-themeMuted">Checking notification status…</p>
        )}

        {status === 'unsupported' && (
          <div className="space-y-2">
            <p className="text-sm text-themeMuted">
              Push notifications aren't configured for this browser/site right
              now. (OneSignal failed to initialize — check the browser console
              for details, or confirm the OneSignal app's Web Push setup is
              complete in its dashboard.)
            </p>
            {errorDetail && (
              <p className="text-xs font-mono text-red-700 bg-red-50 border border-red-200 rounded p-2 break-words">
                {errorDetail}
              </p>
            )}
          </div>
        )}

        {status === 'subscribed' && (
          <p className="text-sm text-green-700 font-medium">
            ✓ This device is subscribed to push notifications.
          </p>
        )}

        {status === 'blocked' && (
          <div className="text-sm text-themeText space-y-2">
            <p className="font-medium text-red-700">
              Notifications are blocked for this site in this browser.
            </p>
            <p>
              Tap the lock/info icon next to the address bar → Permissions →
              Notifications → set to Allow, then reload this page and tap the
              button below again.
            </p>
            <p className="text-themeMuted">
              On Android, also check Settings → Apps → Chrome → Notifications
              is turned on at the OS level — if that's off, Chrome can't
              prompt for any site's notifications at all.
            </p>
          </div>
        )}

        {status === 'unsubscribed' && (
          <div className="space-y-2">
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="bg-brand hover:bg-brandDark disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-3 rounded-lg shadow transition w-full sm:w-auto"
            >
              {subscribing ? 'Enabling…' : 'Enable push notifications on this device'}
            </button>
            {errorDetail && (
              <p className="text-xs font-mono text-red-700 bg-red-50 border border-red-200 rounded p-2 break-words">
                {errorDetail}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
