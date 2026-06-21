import OneSignalInit from './components/OneSignalInit';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OneSignalInit />
      {children}
    </>
  );
}
