'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { me, getFarms } from '@/lib/api';
import type { FarmItem } from '@/lib/api';

const FARM_KEY = 'currentFarmId';
const FARM_NAME_KEY = 'currentFarmName';

export default function SelectFarmPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ fullName: string; systemRole: string } | null>(null);
  const [farms, setFarms] = useState<FarmItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await me();
        setUser(d.user);
        const f = await getFarms();
        setFarms(Array.isArray(f?.farms) ? f.farms : []);
      } catch {
        router.push('/login');
        return;
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  function selectFarm(farmId: string, farmName: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(FARM_KEY, farmId);
      localStorage.setItem(FARM_NAME_KEY, farmName);
    }
    router.push('/farm/dashboard');
    router.refresh();
  }

  if (loading) return <div style={{ padding: 24 }}>로딩 중...</div>;
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        <h1 style={{ marginBottom: 8 }}>농장 선택</h1>
        <p style={{ color: '#64748b', marginBottom: 24 }}>{user.fullName}님, 농장을 선택해 주세요.</p>
        {error && <p style={{ color: '#ef4444', marginBottom: 16 }}>{error}</p>}
        {(!farms || farms.length === 0) ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', color: '#64748b' }}>
            접근 가능한 농장이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {farms.map((f) => (
              <div
                key={f.id}
                style={{
                  position: 'relative',
                  width: '100%',
                  padding: 20,
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                }}
                onClick={() => selectFarm(f.id, f.farmName)}
                onMouseOver={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                  e.currentTarget.style.borderColor = '#0f172a';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                {((user.systemRole === 'system_admin' || user.systemRole === 'super_admin') || f.role === 'farm_admin') && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (typeof window !== 'undefined') {
                        localStorage.setItem(FARM_KEY, f.id);
                        localStorage.setItem(FARM_NAME_KEY, f.farmName);
                      }
                      router.push('/farm/admin');
                    }}
                    title="환경 설정"
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#64748b',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#f1f5f9';
                      e.currentTarget.style.color = '#0f172a';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#64748b';
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </button>
                )}
                <div style={{ fontSize: 17, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>{f.farmName}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>농장코드: {f.farmCode}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>상태: {f.status ?? '-'}</div>
                {f.createdAt && (
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    등록일: {new Date(f.createdAt).toLocaleDateString('ko-KR')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

