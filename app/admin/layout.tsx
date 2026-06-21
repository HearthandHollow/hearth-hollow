import PushOptIn from './components/PushOptIn';
import NotificationBell from './components/NotificationBell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NotificationBell />
      <PushOptIn />
      {children}
    </>
  );
}
