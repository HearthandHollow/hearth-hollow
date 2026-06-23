import type { Metadata } from 'next';
import PushOptIn from './components/PushOptIn';
import NotificationBell from './components/NotificationBell';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noindex: true,
    nofollow: true,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NotificationBell />
      <PushOptIn />
      {children}
    </>
  );
}
