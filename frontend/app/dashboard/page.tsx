'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { me } from '@/lib/api';

const FARM_KEY = 'currentFarmId';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ fullName: string } | null>(null);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    me()
      .then((d) => {
        setUser(d.user);
        if (typeof window !== 'undefined') {
          setFarmId(localStorage.getItem(FARM_KEY));
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div style={{ padding: 24 }}>로딩 중...</div>;
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', padding: 24 }}>
      <h1>대시보드</h1>
      <p style={{ marginTop: 8, color: '#64748b' }}>{user.fullName}님, 환영합니다.</p>
      {farmId && <p style={{ marginTop: 8, fontSize: 14 }}>선택된 농장 ID: {farmId}</p>}
      <p style={{ marginTop: 24, color: '#64748b' }}>일정·이동·보고 등 화면은 Go API 연동 후 단계적으로 추가됩니다.</p>
    </div>
  );
}
