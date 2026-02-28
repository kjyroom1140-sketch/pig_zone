'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { me, getAdminStats } from '@/lib/api';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<{ users: number; farms: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await me();
        const data = await getAdminStats();
        setStats(data);
      } catch {
        router.push('/login');
        return;
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) return <div>로딩 중...</div>;

  return (
    <>
      <h2 style={{ marginBottom: 16 }}>대시보드</h2>
      {stats && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ padding: 20, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', minWidth: 160 }}>
            <div style={{ color: '#64748b', fontSize: 14 }}>전체 회원 수</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.users}</div>
          </div>
          <div style={{ padding: 20, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', minWidth: 160 }}>
            <div style={{ color: '#64748b', fontSize: 14 }}>등록 농장</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.farms}</div>
          </div>
        </div>
      )}
    </>
  );
}
