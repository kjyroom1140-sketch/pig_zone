'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { me } from '@/lib/api';

export default function FarmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ fullName: string } | null>(null);
  const [ready, setReady] = useState(false);
  const isAdminArea = pathname != null && pathname.startsWith('/farm/admin');

  useEffect(() => {
    me()
      .then((d) => setUser(d.user))
      .catch(() => router.push('/login'))
      .finally(() => setReady(true));
  }, [router]);

  if (!ready) return <div style={{ padding: 24 }}>로딩 중...</div>;
  if (!user) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
        로그인 페이지로 이동 중...
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', minHeight: 0, overflow: 'hidden' }}>
      <main
        style={{
          flex: 1,
          padding: isAdminArea ? 0 : 24,
          minHeight: 0,
          overflow: isAdminArea ? 'hidden' : 'auto',
          display: isAdminArea ? 'flex' : 'block',
          flexDirection: 'column',
        }}
      >
        {children}
      </main>
    </div>
  );
}
