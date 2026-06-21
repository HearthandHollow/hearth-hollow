import OneSignalInit from './components/OneSignalInit';
import NotificationBell from './components/NotificationBell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NotificationBell />
      <OneSignalInit />
      {children}
    </>
  );
}
