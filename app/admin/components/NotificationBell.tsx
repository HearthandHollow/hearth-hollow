'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  url: string | null;
  viewedAt: string | null;
  createdAt: string;
};

const POLL_MS = 30_000;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications?limit=20', { cache: 'no-store' });
      if (res.status === 401) {
        setHidden(true);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      const count = data.unreadCount ?? 0;
      setNotifications(data.notifications ?? []);
      setUnreadCount(count);
      // Keep the installed-app icon badge in sync while the app is open
      // (and right after marking notifications read). No-op unless installed.
      try {
        if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
          if (count > 0) (navigator as any).setAppBadge(count);
          else (navigator as any).clearAppBadge();
        }
      } catch {
        /* badging unsupported — ignore */
      }
    } catch {
      // Network hiccup — keep stale state, try again next poll.
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (hidden) return null;

  async function markAllRead() {
    setLoading(true);
    try {
      await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      await fetchNotifications();
    } finally {
      setLoading(false);
    }
  }

  async function handleClickNotification(n: Notification) {
    setOpen(false);
    if (!n.viewedAt) {
      try {
        await fetch('/api/admin/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: n.id }),
        });
        fetchNotifications();
      } catch {
        // Best-effort — navigate anyway.
      }
    }
    if (n.url) router.push(n.url);
  }

  return (
    <div ref={containerRef} className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative bg-white border border-themeBorder rounded-full w-11 h-11 flex items-center justify-center shadow-lg hover:bg-gray-50 transition"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5 text-themeMuted"
        >
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5S10.5 3.17 10.5 4v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto bg-white border border-themeBorder rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-themeBorder">
            <span className="font-semibold text-sm text-themeMuted">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={loading}
                className="text-xs text-brand hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-sm text-themeMuted text-center">
              No notifications yet
            </div>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClickNotification(n)}
                    className={`w-full text-left px-4 py-3 border-b border-themeBorder last:border-b-0 hover:bg-gray-50 transition ${
                      !n.viewedAt ? 'bg-amber-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.viewedAt && (
                        <span className="mt-1.5 w-2 h-2 rounded-full bg-brand flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-themeMuted truncate">
                          {n.title}
                        </div>
                        <div className="text-xs text-themeMuted opacity-80 truncate">
                          {n.message}
                        </div>
                        <div className="text-[11px] text-themeMuted opacity-60 mt-0.5">
                          {timeAgo(n.createdAt)}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
