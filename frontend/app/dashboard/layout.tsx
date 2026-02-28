'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { me } from '@/lib/api';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ fullName: string } | null>(null);
  const [ready, setReady] = useState(false);
  const isSettings = pathname != null && pathname.startsWith('/dashboard/settings');

  useEffect(() => {
    me()
      .then((d) => setUser(d.user))
      .catch(() => router.push('/login'))
      .finally(() => setReady(true));
  }, [router]);

  if (!ready) return <div style={{ padding: 24 }}>로딩 중...</div>;
  if (!user) return null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', minHeight: 0, overflow: 'hidden' }}>
      <main style={{ flex: 1, padding: isSettings ? 0 : 24, minHeight: 0, overflow: isSettings ? 'hidden' : 'auto', display: isSettings ? 'flex' : 'block', flexDirection: 'column' }}>{children}</main>
    </div>
  );
}
