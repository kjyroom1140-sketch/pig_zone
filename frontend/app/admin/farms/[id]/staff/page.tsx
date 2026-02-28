'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getFarm, getFarmStaff } from '@/lib/api';

export default function FarmStaffPage() {
  const params = useParams();
  const farmId = params?.id as string;
  const router = useRouter();
  const [farmName, setFarmName] = useState<string>('');
  const [staff, setStaff] = useState<{ userFarmId: string; fullName?: string; username?: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!farmId) return;
    getFarm(farmId).then((f) => setFarmName(f.farmName));
    getFarmStaff(farmId).then(setStaff).catch(() => []).finally(() => setLoading(false));
  }, [farmId]);

  if (loading) return <div style={{ padding: 24 }}>로딩 중...</div>;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <button type="button" onClick={() => router.push(`/admin/farms/${farmId}`)} style={{ color: '#64748b', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>농장 관리</button>
        <h1 style={{ fontSize: 22, marginTop: 8 }}>직원 관리: {farmName}</h1>
      </div>
      {staff.length === 0 ? (
        <p style={{ color: '#64748b' }}>등록된 직원이 없습니다.</p>
      ) : (
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>이름</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>아이디</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>역할</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.userFarmId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 12 }}>{s.fullName ?? '-'}</td>
                  <td style={{ padding: 12 }}>{s.username ?? '-'}</td>
                  <td style={{ padding: 12 }}>{s.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ marginTop: 16, fontSize: 14, color: '#64748b' }}>직원 추가/수정/권한은 Go API /api/farms/:farmId/staff 연동 후 상세 UI가 추가됩니다.</p>
    </div>
  );
}



