'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminFarms } from '@/lib/api';

type FarmRow = { id: string; farmName: string; farmCode: string; status: string; createdAt: string };

export default function AdminFarmsPage() {
  const router = useRouter();
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminFarms()
      .then((d) => setFarms(d.farms))
      .catch((e) => setError(e instanceof Error ? e.message : '목록 조회 실패'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>로딩 중...</div>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;

  return (
    <>
      <h2 style={{ marginBottom: 16 }}>농장 목록</h2>
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>농장 코드</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>농장명</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>상태</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>등록일</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}></th>
            </tr>
          </thead>
          <tbody>
            {farms.map((f) => (
              <tr key={f.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: 12 }}>{f.farmCode}</td>
                <td style={{ padding: 12 }}>{f.farmName}</td>
                <td style={{ padding: 12 }}>{f.status}</td>
                <td style={{ padding: 12 }}>{new Date(f.createdAt).toLocaleDateString('ko-KR')}</td>
                <td style={{ padding: 12 }}>
                  <button
                    type="button"
                    onClick={() => router.push(`/admin/farms/${f.id}`)}
                    style={{ color: '#2563eb', fontSize: 14, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    농장 관리
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {farms.length === 0 && <p style={{ padding: 24, color: '#64748b' }}>등록된 농장이 없습니다.</p>}
      </div>
    </>
  );
}


