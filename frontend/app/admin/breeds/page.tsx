'use client';

import { useEffect, useState } from 'react';
import { getBreeds, type BreedItem } from '@/lib/api';

export default function AdminBreedsPage() {
  const [breeds, setBreeds] = useState<BreedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getBreeds()
      .then(setBreeds)
      .catch((e) => setError(e instanceof Error ? e.message : '목록 조회 실패'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>로딩 중...</div>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;

  return (
    <>
      <h2 style={{ marginBottom: 16 }}>품종 관리</h2>
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>코드</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>품종명(한글)</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>품종명(영문)</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>용도</th>
            </tr>
          </thead>
          <tbody>
            {breeds.map((b) => (
              <tr key={b.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: 12 }}>{b.code}</td>
                <td style={{ padding: 12 }}>{b.nameKo}</td>
                <td style={{ padding: 12 }}>{b.nameEn ?? '-'}</td>
                <td style={{ padding: 12 }}>{b.usage ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {breeds.length === 0 && <p style={{ padding: 24, color: '#64748b' }}>등록된 품종이 없습니다.</p>}
      </div>
    </>
  );
}
