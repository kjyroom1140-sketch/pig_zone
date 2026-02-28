'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getFarmScheduleWorkPlans,
  getFarmFacilitiesTree,
  getFarmStructureProduction,
  type FarmScheduleWorkPlan,
} from '@/lib/api';

const FARM_KEY = 'currentFarmId';

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

function getWeekStart(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

type TreeBuilding = {
  id: string;
  name: string;
  barns: { id: string; name?: string; rooms?: { id: string; sections?: { id: string }[] }[] }[];
};

export default function DashboardSchedulePage() {
  const router = useRouter();
  const [farmId, setFarmId] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeBuilding[]>([]);
  const [workPlans, setWorkPlans] = useState<FarmScheduleWorkPlan[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = typeof window !== 'undefined' ? localStorage.getItem(FARM_KEY) : null;
    setFarmId(id);
  }, []);

  useEffect(() => {
    if (!farmId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const start = weekStart;
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const from = toDateStr(start);
    const to = toDateStr(end);
    Promise.all([
      getFarmFacilitiesTree(farmId).then(setTree).catch(() => []),
      getFarmStructureProduction(farmId).catch(() => []),
      getFarmScheduleWorkPlans(farmId, from, to).then(setWorkPlans).catch(() => []),
    ])
      .then(() => setError(null))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [farmId, weekStart]);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return { date: d, str: toDateStr(d), label: ['일', '월', '화', '수', '목', '금', '토'][d.getDay()] };
  });

  const sectionToBarnId = new Map<string, string>();
  const roomToBarnId = new Map<string, string>();
  tree.forEach((b) => {
    b.barns?.forEach((barn) => {
      barn.rooms?.forEach((room) => {
        roomToBarnId.set(room.id, barn.id);
        room.sections?.forEach((sec) => sectionToBarnId.set(sec.id, barn.id));
      });
    });
  });

  const plansByBarnAndDay = new Map<string, FarmScheduleWorkPlan[]>();
  workPlans.forEach((p) => {
    const barnId =
      (p.sectionId && sectionToBarnId.get(p.sectionId)) ||
      (p.roomId && roomToBarnId.get(p.roomId)) ||
      '__no_barn__';
    const key = barnId;
    if (!plansByBarnAndDay.has(key)) plansByBarnAndDay.set(key, []);
    plansByBarnAndDay.get(key)!.push(p);
  });

  const rows: { buildingName: string; barnId: string; barnName: string }[] = [];
  tree.forEach((b) => {
    b.barns?.forEach((barn) => {
      rows.push({
        buildingName: b.name,
        barnId: barn.id,
        barnName: (barn as { name?: string }).name ?? barn.id.slice(0, 8),
      });
    });
  });
  const hasNoBarnPlans = workPlans.some(
    (p) => !(p.sectionId && sectionToBarnId.has(p.sectionId)) && !(p.roomId && roomToBarnId.has(p.roomId))
  );
  if (hasNoBarnPlans) {
    rows.push({ buildingName: '미분류', barnId: '__no_barn__', barnName: '미지정 그룹' });
  }

  function plansForBarnOnDay(barnId: string, dayStr: string): FarmScheduleWorkPlan[] {
    const plans = plansByBarnAndDay.get(barnId) ?? [];
    return plans.filter(
      (p) => dayStr >= p.plannedStartDate && dayStr <= p.plannedEndDate
    );
  }

  if (!farmId) {
    return (
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>일정</h2>
        <p style={{ color: '#64748b' }}>농장을 선택한 후 이용해 주세요.</p>
        <button
          type="button"
          onClick={() => router.push('/select-farm')}
          style={{ color: '#2563eb', marginTop: 8, display: 'inline-block', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
        >
          농장 선택
        </button>
      </div>
    );
  }

  if (loading) return <div>로딩 중...</div>;
  if (error) return <div><p style={{ color: '#dc2626' }}>{error}</p></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 20, margin: 0 }}>일정 (7일)</h2>
        <button
          type="button"
          onClick={() => setWeekStart((s) => { const d = new Date(s); d.setDate(d.getDate() - 7); return d; })}
          style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
        >
          이전 주
        </button>
        <button
          type="button"
          onClick={() => setWeekStart((s) => { const d = new Date(s); d.setDate(d.getDate() + 7); return d; })}
          style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
        >
          다음 주
        </button>
        <button
          type="button"
          onClick={() => setWeekStart(getWeekStart(new Date()))}
          style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#f1f5f9', cursor: 'pointer' }}
        >
          오늘
        </button>
        <span style={{ fontSize: 14, color: '#64748b' }}>
          {weekDays[0].str} ~ {weekDays[6].str}
        </span>
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: 10, textAlign: 'left', minWidth: 140 }}>농장 구조</th>
              {weekDays.map((d) => (
                <th key={d.str} style={{ padding: 10, textAlign: 'center', minWidth: 80 }}>
                  {d.label}<br /><span style={{ fontSize: 11, color: '#64748b' }}>{d.str.slice(5)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 24, color: '#64748b', textAlign: 'center' }}>
                  시설(건물/돈사) 데이터가 없습니다. 농장 관리에서 시설 구조를 설정해 주세요.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.barnId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 10 }}>
                    <strong>{r.buildingName}</strong> / {r.barnName}
                  </td>
                  {weekDays.map((d) => {
                    const plans = plansForBarnOnDay(r.barnId, d.str);
                    return (
                      <td key={d.str} style={{ padding: 8, verticalAlign: 'top', minWidth: 80 }}>
                        {plans.length === 0 ? (
                          <span style={{ color: '#cbd5e1' }}>-</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {plans.slice(0, 3).map((p) => (
                              <span key={p.id} style={{ fontSize: 12, background: '#eff6ff', padding: '2px 6px', borderRadius: 4 }}>
                                {p.scheduleItem?.taskType?.name ?? p.farmScheduleItemId}
                              </span>
                            ))}
                            {plans.length > 3 && <span style={{ fontSize: 11, color: '#64748b' }}>+{plans.length - 3}</span>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 16, fontSize: 13, color: '#64748b' }}>
        셀 클릭으로 작업 추가는 Go API POST /api/farms/:farmId/schedule-work-plans 연동 후 모달로 추가됩니다.
      </p>
    </div>
  );
}

