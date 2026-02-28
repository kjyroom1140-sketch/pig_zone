'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getFarm } from '@/lib/api';

export default function FarmAdminPage() {
  const params = useParams();
  const router = useRouter();
  const farmId = params?.id as string;
  const [farm, setFarm] = useState<{ farmName: string; farmCode: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId) return;
    getFarm(farmId)
      .then((f) => setFarm(f))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [farmId]);

  if (loading) return <div style={{ padding: 24 }}>로딩 중...</div>;
  if (error || !farm) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#dc2626' }}>{error || '농장 정보를 불러올 수 없습니다.'}</p>
        <button type="button" onClick={() => router.push('/admin/farms')} style={{ marginTop: 16, display: 'inline-block', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>농장 목록</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button type="button" onClick={() => router.push('/admin/farms')} style={{ marginTop: 16, display: 'inline-block', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>농장 목록</button>
        <h1 style={{ fontSize: 22 }}>농장 관리: {farm.farmName}</h1>
        <span style={{ fontSize: 14, color: '#64748b' }}>({farm.farmCode})</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          type="button"
          onClick={() => router.push(`/admin/farms/${farmId}/structure`)}
          style={{
            padding: 16,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            color: '#334155',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <strong>시설 구조</strong> - 사육 시설, 일반 시설 설정
        </button>
        <button
          type="button"
          onClick={() => router.push(`/admin/farms/${farmId}/schedule`)}
          style={{
            padding: 16,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            color: '#334155',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <strong>농장 일정</strong> - 기준 유형, 작업 유형, 일정 항목
        </button>
        <button
          type="button"
          onClick={() => router.push(`/admin/farms/${farmId}/staff`)}
          style={{
            padding: 16,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            color: '#334155',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <strong>직원 관리</strong> - 농장 소속 직원 목록, 등록
        </button>
      </div>
      <p style={{ marginTop: 24, fontSize: 14, color: '#64748b' }}>
        각 메뉴의 상세 기능은 단계적으로 추가됩니다. 기존 farm_admin.html과 동일한 API(Go)를 사용합니다.
      </p>
    </div>
  );
}

