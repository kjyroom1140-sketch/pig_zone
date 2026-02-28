'use client';

import { usePathname } from 'next/navigation';
import TopHeader from './TopHeader';

export default function NonAdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname != null && pathname.startsWith('/admin');
  const isLogin = pathname === '/login' || pathname === '/login/';

  if (isAdmin || isLogin) {
    return <>{children}</>;
  }

  return (
    <div style={{ minHeight: '100vh', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopHeader />
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}
