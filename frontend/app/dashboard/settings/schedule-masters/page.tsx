'use client';

import { useEffect, useState } from 'react';
import AdminScheduleWorkPlansPage from '@/app/admin/schedule-work-plans/page';

const FARM_KEY = 'currentFarmId';

export default function FarmScheduleMastersPage() {
  const [farmId, setFarmId] = useState<string | null>(null);

  useEffect(() => {
    const id = typeof window !== 'undefined' ? localStorage.getItem(FARM_KEY) : null;
    setFarmId(id);
  }, []);

  if (!farmId) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>일정 마스터</div>
        <div style={{ color: '#64748b' }}>선택된 농장이 없습니다. 먼저 농장을 선택해 주세요.</div>
      </div>
    );
  }

  // Admin UI 구조 그대로 재사용 + API만 farm 스코프로 작동
  return <AdminScheduleWorkPlansPage />;
}

