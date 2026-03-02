'use client';

import { type CSSProperties, type Dispatch, type SetStateAction, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  completeFarmScheduleExecutionBirth,
  completeFarmScheduleExecutionMove,
  createFarmScheduleExecution,
  directCompleteFarmScheduleExecutionBirth,
  directCompleteFarmScheduleExecutionMove,
  getFarmPigGroups,
  getFarmFacilitiesTree,
  getStructureTemplates,
  getFarmStructureProduction,
  getFarmScheduleWorkPlansMaster,
  getFarmScheduleExecutions,
  getFarmSectionInventoryBalances,
  type FarmPigGroupItem,
  type FarmScheduleExecutionItem,
  type FarmScheduleWorkPlanMasterItem,
  type FarmBarn,
  type FarmBuilding,
  type FarmSection,
  type FarmRoom,
} from '@/lib/api';

const FARM_KEY = 'currentFarmId';
const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

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

function buildIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type CalendarCell = {
  date: Date;
  inCurrentMonth: boolean;
};

function buildCalendarCells(month: Date): CalendarCell[] {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = getWeekStart(firstDay);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ date: d, inCurrentMonth: d.getMonth() === month.getMonth() });
  }
  return cells;
}

export default function DashboardSchedulePage() {
  const router = useRouter();
  const [farmId, setFarmId] = useState<string | null>(null);
  const [tree, setTree] = useState<FarmBuilding[]>([]);
  const [templateNameById, setTemplateNameById] = useState<Map<number, string>>(new Map());
  const [templateColorById, setTemplateColorById] = useState<Map<number, string>>(new Map());
  const [sectionHeadCountById, setSectionHeadCountById] = useState<Map<string, number>>(new Map());
  const [masterPlans, setMasterPlans] = useState<FarmScheduleWorkPlanMasterItem[]>([]);
  const [pendingExecutions, setPendingExecutions] = useState<FarmScheduleExecutionItem[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => toDateStr(new Date()));
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [isCreateExecutionModalOpen, setIsCreateExecutionModalOpen] = useState(false);
  const [createExecutionSectionId, setCreateExecutionSectionId] = useState('');
  const [createExecutionSectionLabel, setCreateExecutionSectionLabel] = useState('');
  const [createExecutionDate, setCreateExecutionDate] = useState('');
  const [createExecutionPlanIds, setCreateExecutionPlanIds] = useState<number[]>([]);
  const [createExecutionWorkPlanId, setCreateExecutionWorkPlanId] = useState<number | ''>('');
  const [createExecutionType, setCreateExecutionType] = useState<'birth' | 'move' | 'inspection'>('inspection');
  const [createExecutionMemo, setCreateExecutionMemo] = useState('');
  const [createExecutionSubmitting, setCreateExecutionSubmitting] = useState(false);
  const [createExecutionError, setCreateExecutionError] = useState<string | null>(null);
  const [pigGroups, setPigGroups] = useState<FarmPigGroupItem[]>([]);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completeMode, setCompleteMode] = useState<'existing' | 'direct'>('existing');
  const [completeExecutionTarget, setCompleteExecutionTarget] = useState<FarmScheduleExecutionItem | null>(null);
  const [completeExecutionSectionLabel, setCompleteExecutionSectionLabel] = useState('');
  const [completeDirectPlanIds, setCompleteDirectPlanIds] = useState<number[]>([]);
  const [completeDirectWorkPlanId, setCompleteDirectWorkPlanId] = useState<number | ''>('');
  const [completeDirectExecutionType, setCompleteDirectExecutionType] = useState<'birth' | 'move' | 'inspection'>('inspection');
  const [completeDirectSectionId, setCompleteDirectSectionId] = useState('');
  const [completeDirectDate, setCompleteDirectDate] = useState('');
  const [completeSubmitting, setCompleteSubmitting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completeBirthCount, setCompleteBirthCount] = useState<number>(1);
  const [completeBirthSectionId, setCompleteBirthSectionId] = useState('');
  const [completeBirthGroupNo, setCompleteBirthGroupNo] = useState('');
  const [completeBirthOriginSowId, setCompleteBirthOriginSowId] = useState('');
  const [completeBirthMemo, setCompleteBirthMemo] = useState('');
  const [completeMoveEventType, setCompleteMoveEventType] = useState<'full' | 'partial' | 'split' | 'merge' | 'entry' | 'shipment'>('full');
  const [completeMoveSourceGroupId, setCompleteMoveSourceGroupId] = useState('');
  const [completeMoveTargetGroupId, setCompleteMoveTargetGroupId] = useState('');
  const [completeMoveFromSectionId, setCompleteMoveFromSectionId] = useState('');
  const [completeMoveToSectionId, setCompleteMoveToSectionId] = useState('');
  const [completeMoveHeadCount, setCompleteMoveHeadCount] = useState<number>(1);
  const [completeMoveLineType, setCompleteMoveLineType] = useState<'move' | 'split_out' | 'split_in' | 'merge_in' | 'merge_out' | 'entry' | 'shipment'>('move');
  const [completeMoveMemo, setCompleteMoveMemo] = useState('');
  const [collapsedBuildings, setCollapsedBuildings] = useState<Set<string>>(new Set());
  const [collapsedBarns, setCollapsedBarns] = useState<Set<string>>(new Set());
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set());
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
    Promise.all([
      getFarmFacilitiesTree(farmId),
      getFarmStructureProduction(farmId).catch(() => []),
      getFarmScheduleWorkPlansMaster(farmId).catch(() => []),
      getStructureTemplates().catch(() => []),
      getFarmSectionInventoryBalances(farmId).catch(() => []),
    ])
      .then(([treeList, templateList, planList, structureTemplates, balances]) => {
        setTree(Array.isArray(treeList) ? treeList : []);
        const next = new Map<number, string>();
        (Array.isArray(templateList) ? templateList : []).forEach((item) => {
          const id = Number((item as { templateId?: unknown }).templateId);
          const name = String((item as { name?: unknown }).name ?? '').trim();
          if (Number.isFinite(id) && name) next.set(id, name);
        });
        setTemplateNameById(next);
        const colorMap = new Map<number, string>();
        (Array.isArray(structureTemplates) ? structureTemplates : []).forEach((t) => {
          const id = Number((t as { id?: unknown }).id);
          const c = normalizeHexColor((t as { themeColor?: unknown }).themeColor as string | undefined | null);
          if (Number.isFinite(id) && c) colorMap.set(id, c);
        });
        setTemplateColorById(colorMap);
        const balanceMap = new Map<string, number>();
        (Array.isArray(balances) ? balances : []).forEach((b) => {
          const sectionId = String((b as { sectionId?: unknown }).sectionId ?? '').trim();
          const headCount = Number((b as { headCount?: unknown }).headCount ?? 0);
          if (sectionId && Number.isFinite(headCount)) balanceMap.set(sectionId, headCount);
        });
        setSectionHeadCountById(balanceMap);
        setMasterPlans(Array.isArray(planList) ? planList : []);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '농장 구조를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [farmId]);

  useEffect(() => {
    if (!isCalendarModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsCalendarModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCalendarModalOpen]);

  const reloadPendingExecutions = useCallback(async () => {
    if (!farmId) {
      setPendingExecutions([]);
      return;
    }
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    try {
      const list = await getFarmScheduleExecutions(farmId, {
        startDate: toDateStr(weekStart),
        endDate: toDateStr(end),
        status: 'pending',
        limit: 2000,
      });
      setPendingExecutions(Array.isArray(list) ? list : []);
    } catch {
      setPendingExecutions([]);
    }
  }, [farmId, weekStart]);

  useEffect(() => {
    reloadPendingExecutions();
  }, [reloadPendingExecutions]);

  useEffect(() => {
    if (!farmId) {
      setPigGroups([]);
      return;
    }
    getFarmPigGroups(farmId)
      .then((list) => setPigGroups(Array.isArray(list) ? list : []))
      .catch(() => setPigGroups([]));
  }, [farmId]);

  useEffect(() => {
    if (!isCreateExecutionModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !createExecutionSubmitting) setIsCreateExecutionModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCreateExecutionModalOpen, createExecutionSubmitting]);

  useEffect(() => {
    if (!isCompleteModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !completeSubmitting) setIsCompleteModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCompleteModalOpen, completeSubmitting]);

  if (!farmId) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 6 }}>일정 관리</h2>
          <p style={{ color: '#64748b', margin: 0 }}>농장을 선택한 후 이용해 주세요.</p>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', padding: 16 }}>
          <button
            type="button"
            onClick={() => router.push('/select-farm')}
            style={{ color: '#2563eb', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
          >
            농장 선택
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div style={{ padding: 8, color: '#64748b' }}>로딩 중...</div>;
  if (error) return <div><p style={{ color: '#dc2626' }}>{error}</p></div>;

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return { label: WEEK_LABELS[d.getDay()], date: toDateStr(d) };
  });
  const monthLabel = `${weekStart.getMonth() + 1} 월`;

  const planByTemplate = new Map<number, FarmScheduleWorkPlanMasterItem[]>();
  masterPlans.forEach((p) => {
    const tid = Number(p.structureTemplateId);
    if (!Number.isFinite(tid)) return;
    if (!planByTemplate.has(tid)) planByTemplate.set(tid, []);
    planByTemplate.get(tid)!.push(p);
  });
  const rows = flattenStructureRows(
    tree,
    templateNameById,
    templateColorById,
    sectionHeadCountById,
    planByTemplate,
    collapsedBuildings,
    collapsedBarns,
    collapsedRooms
  );
  const pendingBySectionDate = buildPendingExecutionMap(pendingExecutions);
  const collapseTargets = collectCollapseTargets(tree);
  const structureExpandStage = resolveStructureExpandStage(collapseTargets, collapsedBuildings, collapsedBarns, collapsedRooms);
  const calendarMonthLabel = `${calendarMonth.getFullYear()}년 ${calendarMonth.getMonth() + 1}월`;
  const calendarCells = buildCalendarCells(calendarMonth);
  const currentWeekEnd = new Date(weekStart);
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
  const activePigGroups = pigGroups.filter((g) => g.status === 'active' && Number(g.headCount) > 0);
  const sectionOptions = collectSectionOptions(tree, templateNameById);
  const createExecutionCandidatePlans = (createExecutionPlanIds.length > 0
    ? masterPlans.filter((p) => createExecutionPlanIds.includes(p.id))
    : masterPlans);
  const completeDirectCandidatePlans = (completeDirectPlanIds.length > 0
    ? masterPlans.filter((p) => completeDirectPlanIds.includes(p.id))
    : masterPlans);
  const activeCompleteExecutionType =
    completeMode === 'existing'
      ? (completeExecutionTarget?.executionType ?? 'inspection')
      : completeDirectExecutionType;

  const applyPendingExecutionOptimistic = (item: FarmScheduleExecutionItem) => {
    setPendingExecutions((prev) => [item, ...prev]);
  };

  const removePendingExecutionOptimistic = (executionId: string) => {
    setPendingExecutions((prev) => prev.filter((it) => it.id !== executionId));
  };

  const openCreateExecutionModal = (
    sectionId: string,
    sectionLabel: string,
    date: string,
    candidatePlanIds?: number[]
  ) => {
    const filteredCandidates = (candidatePlanIds ?? []).filter((id) => Number.isFinite(id));
    const availablePlans = filteredCandidates.length > 0
      ? masterPlans.filter((p) => filteredCandidates.includes(p.id))
      : masterPlans;
    const firstPlan = availablePlans.length > 0 ? availablePlans[0] : undefined;
    const guessedType = inferExecutionTypeFromPlan(firstPlan);
    setCreateExecutionSectionId(sectionId);
    setCreateExecutionSectionLabel(sectionLabel);
    setCreateExecutionDate(date);
    setCreateExecutionPlanIds(filteredCandidates);
    setCreateExecutionWorkPlanId(firstPlan?.id ?? '');
    setCreateExecutionType(guessedType);
    setCreateExecutionMemo('');
    setCreateExecutionError(null);
    setIsCreateExecutionModalOpen(true);
  };

  const closeCreateExecutionModal = () => {
    if (createExecutionSubmitting) return;
    setIsCreateExecutionModalOpen(false);
  };

  const submitCreateExecution = async () => {
    if (!farmId) return;
    if (!createExecutionSectionId || !createExecutionDate) return;
    if (createExecutionWorkPlanId === '' || !Number.isFinite(createExecutionWorkPlanId)) {
      setCreateExecutionError('작업 계획을 선택해 주세요.');
      return;
    }
    setCreateExecutionSubmitting(true);
    setCreateExecutionError(null);
    try {
      const generatedKey = buildIdempotencyKey();
      const created = await createFarmScheduleExecution(farmId, {
        workPlanId: createExecutionWorkPlanId,
        sectionId: createExecutionSectionId,
        executionType: createExecutionType,
        scheduledDate: createExecutionDate,
        idempotencyKey: generatedKey,
        memo: createExecutionMemo.trim() || undefined,
      });
      applyPendingExecutionOptimistic(created);
      setIsCreateExecutionModalOpen(false);
      await reloadPendingExecutions();
    } catch (e) {
      setCreateExecutionError(e instanceof Error ? e.message : '예정 등록 중 오류가 발생했습니다.');
    } finally {
      setCreateExecutionSubmitting(false);
    }
  };

  const openCompleteExecutionModal = (execution: FarmScheduleExecutionItem, sectionId: string, sectionLabel: string) => {
    const sectionForExecution = execution.sectionId ?? sectionId;
    const sourceCandidate = activePigGroups.find((g) => g.currentSectionId === sectionForExecution);
    setCompleteMode('existing');
    setCompleteExecutionTarget(execution);
    setCompleteExecutionSectionLabel(sectionLabel);
    setCompleteDirectPlanIds([]);
    setCompleteDirectWorkPlanId('');
    setCompleteDirectExecutionType('inspection');
    setCompleteDirectSectionId(sectionForExecution);
    setCompleteDirectDate(execution.scheduledDate);
    setCompleteError(null);
    setCompleteBirthCount(1);
    setCompleteBirthSectionId(sectionForExecution);
    setCompleteBirthGroupNo('');
    setCompleteBirthOriginSowId('');
    setCompleteBirthMemo(execution.memo ?? '');
    setCompleteMoveEventType('full');
    setCompleteMoveSourceGroupId(sourceCandidate?.id ?? '');
    setCompleteMoveTargetGroupId('');
    setCompleteMoveFromSectionId(sourceCandidate?.currentSectionId ?? sectionForExecution);
    setCompleteMoveToSectionId(sectionId);
    setCompleteMoveHeadCount(1);
    setCompleteMoveLineType('move');
    setCompleteMoveMemo(execution.memo ?? '');
    setIsCompleteModalOpen(true);
  };

  const openDirectCompleteModal = (
    sectionId: string,
    sectionLabel: string,
    date: string,
    candidatePlanIds?: number[]
  ) => {
    const filteredCandidates = (candidatePlanIds ?? []).filter((id) => Number.isFinite(id));
    const availablePlans = filteredCandidates.length > 0
      ? masterPlans.filter((p) => filteredCandidates.includes(p.id))
      : masterPlans;
    const firstPlan = availablePlans.length > 0 ? availablePlans[0] : undefined;
    const guessedType = inferExecutionTypeFromPlan(firstPlan);
    const sourceCandidate = activePigGroups.find((g) => g.currentSectionId === sectionId);
    setCompleteMode('direct');
    setCompleteExecutionTarget(null);
    setCompleteExecutionSectionLabel(sectionLabel);
    setCompleteDirectPlanIds(filteredCandidates);
    setCompleteDirectWorkPlanId(firstPlan?.id ?? '');
    setCompleteDirectExecutionType(guessedType);
    setCompleteDirectSectionId(sectionId);
    setCompleteDirectDate(date);
    setCompleteError(null);
    setCompleteBirthCount(1);
    setCompleteBirthSectionId(sectionId);
    setCompleteBirthGroupNo('');
    setCompleteBirthOriginSowId('');
    setCompleteBirthMemo('');
    setCompleteMoveEventType('full');
    setCompleteMoveSourceGroupId(sourceCandidate?.id ?? '');
    setCompleteMoveTargetGroupId('');
    setCompleteMoveFromSectionId(sourceCandidate?.currentSectionId ?? sectionId);
    setCompleteMoveToSectionId(sectionId);
    setCompleteMoveHeadCount(1);
    setCompleteMoveLineType('move');
    setCompleteMoveMemo('');
    setIsCompleteModalOpen(true);
  };

  const closeCompleteModal = () => {
    if (completeSubmitting) return;
    setIsCompleteModalOpen(false);
  };

  const submitCompleteExecution = async () => {
    if (!farmId) return;
    setCompleteSubmitting(true);
    setCompleteError(null);
    try {
      const idempotencyKey = buildIdempotencyKey();
      if (activeCompleteExecutionType === 'inspection') {
        setCompleteError('inspection 완료 API는 아직 연결되지 않았습니다.');
        return;
      }

      if (activeCompleteExecutionType === 'birth') {
        if (!completeBirthSectionId) {
          setCompleteError('분만 완료에는 sectionId가 필요합니다.');
          return;
        }
        if (!Number.isFinite(completeBirthCount) || completeBirthCount <= 0) {
          setCompleteError('분만 마리수는 1 이상이어야 합니다.');
          return;
        }
        if (completeMode === 'direct') {
          if (completeDirectWorkPlanId === '' || !Number.isFinite(completeDirectWorkPlanId)) {
            setCompleteError('바로 완료에는 작업 계획 선택이 필요합니다.');
            return;
          }
          if (!completeDirectDate) {
            setCompleteError('바로 완료에는 작업일이 필요합니다.');
            return;
          }
          await directCompleteFarmScheduleExecutionBirth(farmId, {
            workPlanId: completeDirectWorkPlanId,
            scheduledDate: completeDirectDate,
            bornCount: completeBirthCount,
            sectionId: completeBirthSectionId,
            groupNo: completeBirthGroupNo.trim() || undefined,
            originSowId: completeBirthOriginSowId.trim() || undefined,
            memo: completeBirthMemo.trim() || undefined,
            idempotencyKey,
          });
        } else {
          const executionIdForComplete = completeExecutionTarget?.id ?? '';
          if (!executionIdForComplete) {
            setCompleteError('완료 대상 실행건을 찾을 수 없습니다.');
            return;
          }
          await completeFarmScheduleExecutionBirth(farmId, executionIdForComplete, {
            bornCount: completeBirthCount,
            sectionId: completeBirthSectionId,
            groupNo: completeBirthGroupNo.trim() || undefined,
            originSowId: completeBirthOriginSowId.trim() || undefined,
            memo: completeBirthMemo.trim() || undefined,
            idempotencyKey,
          });
        }
      } else if (activeCompleteExecutionType === 'move') {
        if (!completeMoveSourceGroupId) {
          setCompleteError('이동 완료에는 sourceGroupId가 필요합니다.');
          return;
        }
        if (!completeMoveToSectionId) {
          setCompleteError('이동 완료에는 toSectionId가 필요합니다.');
          return;
        }
        if (!Number.isFinite(completeMoveHeadCount) || completeMoveHeadCount <= 0) {
          setCompleteError('이동 마리수는 1 이상이어야 합니다.');
          return;
        }
        if (completeMode === 'direct') {
          if (completeDirectWorkPlanId === '' || !Number.isFinite(completeDirectWorkPlanId)) {
            setCompleteError('바로 완료에는 작업 계획 선택이 필요합니다.');
            return;
          }
          if (!completeDirectDate) {
            setCompleteError('바로 완료에는 작업일이 필요합니다.');
            return;
          }
          await directCompleteFarmScheduleExecutionMove(farmId, {
            workPlanId: completeDirectWorkPlanId,
            scheduledDate: completeDirectDate,
            eventType: completeMoveEventType,
            memo: completeMoveMemo.trim() || undefined,
            idempotencyKey,
            lines: [{
              sourceGroupId: completeMoveSourceGroupId,
              targetGroupId: completeMoveTargetGroupId.trim() || undefined,
              fromSectionId: completeMoveFromSectionId.trim() || undefined,
              toSectionId: completeMoveToSectionId,
              headCount: completeMoveHeadCount,
              lineType: completeMoveLineType,
            }],
          });
        } else {
          const executionIdForComplete = completeExecutionTarget?.id ?? '';
          if (!executionIdForComplete) {
            setCompleteError('완료 대상 실행건을 찾을 수 없습니다.');
            return;
          }
          await completeFarmScheduleExecutionMove(farmId, executionIdForComplete, {
            eventType: completeMoveEventType,
            memo: completeMoveMemo.trim() || undefined,
            idempotencyKey,
            lines: [{
              sourceGroupId: completeMoveSourceGroupId,
              targetGroupId: completeMoveTargetGroupId.trim() || undefined,
              fromSectionId: completeMoveFromSectionId.trim() || undefined,
              toSectionId: completeMoveToSectionId,
              headCount: completeMoveHeadCount,
              lineType: completeMoveLineType,
            }],
          });
        }
      }
      if (completeMode === 'existing' && completeExecutionTarget?.id) {
        removePendingExecutionOptimistic(completeExecutionTarget.id);
      }
      setIsCompleteModalOpen(false);
      await Promise.all([reloadPendingExecutions(), getFarmPigGroups(farmId).then((list) => setPigGroups(Array.isArray(list) ? list : [])).catch(() => undefined)]);
    } catch (e) {
      setCompleteError(e instanceof Error ? e.message : '완료 처리 중 오류가 발생했습니다.');
    } finally {
      setCompleteSubmitting(false);
    }
  };

  const openCalendarModal = () => {
    const selected = new Date(`${selectedDateStr}T00:00:00`);
    setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    setIsCalendarModalOpen(true);
  };

  const moveCalendarMonth = (offset: number) => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const moveByDays = (days: number) => {
    const base = new Date(`${selectedDateStr}T00:00:00`);
    base.setDate(base.getDate() + days);
    const next = toDateStr(base);
    setSelectedDateStr(next);
    setWeekStart(getWeekStart(base));
  };

  const moveToToday = () => {
    const today = new Date();
    setSelectedDateStr(toDateStr(today));
    setWeekStart(getWeekStart(today));
  };

  const handleCalendarDatePick = (d: Date) => {
    setSelectedDateStr(toDateStr(d));
    setWeekStart(getWeekStart(d));
    setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setIsCalendarModalOpen(false);
  };

  const applyStructureExpandStage = (stage: number) => {
    if (stage >= 3) {
      setCollapsedBuildings(new Set());
      setCollapsedBarns(new Set());
      setCollapsedRooms(new Set());
      return;
    }
    if (stage === 2) {
      setCollapsedBuildings(new Set());
      setCollapsedBarns(new Set());
      setCollapsedRooms(new Set(collapseTargets.roomIds));
      return;
    }
    if (stage === 1) {
      setCollapsedBuildings(new Set());
      setCollapsedBarns(new Set(collapseTargets.barnIds));
      setCollapsedRooms(new Set(collapseTargets.roomIds));
      return;
    }
    setCollapsedBuildings(new Set(collapseTargets.buildingIds));
    setCollapsedBarns(new Set(collapseTargets.barnIds));
    setCollapsedRooms(new Set(collapseTargets.roomIds));
  };

  const stepExpandStructure = () => {
    const nextStage = Math.min(3, structureExpandStage + 1);
    applyStructureExpandStage(nextStage);
  };

  const stepCollapseStructure = () => {
    const nextStage = Math.max(0, structureExpandStage - 1);
    applyStructureExpandStage(nextStage);
  };

  return (
    <div style={{ display: 'grid', gap: 16, height: '100%', minHeight: 0, fontFamily: '"Noto Sans KR", "Malgun Gothic", sans-serif' }}>
      <div style={{ border: '1px solid #dbe4ee', borderRadius: '12px 12px 0 0', background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={toolbarWrapStyle}>
          <div style={monthLabelStyle}>{monthLabel}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <button type="button" onClick={() => moveByDays(-7)} style={weekBtnStyle}>이전 주</button>
            <button type="button" onClick={() => moveByDays(-1)} style={dayBtnStyle}>이전 일</button>
            <button type="button" onClick={openCalendarModal} style={calendarIconBtnStyle} aria-label="날짜 선택">
              📅
            </button>
            <button type="button" onClick={() => moveByDays(1)} style={dayBtnStyle}>다음 일</button>
            <button type="button" onClick={() => moveByDays(7)} style={weekBtnStyle}>다음 주</button>
            <button type="button" onClick={moveToToday} style={{ ...weekBtnStyle, background: '#eef2ff', color: '#3730a3', fontWeight: 700 }}>오늘</button>
          </div>
          <div style={{ justifySelf: 'end', fontSize: 14, fontWeight: 600, color: '#475569' }}>
            {weekDays[0].date} ~ {weekDays[6].date}
          </div>
        </div>
        <div style={tableScrollAreaStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#dbeafe' }}>
                <th style={{ ...thStyle, ...structureHeaderStyle, width: 300 }}>
                  <div style={structureHeaderContentStyle}>
                    <div style={structureHeaderTitleWrapStyle}>
                      <div style={structureHeaderActionGroupStyle}>
                        <button
                          type="button"
                          onClick={stepExpandStructure}
                          style={{
                            ...structureHeaderToggleBtnStyle,
                            opacity: collapseTargets.buildingIds.length === 0 || structureExpandStage >= 3 ? 0.5 : 1,
                            cursor: collapseTargets.buildingIds.length === 0 || structureExpandStage >= 3 ? 'not-allowed' : 'pointer',
                          }}
                          aria-label="단계 펼치기"
                          title="단계 펼치기 (동 → 방 → 칸)"
                          disabled={collapseTargets.buildingIds.length === 0 || structureExpandStage >= 3}
                        >
                          ▸
                        </button>
                        <button
                          type="button"
                          onClick={stepCollapseStructure}
                          style={{
                            ...structureHeaderToggleBtnStyle,
                            opacity: collapseTargets.buildingIds.length === 0 || structureExpandStage <= 0 ? 0.5 : 1,
                            cursor: collapseTargets.buildingIds.length === 0 || structureExpandStage <= 0 ? 'not-allowed' : 'pointer',
                          }}
                          aria-label="단계 접기"
                          title="단계 접기 (칸 → 방 → 동)"
                          disabled={collapseTargets.buildingIds.length === 0 || structureExpandStage <= 0}
                        >
                          ▾
                        </button>
                      </div>
                      <span>농장구조</span>
                    </div>
                    <span style={structureHeaderSubTextStyle}>(재고두수)</span>
                  </div>
                </th>
                {weekDays.map((d) => (
                  <th key={d.date} style={dateHeaderStyle(d.date)}>{dateHeaderLabel(d.date, d.label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 18, color: '#64748b', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                    농장 구조가 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={`${row.key}-${idx}`}
                    style={{
                      background:
                        row.kind === 'building'
                          ? '#94a3b8'
                          : (row.bgColor || (idx % 2 === 0 ? '#d1d5db' : '#e5e7eb')),
                      borderTop: row.kind === 'building' ? '2px solid #6b7280' : undefined,
                      color: row.kind === 'building' ? '#1f2937' : undefined,
                    }}
                  >
                    <td
                      style={{
                        ...cellStyle,
                        ...structureCellStyle,
                        ...structureDividerCellStyle,
                        background: row.kind === 'building' ? '#94a3b8' : undefined,
                        fontSize: row.kind === 'building' ? 16 : undefined,
                        borderRight: row.kind === 'building' ? '1px solid #6b7280' : (row.lineColor ?? cellStyle.borderRight),
                        borderBottom: row.kind === 'building' ? '1px solid #6b7280' : (row.lineColor ?? cellStyle.borderBottom),
                        color: row.kind === 'building' ? '#111827' : undefined,
                        fontWeight: row.kind === 'building' ? 700 : undefined,
                        paddingLeft: 12 + row.depth * 18,
                      }}
                    >
                      {row.hasChildren ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (row.kind === 'building') {
                              toggleSetValue(setCollapsedBuildings, row.id);
                              return;
                            }
                            if (row.kind === 'barn') {
                              toggleSetValue(setCollapsedBarns, row.id);
                              return;
                            }
                            if (row.kind === 'room') {
                              toggleSetValue(setCollapsedRooms, row.id);
                            }
                          }}
                        style={{
                          ...treeToggleBtnStyle,
                          color: row.expanded ? '#334155' : '#ffffff',
                          borderColor: row.expanded ? '#cbd5e1' : '#64748b',
                          background: row.expanded ? '#ffffff' : '#475569',
                        }}
                          aria-label={row.expanded ? '접기' : '펼치기'}
                          title={row.expanded ? '접기' : '펼치기'}
                        >
                          {row.expanded ? '▾' : '▸'}
                        </button>
                      ) : (
                        <span style={{ display: 'inline-block', width: 22 }} />
                      )}
                      <div style={structureRowContentStyle}>
                        <span style={structureLabelTextStyle}>{row.label}</span>
                        {row.kind === 'barn' || row.kind === 'room' || row.kind === 'section' ? (
                          <span style={headCountTextStyleByKind(row.kind)}>{formatHeadCount(row.headCount)}</span>
                        ) : null}
                      </div>
                    </td>
                    {weekDays.map((d) => (
                      <td
                        key={`${row.key}-${d.date}`}
                        style={
                          row.kind === 'building'
                            ? {
                                ...cellStyle,
                                background: '#94a3b8',
                                fontSize: 16,
                                borderLeft: '1px solid #6b7280',
                                borderRight: '1px solid #6b7280',
                                borderBottom: '1px solid #6b7280',
                              }
                            : dateCellStyle(d.date, row.lineColor)
                        }
                      >
                        {(() => {
                          const pendingItems =
                            row.kind === 'section' ? (pendingBySectionDate.get(`${row.id}|${d.date}`) ?? []) : [];
                          if (row.kind === 'section') {
                            return (
                              <div style={sectionCellContentStyle}>
                                <div style={pendingListWrapStyle}>
                                  {pendingItems.slice(0, 2).map((item) => (
                                    <button
                                      key={`${row.key}-${d.date}-pending-${item.id}`}
                                      type="button"
                                      style={pendingListItemBtnStyle}
                                      onClick={() => openCompleteExecutionModal(item, row.id, row.label)}
                                      title={`${executionLabel(item)} 완료 처리`}
                                    >
                                      <span style={pendingTypeTagStyle(item.executionType)}>{executionTypeLabel(item.executionType)}</span>
                                      <span style={pendingListItemTextStyle}>{executionLabel(item)}</span>
                                    </button>
                                  ))}
                                  {pendingItems.length > 2 ? (
                                    <div style={pendingListMoreStyle}>+{pendingItems.length - 2}</div>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  style={createExecutionBtnStyle}
                                  onClick={() => openCreateExecutionModal(row.id, row.label, d.date, row.candidateWorkPlanIds)}
                                >
                                  예정 등록
                                </button>
                                <button
                                  type="button"
                                  style={directCompleteBtnStyle}
                                  onClick={() => openDirectCompleteModal(row.id, row.label, d.date, row.candidateWorkPlanIds)}
                                >
                                  바로 완료
                                </button>
                              </div>
                            );
                          }
                          if (row.kind === 'room') {
                            return <span style={planTextStyle}>{row.planLabel ?? ''}</span>;
                          }
                          return '';
                        })()}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {isCalendarModalOpen ? (
        <div style={calendarModalBackdropStyle} onClick={() => setIsCalendarModalOpen(false)}>
          <div style={calendarModalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={calendarModalHeaderStyle}>
              <button type="button" onClick={() => moveCalendarMonth(-1)} style={calendarMonthMoveBtnStyle} aria-label="이전 달">‹</button>
              <strong style={calendarModalMonthTitleStyle}>{calendarMonthLabel}</strong>
              <button type="button" onClick={() => moveCalendarMonth(1)} style={calendarMonthMoveBtnStyle} aria-label="다음 달">›</button>
            </div>
            <div style={calendarWeekdayGridStyle}>
              {WEEK_LABELS.map((day) => (
                <div key={`weekday-${day}`} style={calendarWeekdayCellStyle}>{day}</div>
              ))}
            </div>
            <div style={calendarDateGridStyle}>
              {calendarCells.map(({ date, inCurrentMonth }, idx) => (
                <button
                  key={`${toDateStr(date)}-${idx}`}
                  type="button"
                  onClick={() => handleCalendarDatePick(date)}
                  style={calendarDateCellStyle(date, inCurrentMonth, weekStart, currentWeekEnd, selectedDateStr)}
                >
                  {date.getDate()}
                </button>
              ))}
            </div>
            <div style={calendarModalFooterStyle}>
              <button type="button" onClick={() => setIsCalendarModalOpen(false)} style={calendarCloseBtnStyle}>닫기</button>
            </div>
          </div>
        </div>
      ) : null}
      {isCreateExecutionModalOpen ? (
        <div style={createExecutionModalBackdropStyle} onClick={closeCreateExecutionModal}>
          <div style={createExecutionModalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={createExecutionHeaderStyle}>
              <strong style={createExecutionTitleStyle}>예정 등록</strong>
              <button type="button" style={createExecutionCloseIconStyle} onClick={closeCreateExecutionModal} disabled={createExecutionSubmitting}>✕</button>
            </div>
            <div style={createExecutionMetaStyle}>
              <div><span style={createExecutionMetaKeyStyle}>칸</span><span style={createExecutionMetaValueStyle}>{createExecutionSectionLabel}</span></div>
              <div><span style={createExecutionMetaKeyStyle}>날짜</span><span style={createExecutionMetaValueStyle}>{createExecutionDate}</span></div>
            </div>
            <label style={createExecutionLabelStyle}>
              작업 계획
              <select
                value={createExecutionWorkPlanId}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isFinite(next) || next <= 0) {
                    setCreateExecutionWorkPlanId('');
                    return;
                  }
                  setCreateExecutionWorkPlanId(next);
                  const selected = createExecutionCandidatePlans.find((p) => p.id === next);
                  setCreateExecutionType(inferExecutionTypeFromPlan(selected));
                }}
                style={createExecutionSelectStyle}
                disabled={createExecutionSubmitting}
              >
                <option value="">선택</option>
                {createExecutionCandidatePlans.map((p) => (
                  <option key={`create-plan-${p.id}`} value={p.id}>{workPlanOptionLabel(p)}</option>
                ))}
              </select>
            </label>
            <label style={createExecutionLabelStyle}>
              실행 유형
              <select
                value={createExecutionType}
                onChange={(e) => setCreateExecutionType(e.target.value as 'birth' | 'move' | 'inspection')}
                style={createExecutionSelectStyle}
                disabled={createExecutionSubmitting}
              >
                <option value="birth">분만</option>
                <option value="move">이동</option>
                <option value="inspection">시설/점검</option>
              </select>
            </label>
            <label style={createExecutionLabelStyle}>
              메모
              <textarea
                value={createExecutionMemo}
                onChange={(e) => setCreateExecutionMemo(e.target.value)}
                style={createExecutionTextareaStyle}
                maxLength={500}
                disabled={createExecutionSubmitting}
                placeholder="필요 시 메모를 입력하세요."
              />
            </label>
            {createExecutionError ? <div style={createExecutionErrorStyle}>{createExecutionError}</div> : null}
            <div style={createExecutionActionStyle}>
              <button type="button" onClick={closeCreateExecutionModal} style={createExecutionCancelBtnStyle} disabled={createExecutionSubmitting}>취소</button>
              <button
                type="button"
                onClick={submitCreateExecution}
                style={createExecutionSubmitBtnStyle}
                disabled={createExecutionSubmitting || createExecutionWorkPlanId === '' || createExecutionCandidatePlans.length === 0}
              >
                {createExecutionSubmitting ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isCompleteModalOpen ? (
        <div style={completeModalBackdropStyle} onClick={closeCompleteModal}>
          <div style={completeModalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={createExecutionHeaderStyle}>
              <strong style={createExecutionTitleStyle}>{completeMode === 'direct' ? '바로 완료' : '완료 처리'}</strong>
              <button type="button" style={createExecutionCloseIconStyle} onClick={closeCompleteModal} disabled={completeSubmitting}>✕</button>
            </div>
            <div style={createExecutionMetaStyle}>
              <div><span style={createExecutionMetaKeyStyle}>유형</span><span style={createExecutionMetaValueStyle}>{executionTypeLabel(activeCompleteExecutionType)}</span></div>
              <div><span style={createExecutionMetaKeyStyle}>칸</span><span style={createExecutionMetaValueStyle}>{completeExecutionSectionLabel}</span></div>
              <div>
                <span style={createExecutionMetaKeyStyle}>{completeMode === 'direct' ? '작업일' : '예정일'}</span>
                <span style={createExecutionMetaValueStyle}>{completeMode === 'direct' ? completeDirectDate : (completeExecutionTarget?.scheduledDate ?? '')}</span>
              </div>
            </div>
            {completeMode === 'direct' ? (
              <>
                <label style={createExecutionLabelStyle}>
                  작업 계획
                  <select
                    value={completeDirectWorkPlanId}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      if (!Number.isFinite(next) || next <= 0) {
                        setCompleteDirectWorkPlanId('');
                        return;
                      }
                      setCompleteDirectWorkPlanId(next);
                      const selected = completeDirectCandidatePlans.find((p) => p.id === next);
                      setCompleteDirectExecutionType(inferExecutionTypeFromPlan(selected));
                    }}
                    style={createExecutionSelectStyle}
                    disabled={completeSubmitting}
                  >
                    <option value="">선택</option>
                    {completeDirectCandidatePlans.map((p) => (
                      <option key={`complete-direct-plan-${p.id}`} value={p.id}>{workPlanOptionLabel(p)}</option>
                    ))}
                  </select>
                </label>
                <label style={createExecutionLabelStyle}>
                  실행 유형
                  <select
                    value={completeDirectExecutionType}
                    onChange={(e) => setCompleteDirectExecutionType(e.target.value as 'birth' | 'move' | 'inspection')}
                    style={createExecutionSelectStyle}
                    disabled={completeSubmitting}
                  >
                    <option value="birth">분만</option>
                    <option value="move">이동</option>
                    <option value="inspection">시설/점검</option>
                  </select>
                </label>
                <div style={completeMoveGridStyle}>
                  <label style={createExecutionLabelStyle}>
                    작업일
                    <input
                      type="date"
                      value={completeDirectDate}
                      onChange={(e) => setCompleteDirectDate(e.target.value)}
                      style={createExecutionInputStyle}
                      disabled={completeSubmitting}
                    />
                  </label>
                  <label style={createExecutionLabelStyle}>
                    sectionId
                    <select
                      value={completeDirectSectionId}
                      onChange={(e) => {
                        setCompleteDirectSectionId(e.target.value);
                        setCompleteBirthSectionId(e.target.value);
                        setCompleteMoveToSectionId(e.target.value);
                      }}
                      style={createExecutionSelectStyle}
                      disabled={completeSubmitting}
                    >
                      <option value="">선택</option>
                      {sectionOptions.map((s) => (
                        <option key={`complete-direct-section-${s.id}`} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            ) : null}
            {activeCompleteExecutionType === 'birth' ? (
              <>
                <label style={createExecutionLabelStyle}>
                  분만 마리수
                  <input
                    type="number"
                    min={1}
                    value={completeBirthCount}
                    onChange={(e) => setCompleteBirthCount(Number(e.target.value))}
                    style={createExecutionInputStyle}
                    disabled={completeSubmitting}
                  />
                </label>
                <label style={createExecutionLabelStyle}>
                  sectionId
                  <select
                    value={completeBirthSectionId}
                    onChange={(e) => setCompleteBirthSectionId(e.target.value)}
                    style={createExecutionSelectStyle}
                    disabled={completeSubmitting}
                  >
                    <option value="">선택</option>
                    {sectionOptions.map((s) => (
                      <option key={`complete-birth-section-${s.id}`} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </label>
                <label style={createExecutionLabelStyle}>
                  groupNo (옵션)
                  <input
                    type="text"
                    value={completeBirthGroupNo}
                    onChange={(e) => setCompleteBirthGroupNo(e.target.value)}
                    style={createExecutionInputStyle}
                    disabled={completeSubmitting}
                    placeholder="예: G-202602-001"
                  />
                </label>
                <label style={createExecutionLabelStyle}>
                  originSowId (옵션)
                  <input
                    type="text"
                    value={completeBirthOriginSowId}
                    onChange={(e) => setCompleteBirthOriginSowId(e.target.value)}
                    style={createExecutionInputStyle}
                    disabled={completeSubmitting}
                    placeholder="모돈 UUID"
                  />
                </label>
                <label style={createExecutionLabelStyle}>
                  메모
                  <textarea
                    value={completeBirthMemo}
                    onChange={(e) => setCompleteBirthMemo(e.target.value)}
                    style={createExecutionTextareaStyle}
                    maxLength={500}
                    disabled={completeSubmitting}
                    placeholder="필요 시 메모를 입력하세요."
                  />
                </label>
              </>
            ) : activeCompleteExecutionType === 'move' ? (
              <>
                <label style={createExecutionLabelStyle}>
                  이벤트 유형
                  <select
                    value={completeMoveEventType}
                    onChange={(e) => setCompleteMoveEventType(e.target.value as 'full' | 'partial' | 'split' | 'merge' | 'entry' | 'shipment')}
                    style={createExecutionSelectStyle}
                    disabled={completeSubmitting}
                  >
                    <option value="full">full (전량 이동)</option>
                    <option value="partial">partial (부분 이동)</option>
                    <option value="split">split (분할)</option>
                    <option value="merge">merge (합군)</option>
                    <option value="entry">entry (입식)</option>
                    <option value="shipment">shipment (출하)</option>
                  </select>
                </label>
                <label style={createExecutionLabelStyle}>
                  sourceGroupId
                  <select
                    value={completeMoveSourceGroupId}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCompleteMoveSourceGroupId(next);
                      const source = activePigGroups.find((g) => g.id === next);
                      if (source?.currentSectionId) setCompleteMoveFromSectionId(source.currentSectionId);
                    }}
                    style={createExecutionSelectStyle}
                    disabled={completeSubmitting}
                  >
                    <option value="">선택</option>
                    {activePigGroups.map((g) => (
                      <option key={`complete-move-group-${g.id}`} value={g.id}>
                        {`${g.groupNo} (${g.headCount}두)${g.currentSectionId ? ` / ${g.currentSectionId}` : ''}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={createExecutionLabelStyle}>
                  targetGroupId (옵션)
                  <input
                    type="text"
                    value={completeMoveTargetGroupId}
                    onChange={(e) => setCompleteMoveTargetGroupId(e.target.value)}
                    style={createExecutionInputStyle}
                    disabled={completeSubmitting}
                    placeholder="기존 target 돈군 UUID"
                  />
                </label>
                <div style={completeMoveGridStyle}>
                  <label style={createExecutionLabelStyle}>
                    fromSectionId (옵션)
                    <select
                      value={completeMoveFromSectionId}
                      onChange={(e) => setCompleteMoveFromSectionId(e.target.value)}
                      style={createExecutionSelectStyle}
                      disabled={completeSubmitting}
                    >
                      <option value="">자동(돈군 현재칸)</option>
                      {sectionOptions.map((s) => (
                        <option key={`complete-move-from-${s.id}`} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </label>
                  <label style={createExecutionLabelStyle}>
                    toSectionId
                    <select
                      value={completeMoveToSectionId}
                      onChange={(e) => setCompleteMoveToSectionId(e.target.value)}
                      style={createExecutionSelectStyle}
                      disabled={completeSubmitting}
                    >
                      <option value="">선택</option>
                      {sectionOptions.map((s) => (
                        <option key={`complete-move-to-${s.id}`} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div style={completeMoveGridStyle}>
                  <label style={createExecutionLabelStyle}>
                    이동 마리수
                    <input
                      type="number"
                      min={1}
                      value={completeMoveHeadCount}
                      onChange={(e) => setCompleteMoveHeadCount(Number(e.target.value))}
                      style={createExecutionInputStyle}
                      disabled={completeSubmitting}
                    />
                  </label>
                  <label style={createExecutionLabelStyle}>
                    lineType
                    <select
                      value={completeMoveLineType}
                      onChange={(e) => setCompleteMoveLineType(e.target.value as 'move' | 'split_out' | 'split_in' | 'merge_in' | 'merge_out' | 'entry' | 'shipment')}
                      style={createExecutionSelectStyle}
                      disabled={completeSubmitting}
                    >
                      <option value="move">move</option>
                      <option value="split_out">split_out</option>
                      <option value="split_in">split_in</option>
                      <option value="merge_in">merge_in</option>
                      <option value="merge_out">merge_out</option>
                      <option value="entry">entry</option>
                      <option value="shipment">shipment</option>
                    </select>
                  </label>
                </div>
                <label style={createExecutionLabelStyle}>
                  메모
                  <textarea
                    value={completeMoveMemo}
                    onChange={(e) => setCompleteMoveMemo(e.target.value)}
                    style={createExecutionTextareaStyle}
                    maxLength={500}
                    disabled={completeSubmitting}
                    placeholder="필요 시 메모를 입력하세요."
                  />
                </label>
              </>
            ) : (
              <div style={completeUnsupportedTextStyle}>
                이 실행 유형은 아직 완료 API가 연결되지 않았습니다.
              </div>
            )}
            {completeError ? <div style={createExecutionErrorStyle}>{completeError}</div> : null}
            <div style={createExecutionActionStyle}>
              <button type="button" onClick={closeCompleteModal} style={createExecutionCancelBtnStyle} disabled={completeSubmitting}>취소</button>
              <button
                type="button"
                onClick={submitCompleteExecution}
                style={completeSubmitBtnStyle}
                disabled={completeSubmitting || (completeMode === 'direct' && completeDirectWorkPlanId === '')}
              >
                {completeSubmitting ? '처리 중...' : '완료 처리'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function resolvePlansByBarn(
  barn: FarmBarn,
  planByTemplate: Map<number, FarmScheduleWorkPlanMasterItem[]>
): FarmScheduleWorkPlanMasterItem[] {
  const rawType = String(barn.barnType ?? '').trim();
  if (!/^[0-9]+$/.test(rawType)) return [];
  const tid = Number(rawType);
  if (!Number.isFinite(tid)) return [];
  return planByTemplate.get(tid) ?? [];
}

function planLabel(p: FarmScheduleWorkPlanMasterItem): string {
  const v = (p.workContent ?? p.criteriaName ?? p.jobtypeName ?? p.sortationName ?? '').toString().trim();
  return v || '일정';
}

function workPlanOptionLabel(p: FarmScheduleWorkPlanMasterItem): string {
  const base = planLabel(p);
  const meta = [p.sortationName, p.jobtypeName, p.criteriaName]
    .map((v) => (v ?? '').toString().trim())
    .filter((v) => v.length > 0)
    .join(' / ');
  return meta ? `${base} - ${meta}` : base;
}

function inferExecutionTypeFromPlan(
  p?: FarmScheduleWorkPlanMasterItem
): 'birth' | 'move' | 'inspection' {
  if (!p) return 'inspection';
  const text = `${p.workContent ?? ''} ${p.criteriaName ?? ''} ${p.jobtypeName ?? ''} ${p.sortationName ?? ''}`.toLowerCase();
  if (text.includes('분만') || text.includes('출산') || text.includes('farrow') || text.includes('birth')) return 'birth';
  if (text.includes('이동') || text.includes('합군') || text.includes('분할') || text.includes('move') || text.includes('merge') || text.includes('split')) return 'move';
  return 'inspection';
}

function isFacilityOnlyPlan(p?: FarmScheduleWorkPlanMasterItem): boolean {
  if (!p) return false;
  const text = `${p.workContent ?? ''} ${p.criteriaName ?? ''} ${p.jobtypeName ?? ''} ${p.sortationName ?? ''}`.toLowerCase();
  if (!text.trim()) return false;
  const facilityKeywords = [
    '시설', '점검', '청소', '세척', '소독', '정비', '수리', '환기', '온도', '습도', '전기', '급수', '배수',
    'facility', 'maintenance', 'clean', 'sanitize', 'inspection',
  ];
  const animalKeywords = [
    '모돈', '자돈', '후보돈', '비육돈', '돈군', '개체', '분만', '포유', '이유', '교배', '임신', '백신', '접종',
    '폐사', '출하', '이동', '합군', '분할',
    'sow', 'piglet', 'farrowing', 'move', 'shipment', 'group',
  ];
  if (animalKeywords.some((k) => text.includes(k))) return false;
  return facilityKeywords.some((k) => text.includes(k));
}

function shouldShowRoomPlan(headCount: number, p?: FarmScheduleWorkPlanMasterItem): boolean {
  if (!p) return false;
  if (headCount > 0) return true;
  return isFacilityOnlyPlan(p);
}

function executionTypeLabel(executionType: string): string {
  switch (executionType) {
    case 'birth':
      return '분만';
    case 'move':
      return '이동';
    case 'inspection':
      return '점검';
    default:
      return executionType || '일정';
  }
}

function pendingTypeTagStyle(executionType: string): CSSProperties {
  if (executionType === 'birth') {
    return { ...pendingTypeTagBaseStyle, background: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' };
  }
  if (executionType === 'move') {
    return { ...pendingTypeTagBaseStyle, background: '#e0e7ff', color: '#3730a3', borderColor: '#c7d2fe' };
  }
  return { ...pendingTypeTagBaseStyle, background: '#ecfeff', color: '#155e75', borderColor: '#a5f3fc' };
}

function executionLabel(item: FarmScheduleExecutionItem): string {
  const text =
    item.workContent?.trim() ||
    item.criteriaName?.trim() ||
    item.jobtypeName?.trim() ||
    item.sortationName?.trim() ||
    executionTypeLabel(item.executionType);
  return text || '일정';
}

function buildPendingExecutionMap(items: FarmScheduleExecutionItem[]): Map<string, FarmScheduleExecutionItem[]> {
  const map = new Map<string, FarmScheduleExecutionItem[]>();
  items.forEach((item) => {
    const sectionId = String(item.sectionId ?? '').trim();
    const date = String(item.scheduledDate ?? '').slice(0, 10);
    if (!sectionId || !date) return;
    const key = `${sectionId}|${date}`;
    const prev = map.get(key) ?? [];
    if (!prev.some((x) => x.id === item.id)) prev.push(item);
    map.set(key, prev);
  });
  return map;
}

function collectSectionOptions(
  tree: FarmBuilding[],
  templateNameById: Map<number, string>
): Array<{ id: string; label: string }> {
  const options: Array<{ id: string; label: string }> = [];
  tree.forEach((building) => {
    (building.barns ?? []).forEach((barn) => {
      const barnLabel = displayBarnName(barn, templateNameById);
      (barn.rooms ?? []).forEach((room) => {
        const roomLabel = normalizeRoomName(room);
        (room.sections ?? []).forEach((section) => {
          const sectionLabel = normalizeSectionName(
            (section as { name?: string | null; sectionNumber?: number | null }).name,
            (section as { name?: string | null; sectionNumber?: number | null }).sectionNumber
          );
          options.push({
            id: String(section.id),
            label: `${building.name || '건물'} / ${barnLabel} / ${roomLabel} / ${sectionLabel}`,
          });
        });
      });
    });
  });
  return options;
}

function displayBarnName(barn: FarmBarn, templateNameById: Map<number, string>): string {
  const mappedName = barn.structureTemplateId != null ? templateNameById.get(Number(barn.structureTemplateId)) : undefined;
  const rawBarnName = (barn.name ?? '').trim();
  const isGenericBarn = rawBarnName === '' || /^barn$/i.test(rawBarnName);
  const type = String(barn.barnType ?? '').toLowerCase();
  const isProduction = type === 'production';
  return mappedName || (!isGenericBarn ? rawBarnName : '') || (isProduction ? '사육시설' : '일반시설');
}

function flattenStructureRows(
  tree: FarmBuilding[],
  templateNameById: Map<number, string>,
  templateColorById: Map<number, string>,
  sectionHeadCountById: Map<string, number>,
  planByTemplate: Map<number, FarmScheduleWorkPlanMasterItem[]>,
  collapsedBuildings: Set<string>,
  collapsedBarns: Set<string>,
  collapsedRooms: Set<string>
) {
  const rows: Array<{
    key: string;
    id: string;
    label: string;
    depth: number;
    kind: 'building' | 'barn' | 'room' | 'section';
    planLabel?: string;
    bgColor?: string;
    lineColor?: string;
    headCount?: number;
    candidateWorkPlanIds?: number[];
    hasChildren?: boolean;
    expanded?: boolean;
  }> = [];
  tree.forEach((b) => {
    const buildingId = String(b.id);
    const buildingExpanded = !collapsedBuildings.has(buildingId);
    rows.push({
      key: `b-${b.id}`,
      id: buildingId,
      label: b.name || '건물',
      depth: 0,
      kind: 'building',
      hasChildren: (b.barns?.length ?? 0) > 0,
      expanded: buildingExpanded,
    });
    if (!buildingExpanded) return;
    (b.barns ?? []).forEach((barn) => {
      const plans = resolvePlansByBarn(barn, planByTemplate);
      const barnColor = resolveBarnColor(barn, templateColorById);
      const barnHeadCount = sumBarnHeadCount(barn, sectionHeadCountById);
      const barnId = String(barn.id);
      const barnExpanded = !collapsedBarns.has(barnId);
      rows.push({
        key: `ba-${barn.id}`,
        id: barnId,
        label: `${displayBarnName(barn, templateNameById)}(방${barn.rooms?.length ?? 0}개)`,
        depth: 1,
        kind: 'barn',
        bgColor: barnColor ? hexToRgba(barnColor, 0.26) : undefined,
        lineColor: barnColor ? lineColorFromBarnColor(barnColor) : undefined,
        headCount: barnHeadCount,
        hasChildren: (barn.rooms?.length ?? 0) > 0,
        expanded: barnExpanded,
      });
      if (!barnExpanded) return;
      (barn.rooms ?? []).forEach((room) => {
        const roomId = String(room.id);
        const roomExpanded = !collapsedRooms.has(roomId);
        const roomHeadCount = sumRoomHeadCount(room, sectionHeadCountById);
        const firstPlan = plans.length > 0 ? plans[0] : undefined;
        rows.push({
          key: `r-${room.id}`,
          id: roomId,
          label: `${normalizeRoomName(room)}(칸${room.sections?.length ?? 0}칸)`,
          depth: 2,
          kind: 'room',
          planLabel: firstPlan && shouldShowRoomPlan(roomHeadCount, firstPlan) ? planLabel(firstPlan) : undefined,
          bgColor: barnColor ? hexToRgba(barnColor, 0.14) : undefined,
          lineColor: barnColor ? lineColorFromBarnColor(barnColor) : undefined,
          headCount: roomHeadCount,
          hasChildren: (room.sections?.length ?? 0) > 0,
          expanded: roomExpanded,
        });
        if (!roomExpanded) return;
        (room.sections ?? []).forEach((sec) => {
          const secName = normalizeSectionName(
            (sec as { name?: string | null; sectionNumber?: number | null }).name,
            (sec as { name?: string | null; sectionNumber?: number | null }).sectionNumber
          );
          rows.push({
            key: `s-${sec.id}`,
            id: String(sec.id),
            label: secName,
            depth: 3,
            kind: 'section',
            bgColor: barnColor ? hexToRgba(barnColor, 0.08) : undefined,
            lineColor: barnColor ? lineColorFromBarnColor(barnColor) : undefined,
            headCount: resolveSectionHeadCount(sec, sectionHeadCountById),
            candidateWorkPlanIds: plans.map((p) => p.id).filter((id) => Number.isFinite(id)),
          });
        });
      });
    });
  });
  return rows;
}

function resolveSectionHeadCount(section: FarmSection, sectionHeadCountById: Map<string, number>): number {
  const byBalance = sectionHeadCountById.get(String(section.id));
  if (typeof byBalance === 'number' && Number.isFinite(byBalance)) return byBalance;
  if (typeof section.currentPigCount === 'number' && Number.isFinite(section.currentPigCount)) return section.currentPigCount;
  return 0;
}

function sumRoomHeadCount(room: FarmRoom, sectionHeadCountById: Map<string, number>): number {
  return (room.sections ?? []).reduce((acc, section) => acc + resolveSectionHeadCount(section, sectionHeadCountById), 0);
}

function sumBarnHeadCount(barn: FarmBarn, sectionHeadCountById: Map<string, number>): number {
  return (barn.rooms ?? []).reduce((acc, room) => acc + sumRoomHeadCount(room, sectionHeadCountById), 0);
}

function collectCollapseTargets(tree: FarmBuilding[]): { buildingIds: string[]; barnIds: string[]; roomIds: string[] } {
  const buildingIds: string[] = [];
  const barnIds: string[] = [];
  const roomIds: string[] = [];
  tree.forEach((building) => {
    buildingIds.push(String(building.id));
    (building.barns ?? []).forEach((barn) => {
      barnIds.push(String(barn.id));
      (barn.rooms ?? []).forEach((room) => {
        roomIds.push(String(room.id));
      });
    });
  });
  return { buildingIds, barnIds, roomIds };
}

function resolveStructureExpandStage(
  targets: { buildingIds: string[]; barnIds: string[]; roomIds: string[] },
  collapsedBuildings: Set<string>,
  collapsedBarns: Set<string>,
  collapsedRooms: Set<string>
): 0 | 1 | 2 | 3 {
  const hasBuildings = targets.buildingIds.length > 0;
  const allBuildingsCollapsed = hasBuildings && targets.buildingIds.every((id) => collapsedBuildings.has(id));
  const allBarnsCollapsed = targets.barnIds.length === 0 || targets.barnIds.every((id) => collapsedBarns.has(id));
  const allRoomsCollapsed = targets.roomIds.length === 0 || targets.roomIds.every((id) => collapsedRooms.has(id));
  const noBuildingsCollapsed = targets.buildingIds.every((id) => !collapsedBuildings.has(id));
  const noBarnsCollapsed = targets.barnIds.every((id) => !collapsedBarns.has(id));
  const noRoomsCollapsed = targets.roomIds.every((id) => !collapsedRooms.has(id));

  if (allBuildingsCollapsed) return 0;
  if (noBuildingsCollapsed && allBarnsCollapsed) return 1;
  if (noBuildingsCollapsed && noBarnsCollapsed && allRoomsCollapsed) return 2;
  if (noBuildingsCollapsed && noBarnsCollapsed && noRoomsCollapsed) return 3;

  // 혼합 상태일 때는 가장 가까운 단계로 추정
  if (noBuildingsCollapsed && noBarnsCollapsed) return 2;
  if (noBuildingsCollapsed) return 1;
  return hasBuildings ? 0 : 3;
}

function toggleSetValue(setter: Dispatch<SetStateAction<Set<string>>>, id: string) {
  setter((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

function resolveBarnColor(barn: FarmBarn, templateColorById: Map<number, string>): string | null {
  if (barn.structureTemplateId != null) {
    const c = templateColorById.get(Number(barn.structureTemplateId));
    if (c) return c;
  }
  const rawType = String(barn.barnType ?? '').trim();
  if (/^[0-9]+$/.test(rawType)) {
    const c = templateColorById.get(Number(rawType));
    if (c) return c;
  }
  return null;
}

function normalizeHexColor(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) return null;
  return v.toUpperCase();
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lineColorFromBarnColor(hex: string): string {
  return `1px solid ${hexToRgba(darkenHex(hex, 0.14), 0.72)}`;
}

function darkenHex(hex: string, amount: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const ratio = Math.max(0, Math.min(1, 1 - amount));
  const r = clamp(parseInt(hex.slice(1, 3), 16) * ratio);
  const g = clamp(parseInt(hex.slice(3, 5), 16) * ratio);
  const b = clamp(parseInt(hex.slice(5, 7), 16) * ratio);
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

const weekBtnStyle: CSSProperties = {
  fontFamily: 'inherit',
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  background: '#fff',
  color: '#0f172a',
  padding: '7px 14px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const dayBtnStyle: CSSProperties = {
  ...weekBtnStyle,
  padding: '7px 12px',
  fontSize: 13,
  color: '#1e293b',
  background: '#f8fafc',
};

const toolbarWrapStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'center',
  gap: 10,
  padding: '12px 16px',
  borderBottom: '1px solid #e2e8f0',
  background: '#fff',
};

const tableScrollAreaStyle: CSSProperties = {
  overflow: 'auto',
  minHeight: 0,
  maxHeight: 'calc(100vh - 230px)',
};

const monthLabelStyle: CSSProperties = {
  fontSize: 30,
  fontWeight: 800,
  color: '#0f172a',
  lineHeight: 1,
};

const calendarIconStyle: CSSProperties = {
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
  borderRadius: 10,
  border: '2px solid #64748b',
  background: '#e2e8f0',
  fontSize: 24,
  lineHeight: 1,
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.18)',
};

const calendarIconBtnStyle: CSSProperties = {
  ...calendarIconStyle,
  cursor: 'pointer',
  padding: 0,
};

const calendarModalBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.42)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 80,
  padding: 12,
};

const calendarModalStyle: CSSProperties = {
  width: 320,
  maxWidth: '100%',
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  boxShadow: '0 16px 40px rgba(15, 23, 42, 0.28)',
  padding: 14,
  display: 'grid',
  gap: 10,
};

const calendarModalHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const calendarModalMonthTitleStyle: CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  color: '#0f172a',
};

const calendarMonthMoveBtnStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: '#f8fafc',
  color: '#1e293b',
  fontSize: 18,
  fontWeight: 700,
  cursor: 'pointer',
  lineHeight: 1,
  padding: 0,
};

const calendarWeekdayGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 4,
};

const calendarWeekdayCellStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: 12,
  fontWeight: 700,
  color: '#64748b',
  padding: '4px 0',
};

const calendarDateGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 4,
};

const calendarModalFooterStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
};

const calendarCloseBtnStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  background: '#f8fafc',
  color: '#0f172a',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const createExecutionModalBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.42)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 81,
  padding: 12,
};

const createExecutionModalStyle: CSSProperties = {
  width: 420,
  maxWidth: '100%',
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  boxShadow: '0 16px 40px rgba(15, 23, 42, 0.28)',
  padding: 14,
  display: 'grid',
  gap: 10,
};

const createExecutionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const createExecutionTitleStyle: CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  color: '#0f172a',
};

const createExecutionCloseIconStyle: CSSProperties = {
  width: 28,
  height: 28,
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  background: '#f8fafc',
  color: '#334155',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  lineHeight: 1,
  padding: 0,
};

const createExecutionMetaStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
};

const createExecutionMetaKeyStyle: CSSProperties = {
  display: 'inline-block',
  width: 38,
  color: '#64748b',
  fontSize: 12,
  fontWeight: 700,
};

const createExecutionMetaValueStyle: CSSProperties = {
  color: '#0f172a',
  fontSize: 13,
  fontWeight: 700,
};

const createExecutionLabelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  fontWeight: 700,
  color: '#334155',
};

const createExecutionSelectStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  padding: '8px 10px',
  fontFamily: 'inherit',
  fontSize: 13,
  color: '#0f172a',
  background: '#fff',
};

const createExecutionTextareaStyle: CSSProperties = {
  width: '100%',
  minHeight: 74,
  resize: 'vertical',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  padding: '8px 10px',
  fontFamily: 'inherit',
  fontSize: 13,
  color: '#0f172a',
};

const createExecutionErrorStyle: CSSProperties = {
  color: '#dc2626',
  fontSize: 12,
  fontWeight: 700,
};

const createExecutionActionStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
};

const createExecutionCancelBtnStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  background: '#f8fafc',
  color: '#0f172a',
  borderRadius: 8,
  padding: '7px 12px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const createExecutionSubmitBtnStyle: CSSProperties = {
  border: '1px solid #1d4ed8',
  background: '#1d4ed8',
  color: '#ffffff',
  borderRadius: 8,
  padding: '7px 12px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const createExecutionInputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  padding: '8px 10px',
  fontFamily: 'inherit',
  fontSize: 13,
  color: '#0f172a',
  background: '#fff',
};

const completeModalBackdropStyle: CSSProperties = {
  ...createExecutionModalBackdropStyle,
  zIndex: 82,
};

const completeModalStyle: CSSProperties = {
  ...createExecutionModalStyle,
  width: 520,
  maxHeight: 'calc(100vh - 40px)',
  overflowY: 'auto',
};

const completeMoveGridStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
};

const completeUnsupportedTextStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#64748b',
  padding: '6px 2px',
};

const completeSubmitBtnStyle: CSSProperties = {
  border: '1px solid #15803d',
  background: '#16a34a',
  color: '#ffffff',
  borderRadius: 8,
  padding: '7px 12px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const thStyle: CSSProperties = {
  fontFamily: 'inherit',
  color: '#1e3a8a',
  fontWeight: 700,
  fontSize: 16,
  height: 46,
  padding: '0 10px',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
  position: 'sticky',
  top: 0,
  zIndex: 3,
  borderRight: '1px solid #94a3b8',
  borderBottom: '1px solid #94a3b8',
  textAlign: 'center',
};

const structureHeaderStyle: CSSProperties = {
  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
  color: '#ffffff',
};

const cellStyle: CSSProperties = {
  fontFamily: 'inherit',
  minHeight: 40,
  borderRight: '1px solid #94a3b8',
  borderBottom: '1px solid #94a3b8',
  padding: '9px 10px',
  fontSize: 14,
  color: '#111827',
};

const structureCellStyle: CSSProperties = {
  whiteSpace: 'nowrap',
};

const structureDividerCellStyle: CSSProperties = {};

const treeToggleBtnStyle: CSSProperties = {
  fontFamily: 'inherit',
  width: 20,
  height: 20,
  marginRight: 6,
  border: '1px solid #cbd5e1',
  borderRadius: 4,
  background: '#fff',
  color: '#334155',
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0,
};

const planTextStyle: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 14,
  fontWeight: 400,
  color: '#111827',
};

const pendingListWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  alignContent: 'start',
  minHeight: 18,
};

const pendingListItemBtnStyle: CSSProperties = {
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  border: '1px solid #bfdbfe',
  background: '#eff6ff',
  borderRadius: 8,
  padding: '2px 6px',
  cursor: 'pointer',
  textAlign: 'left',
};

const pendingListItemTextStyle: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 700,
  color: '#1f2937',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const pendingListMoreStyle: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 700,
  color: '#475569',
};

const pendingTypeTagBaseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 28,
  border: '1px solid transparent',
  borderRadius: 6,
  padding: '1px 4px',
  fontSize: 10,
  fontWeight: 800,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
};

const sectionCellContentStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  alignContent: 'start',
};

const createExecutionBtnStyle: CSSProperties = {
  fontFamily: 'inherit',
  width: 'fit-content',
  border: '1px solid #bfdbfe',
  background: '#eff6ff',
  color: '#1d4ed8',
  borderRadius: 8,
  padding: '2px 8px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

const directCompleteBtnStyle: CSSProperties = {
  ...createExecutionBtnStyle,
  border: '1px solid #86efac',
  background: '#f0fdf4',
  color: '#15803d',
};

const structureRowContentStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  width: 'calc(100% - 30px)',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};

const structureLabelTextStyle: CSSProperties = {
  minWidth: 0,
  flex: '1 1 auto',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const structureHeaderContentStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  width: '100%',
};

const structureHeaderTitleWrapStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const structureHeaderActionGroupStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};

const structureHeaderToggleBtnStyle: CSSProperties = {
  ...treeToggleBtnStyle,
  marginRight: 0,
};

const structureHeaderSubTextStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  opacity: 0.95,
  whiteSpace: 'nowrap',
};

const sectionHeadCountTextStyle: CSSProperties = {
  marginLeft: 10,
  color: '#0f172a',
  fontSize: 13,
  fontWeight: 700,
  whiteSpace: 'nowrap',
};

const roomHeadCountTextStyle: CSSProperties = {
  ...sectionHeadCountTextStyle,
  color: '#1d4ed8',
  fontSize: 14,
  fontWeight: 700,
};

const barnHeadCountTextStyle: CSSProperties = {
  ...sectionHeadCountTextStyle,
  color: '#7c2d12',
  fontSize: 16,
  fontWeight: 800,
};

function headCountTextStyleByKind(kind: 'building' | 'barn' | 'room' | 'section'): CSSProperties {
  if (kind === 'barn') return barnHeadCountTextStyle;
  if (kind === 'room') return roomHeadCountTextStyle;
  return sectionHeadCountTextStyle;
}

function formatHeadCount(value?: number): string {
  return `( ${value ?? 0} )`;
}

function calendarDateCellStyle(
  date: Date,
  inCurrentMonth: boolean,
  weekStart: Date,
  weekEnd: Date,
  selectedDateStr: string
): CSSProperties {
  const dateKey = toDateStr(date);
  const isToday = dateKey === toDateStr(new Date());
  const isSelected = dateKey === selectedDateStr;
  const inCurrentWeek = dateKey >= toDateStr(weekStart) && dateKey <= toDateStr(weekEnd);
  let color = '#0f172a';
  if (isSelected) color = '#ffffff';
  else if (!inCurrentMonth) color = '#94a3b8';
  else if (date.getDay() === 0) color = '#be123c';
  else if (date.getDay() === 6) color = '#2563eb';
  return {
    height: 34,
    borderRadius: 8,
    border: isSelected ? '2px solid #1d4ed8' : (isToday ? '2px solid #2563eb' : '1px solid #e2e8f0'),
    background: isSelected ? '#1d4ed8' : (isToday ? '#dbeafe' : (inCurrentWeek ? '#eff6ff' : '#ffffff')),
    color,
    fontSize: 13,
    fontWeight: isSelected ? 800 : (isToday ? 800 : (inCurrentWeek ? 700 : 500)),
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  };
}

function normalizeRoomName(room: FarmRoom): string {
  const rawName = (room.name ?? '').trim();
  if (rawName) {
    const roomMatch = rawName.match(/^Room\s*(\d+)$/i);
    if (roomMatch) return `${roomMatch[1]}번방`;
    const leadingNum = rawName.match(/^(\d+)/);
    if (leadingNum && /[^\x00-\x7F]/.test(rawName) && !/번방/.test(rawName)) {
      return `${leadingNum[1]}번방`;
    }
    return rawName;
  }
  if (room.roomNumber != null) return `${room.roomNumber}번방`;
  return '방';
}

function normalizeSectionName(name?: string | null, sectionNumber?: number | null): string {
  const rawName = (name ?? '').trim();
  if (rawName) {
    const secMatch = rawName.match(/^Section\s*(\d+)$/i);
    if (secMatch) return `${secMatch[1]}번칸`;
    const leadingNum = rawName.match(/^(\d+)/);
    if (leadingNum && /[^\x00-\x7F]/.test(rawName) && !/번칸/.test(rawName)) {
      return `${leadingNum[1]}번칸`;
    }
    return rawName;
  }
  if (sectionNumber != null) return `${sectionNumber}번칸`;
  return '칸';
}

function dateHeaderStyle(date: string): CSSProperties {
  const divider = dateDividerStyle(date, true);
  const isToday = isTodayDate(date);
  let style: CSSProperties = {
    ...thStyle,
    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    color: '#1e3a8a',
    borderLeft: divider,
  };
  if (isSunday(date)) {
    style = {
      ...style,
      background: 'linear-gradient(135deg, #be123c 0%, #e11d48 100%)',
    };
  } else if (isSaturday(date)) {
    style = {
      ...style,
      background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
      color: '#1e3a8a',
    };
  } else if (isKoreanLegalHoliday(date)) {
    style = {
      ...style,
      background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
    };
  }
  if (isToday) {
    style = {
      ...style,
      fontSize: 20,
      fontWeight: 800,
      letterSpacing: 0.2,
    };
  }
  return style;
}

function dateCellStyle(date: string, lineColor?: string): CSSProperties {
  const divider = dateDividerStyle(date, false);
  return {
    ...cellStyle,
    borderLeft: lineColor ?? divider,
    borderRight: lineColor ?? cellStyle.borderRight,
    borderBottom: lineColor ?? cellStyle.borderBottom,
  };
}

function dateDividerStyle(date: string, forHeader: boolean): string {
  return '1px solid #94a3b8';
}

function isWeekend(date: string): boolean {
  const d = new Date(`${date}T00:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function isSunday(date: string): boolean {
  return new Date(`${date}T00:00:00`).getDay() === 0;
}

function isSaturday(date: string): boolean {
  return new Date(`${date}T00:00:00`).getDay() === 6;
}

function isTodayDate(date: string): boolean {
  return date === toDateStr(new Date());
}

function dateHeaderLabel(date: string, dayLabel: string): string {
  const day = Number(date.slice(8, 10));
  if (isTodayDate(date)) {
    return `【${day} (${dayLabel})】`;
  }
  return `${day} (${dayLabel})`;
}

function isKoreanLegalHoliday(date: string): boolean {
  const mmdd = date.slice(5);
  return KOREAN_FIXED_LEGAL_HOLIDAYS.has(mmdd);
}

const KOREAN_FIXED_LEGAL_HOLIDAYS = new Set([
  '01-01', // 신정
  '03-01', // 삼일절
  '05-05', // 어린이날
  '06-06', // 현충일
  '08-15', // 광복절
  '10-03', // 개천절
  '10-09', // 한글날
  '12-25', // 성탄절
]);

