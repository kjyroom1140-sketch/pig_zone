'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  getFarm,
  getFarmScheduleItems,
  getFarmScheduleTaskTypes,
  getFarmScheduleBasisTypes,
  getFarmStructureProduction,
  type FarmScheduleItem,
} from '@/lib/api';

const TARGET_LABELS: Record<string, string> = {
  pig: '개체',
  facility: '시설',
  sow: '모돈',
  boar: '웅돈',
  non_breeding: '비번식돈',
};

export default function FarmSchedulePage() {
  const params = useParams();
  const farmId = params?.id as string;
  const router = useRouter();
  const [farmName, setFarmName] = useState('');
  const [items, setItems] = useState<FarmScheduleItem[]>([]);
  const [taskTypes, setTaskTypes] = useState<{ id: number; name: string }[]>([]);
  const [basisTypes, setBasisTypes] = useState<{ id: number; name: string }[]>([]);
  const [structures, setStructures] = useState<{ templateId: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTarget, setFilterTarget] = useState('');
  const [filterStructure, setFilterStructure] = useState('');
  const [filterTask, setFilterTask] = useState('');
  const [filterBasis, setFilterBasis] = useState('');

  function load() {
    if (!farmId) return;
    setLoading(true);
    getFarm(farmId)
      .then((f) => setFarmName(f.farmName))
      .catch(() => {});
    Promise.all([
      getFarmStructureProduction(farmId).then(setStructures),
      getFarmScheduleTaskTypes(farmId).then(setTaskTypes),
      getFarmScheduleBasisTypes(farmId).then(setBasisTypes),
    ]).then(() => {
      const q: { targetType?: string; structureTemplateId?: string; taskTypeId?: string; basisTypeId?: string } = {};
      if (filterTarget) q.targetType = filterTarget;
      if (filterStructure) q.structureTemplateId = filterStructure;
      if (filterTask) q.taskTypeId = filterTask;
      if (filterBasis) q.basisTypeId = filterBasis;
      return getFarmScheduleItems(farmId, q).then(setItems);
    }).catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [farmId, filterTarget, filterStructure, filterTask, filterBasis]);

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => router.push(`/admin/farms/${farmId}`)}
          style={{ color: '#64748b', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
        >
          농장 관리
        </button>
        <h1 style={{ fontSize: 22, marginTop: 8 }}>농장 일정: {farmName}</h1>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <select
          value={filterTarget}
          onChange={(e) => setFilterTarget(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}
        >
          <option value="">구분 전체</option>
          <option value="pig">개체</option>
          <option value="facility">시설</option>
        </select>
        <select
          value={filterStructure}
          onChange={(e) => setFilterStructure(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}
        >
          <option value="">장소 전체</option>
          {structures.map((s) => (
            <option key={s.templateId} value={String(s.templateId)}>{s.name}</option>
          ))}
        </select>
        <select
          value={filterTask}
          onChange={(e) => setFilterTask(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}
        >
          <option value="">작업 전체</option>
          {taskTypes.map((t) => (
            <option key={t.id} value={String(t.id)}>{t.name}</option>
          ))}
        </select>
        <select
          value={filterBasis}
          onChange={(e) => setFilterBasis(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}
        >
          <option value="">기준 전체</option>
          {basisTypes.map((b) => (
            <option key={b.id} value={String(b.id)}>{b.name}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <p>로딩 중...</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#64748b' }}>
          조건에 맞는 일정이 없습니다. 농장 구조에서 대상 장소를 선택해 저장하면 전역 일정이 농장 일정으로 복사됩니다.
        </p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: 10, textAlign: 'left' }}>순서</th>
                <th style={{ padding: 10, textAlign: 'left' }}>구분</th>
                <th style={{ padding: 10, textAlign: 'left' }}>장소</th>
                <th style={{ padding: 10, textAlign: 'left' }}>기준</th>
                <th style={{ padding: 10, textAlign: 'left' }}>월령</th>
                <th style={{ padding: 10, textAlign: 'left' }}>일수(최소~최대)</th>
                <th style={{ padding: 10, textAlign: 'left' }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 10 }}>{s.sortOrder}</td>
                  <td style={{ padding: 10 }}>{TARGET_LABELS[s.targetType] ?? s.targetType}</td>
                  <td style={{ padding: 10 }}>{s.structureTemplate?.name ?? '-'}</td>
                  <td style={{ padding: 10 }}>{s.basisTypeRef?.name ?? '-'}</td>
                  <td style={{ padding: 10 }}>{s.ageLabel ?? '-'}</td>
                  <td style={{ padding: 10 }}>{s.dayMin != null || s.dayMax != null ? `${s.dayMin ?? '-'} ~ ${s.dayMax ?? '-'}` : '-'}</td>
                  <td style={{ padding: 10 }}>{s.taskType?.name ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ marginTop: 16, fontSize: 13, color: '#64748b' }}>
        일정 항목 추가/수정/삭제는 Go API POST/PUT/DELETE /api/farms/:farmId/schedule-items 연동 후 추가됩니다.
      </p>
    </div>
  );
}


