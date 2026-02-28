'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getFarm, getFarmStructureProduction, getFarmFacilitiesTree } from '@/lib/api';

export default function FarmStructurePage() {
  const params = useParams();
  const farmId = params?.id as string;
  const router = useRouter();
  const [farmName, setFarmName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [structures, setStructures] = useState<{ id: string; name: string; templateId: number }[]>([]);
  const [tree, setTree] = useState<unknown[]>([]);

  useEffect(() => {
    if (!farmId) return;
    Promise.all([
      getFarm(farmId).then((f) => { setFarmName(f.farmName); return f; }),
      getFarmStructureProduction(farmId).then(setStructures).catch(() => []),
      getFarmFacilitiesTree(farmId).then(setTree).catch(() => []),
    ]).finally(() => setLoading(false));
  }, [farmId]);

  if (loading) return <div style={{ padding: 24 }}>로딩 중...</div>;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <button type="button" onClick={() => router.push(`/admin/farms/${farmId}`)} style={{ color: '#64748b', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>농장 관리</button>
        <h1 style={{ fontSize: 22, marginTop: 8 }}>시설 구조: {farmName}</h1>
      </div>
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>사육 시설 (운영 시설)</h2>
        {structures.length === 0 ? (
          <p style={{ color: '#64748b' }}>등록된 시설이 없습니다. Go API /farm-structure/:farmId/production 연동 후 표시됩니다.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {structures.map((s) => (
              <li key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>{s.name}</li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>시설 트리 (건물 &gt; 돈사 &gt; 방 &gt; 칸)</h2>
        {tree.length === 0 ? (
          <p style={{ color: '#64748b' }}>건물/돈사 데이터가 없습니다. Go API /farm-facilities/:farmId/tree 연동 후 표시됩니다.</p>
        ) : (
          <p style={{ color: '#64748b' }}>건물 {tree.length}개 로드됨. 상세 UI는 단계적으로 추가됩니다.</p>
        )}
      </section>
    </div>
  );
}



