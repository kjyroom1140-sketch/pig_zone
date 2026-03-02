'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  getStructureTemplates,
  getFarmStructureProduction,
  // Admin(전역) - alias
  getScheduleSortations as getScheduleSortationsAdmin,
  getScheduleCriterias as getScheduleCriteriasAdmin,
  getScheduleJobtypes as getScheduleJobtypesAdmin,
  getScheduleWorkPlans as getScheduleWorkPlansAdmin,
  createScheduleSortation as createScheduleSortationAdmin,
  createScheduleCriteria as createScheduleCriteriaAdmin,
  createScheduleJobtype as createScheduleJobtypeAdmin,
  updateScheduleSortation as updateScheduleSortationAdmin,
  updateScheduleCriteria as updateScheduleCriteriaAdmin,
  updateScheduleJobtype as updateScheduleJobtypeAdmin,
  deleteScheduleSortation as deleteScheduleSortationAdmin,
  deleteScheduleCriteria as deleteScheduleCriteriaAdmin,
  deleteScheduleJobtype as deleteScheduleJobtypeAdmin,
  getScheduleSortationDefinitions as getScheduleSortationDefinitionsAdmin,
  createScheduleSortationDefinition as createScheduleSortationDefinitionAdmin,
  updateScheduleSortationDefinition as updateScheduleSortationDefinitionAdmin,
  deleteScheduleSortationDefinition as deleteScheduleSortationDefinitionAdmin,
  getScheduleJobtypeDefinitions as getScheduleJobtypeDefinitionsAdmin,
  createScheduleJobtypeDefinition as createScheduleJobtypeDefinitionAdmin,
  updateScheduleJobtypeDefinition as updateScheduleJobtypeDefinitionAdmin,
  deleteScheduleJobtypeDefinition as deleteScheduleJobtypeDefinitionAdmin,
  getScheduleCriteriaDefinitions as getScheduleCriteriaDefinitionsAdmin,
  createScheduleCriteriaDefinition as createScheduleCriteriaDefinitionAdmin,
  updateScheduleCriteriaDefinition as updateScheduleCriteriaDefinitionAdmin,
  deleteScheduleCriteriaDefinition as deleteScheduleCriteriaDefinitionAdmin,
  createScheduleWorkPlan as createScheduleWorkPlanAdmin,
  updateScheduleWorkPlan as updateScheduleWorkPlanAdmin,
  deleteScheduleWorkPlan as deleteScheduleWorkPlanAdmin,
  reorderScheduleWorkPlans as reorderScheduleWorkPlansAdmin,
  // Farm(농장)
  getFarmScheduleSortations,
  getFarmScheduleCriterias,
  getFarmScheduleJobtypes,
  getFarmScheduleWorkPlansMaster,
  createFarmScheduleSortation,
  createFarmScheduleCriteria,
  createFarmScheduleJobtype,
  updateFarmScheduleSortation,
  updateFarmScheduleCriteria,
  updateFarmScheduleJobtype,
  deleteFarmScheduleSortation,
  deleteFarmScheduleCriteria,
  deleteFarmScheduleJobtype,
  getFarmScheduleSortationDefinitions,
  createFarmScheduleSortationDefinition,
  updateFarmScheduleSortationDefinition,
  deleteFarmScheduleSortationDefinition,
  getFarmScheduleJobtypeDefinitions,
  createFarmScheduleJobtypeDefinition,
  updateFarmScheduleJobtypeDefinition,
  deleteFarmScheduleJobtypeDefinition,
  getFarmScheduleCriteriaDefinitions,
  createFarmScheduleCriteriaDefinition,
  updateFarmScheduleCriteriaDefinition,
  deleteFarmScheduleCriteriaDefinition,
  createFarmScheduleWorkPlanMaster,
  updateFarmScheduleWorkPlanMaster,
  deleteFarmScheduleWorkPlanMaster,
  reorderFarmScheduleWorkPlansMaster,
  type StructureTemplate,
  type ScheduleSortationItem,
  type ScheduleCriteriaItem,
  type ScheduleJobtypeItem,
  type ScheduleSortationDefinitionItem,
  type ScheduleJobtypeDefinitionItem,
  type ScheduleCriteriaDefinitionItem,
  type ScheduleWorkPlanItem,
  type CriteriaContent,
  type CriteriaContentType,
} from '@/lib/api';

const FARM_KEY = 'currentFarmId';

/** JSON 문자열 또는 객체에서 표시 라벨 추출 (배열 첫 항목 name 또는 요약) */
function labelFrom(value: string | null | undefined | unknown): string {
  if (value == null || value === '') return '—';
  try {
    const v = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(v) && v.length > 0) {
      const first = v[0];
      if (typeof first === 'object' && first !== null && 'name' in first) return String((first as { name?: string }).name ?? '');
      return `${v.length}건`;
    }
    if (typeof v === 'object' && v !== null && 'name' in v) return String((v as { name?: string }).name ?? '');
    return typeof v === 'string' ? v : '—';
  } catch {
    return typeof value === 'string' ? value.slice(0, 50) : '—';
  }
}

/** criterias JSON에서 첫 항목의 start_date, end_date 추출 (YYYY-MM-DD) */
function criteriaDatesFrom(value: string | null | undefined): { startDate: string; endDate: string } {
  const empty = { startDate: '', endDate: '' };
  if (value == null || value === '') return empty;
  try {
    const v = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(v) && v.length > 0) {
      const first = v[0] as { start_date?: string; end_date?: string };
      if (typeof first === 'object' && first !== null) {
        return {
          startDate: typeof first.start_date === 'string' ? first.start_date : '',
          endDate: typeof first.end_date === 'string' ? first.end_date : '',
        };
      }
    }
    return empty;
  } catch {
    return empty;
  }
}

/** schedule_sortations 행에서 sortation_definition_id 추출 (구분 목록 선택 모달용) */
function getSortationDefId(s: ScheduleSortationItem): number | null {
  if (s.sortations == null) return null;
  try {
    const v = typeof s.sortations === 'string' ? JSON.parse(s.sortations) : s.sortations;
    if (Array.isArray(v) && v[0] && typeof v[0] === 'object' && v[0] !== null && 'sortation_definition_id' in v[0]) {
      return (v[0] as { sortation_definition_id: number }).sortation_definition_id;
    }
  } catch {}
  return null;
}

/** schedule_jobtypes 행에서 jobtype_definition_id 추출 (작업유형 목록 선택 모달용) */
function getJobtypeDefId(j: ScheduleJobtypeItem): number | null {
  if (j.jobtypes == null) return null;
  try {
    const v = typeof j.jobtypes === 'string' ? JSON.parse(j.jobtypes) : j.jobtypes;
    if (Array.isArray(v) && v[0] && typeof v[0] === 'object' && v[0] !== null && 'jobtype_definition_id' in v[0]) {
      return (v[0] as { jobtype_definition_id: number }).jobtype_definition_id;
    }
  } catch {}
  return null;
}

/** 요일 인덱스(0=일~6=토) → 요일명. 기준내용 weekly 표시용 */
const WEEKDAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

/** jobtypes JSON에서 작업내용(detail) 추출 */
function workContentFrom(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  try {
    const v = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(v) && v.length > 0) {
      const first = v[0];
      if (typeof first === 'object' && first !== null && 'detail' in first) return String((first as { detail?: string }).detail ?? '—');
    }
    return '—';
  } catch {
    return '—';
  }
}

export default function AdminScheduleWorkPlansPage() {
  const pathname = usePathname();
  const isFarmMode = pathname ? !pathname.startsWith('/admin') : false;
  const [farmId, setFarmId] = useState<string | null>(null);

  useEffect(() => {
    if (!isFarmMode) {
      setFarmId(null);
      return;
    }
    const id = typeof window !== 'undefined' ? localStorage.getItem(FARM_KEY) : null;
    setFarmId(id);
  }, [isFarmMode]);

  // 공용 래퍼: farm 경로면 farm 스코프 API, admin 경로면 전역 API
  const getScheduleSortations = useCallback(
    (structureTemplateId?: number) => {
      if (isFarmMode) return farmId ? getFarmScheduleSortations(farmId, structureTemplateId) : Promise.resolve([]);
      return getScheduleSortationsAdmin(structureTemplateId);
    },
    [isFarmMode, farmId]
  );
  const getScheduleCriterias = useCallback(() => (isFarmMode ? (farmId ? getFarmScheduleCriterias(farmId) : Promise.resolve([])) : getScheduleCriteriasAdmin()), [isFarmMode, farmId]);
  const getScheduleJobtypes = useCallback(() => (isFarmMode ? (farmId ? getFarmScheduleJobtypes(farmId) : Promise.resolve([])) : getScheduleJobtypesAdmin()), [isFarmMode, farmId]);
  const getScheduleWorkPlans = useCallback(() => (isFarmMode ? (farmId ? getFarmScheduleWorkPlansMaster(farmId) : Promise.resolve([])) : getScheduleWorkPlansAdmin()), [isFarmMode, farmId]);

  const getScheduleSortationDefinitions = useCallback(
    () => (isFarmMode ? (farmId ? getFarmScheduleSortationDefinitions(farmId) : Promise.resolve([])) : getScheduleSortationDefinitionsAdmin()),
    [isFarmMode, farmId]
  );
  const createScheduleSortationDefinition = useCallback(
    (body: { name: string; sort_order?: number }) => {
      if (isFarmMode) {
        if (!farmId) throw new Error('선택된 농장이 없습니다.');
        return createFarmScheduleSortationDefinition(farmId, body);
      }
      return createScheduleSortationDefinitionAdmin(body);
    },
    [isFarmMode, farmId]
  );
  const updateScheduleSortationDefinition = useCallback(
    (id: number, body: { name?: string; sort_order?: number }) => {
      if (isFarmMode) {
        if (!farmId) throw new Error('선택된 농장이 없습니다.');
        return updateFarmScheduleSortationDefinition(farmId, id, body);
      }
      return updateScheduleSortationDefinitionAdmin(id, body);
    },
    [isFarmMode, farmId]
  );
  const deleteScheduleSortationDefinition = useCallback(
    (id: number) => {
      if (isFarmMode) {
        if (!farmId) throw new Error('선택된 농장이 없습니다.');
        return deleteFarmScheduleSortationDefinition(farmId, id);
      }
      return deleteScheduleSortationDefinitionAdmin(id);
    },
    [isFarmMode, farmId]
  );

  const getScheduleJobtypeDefinitions = useCallback(
    () => (isFarmMode ? (farmId ? getFarmScheduleJobtypeDefinitions(farmId) : Promise.resolve([])) : getScheduleJobtypeDefinitionsAdmin()),
    [isFarmMode, farmId]
  );
  const createScheduleJobtypeDefinition = useCallback(
    (body: { name: string; sort_order?: number }) => {
      if (isFarmMode) {
        if (!farmId) throw new Error('선택된 농장이 없습니다.');
        return createFarmScheduleJobtypeDefinition(farmId, body);
      }
      return createScheduleJobtypeDefinitionAdmin(body);
    },
    [isFarmMode, farmId]
  );
  const updateScheduleJobtypeDefinition = useCallback(
    (id: number, body: { name?: string; sort_order?: number }) => {
      if (isFarmMode) {
        if (!farmId) throw new Error('선택된 농장이 없습니다.');
        return updateFarmScheduleJobtypeDefinition(farmId, id, body);
      }
      return updateScheduleJobtypeDefinitionAdmin(id, body);
    },
    [isFarmMode, farmId]
  );
  const deleteScheduleJobtypeDefinition = useCallback(
    (id: number) => {
      if (isFarmMode) {
        if (!farmId) throw new Error('선택된 농장이 없습니다.');
        return deleteFarmScheduleJobtypeDefinition(farmId, id);
      }
      return deleteScheduleJobtypeDefinitionAdmin(id);
    },
    [isFarmMode, farmId]
  );

  const getScheduleCriteriaDefinitions = useCallback(
    () => (isFarmMode ? (farmId ? getFarmScheduleCriteriaDefinitions(farmId) : Promise.resolve([])) : getScheduleCriteriaDefinitionsAdmin()),
    [isFarmMode, farmId]
  );
  const createScheduleCriteriaDefinition = useCallback(
    (body: { name: string; content_type: string; sort_order?: number }) =>
      (isFarmMode ? (farmId ? createFarmScheduleCriteriaDefinition(farmId, body) : Promise.reject(new Error('선택된 농장이 없습니다.'))) : createScheduleCriteriaDefinitionAdmin(body)),
    [isFarmMode, farmId]
  );
  const updateScheduleCriteriaDefinition = useCallback(
    (id: number, body: { name?: string; content_type?: string; sort_order?: number }) =>
      (isFarmMode ? (farmId ? updateFarmScheduleCriteriaDefinition(farmId, id, body) : Promise.reject(new Error('선택된 농장이 없습니다.'))) : updateScheduleCriteriaDefinitionAdmin(id, body)),
    [isFarmMode, farmId]
  );
  const deleteScheduleCriteriaDefinition = useCallback(
    (id: number) => {
      if (isFarmMode) {
        if (!farmId) throw new Error('선택된 농장이 없습니다.');
        return deleteFarmScheduleCriteriaDefinition(farmId, id);
      }
      return deleteScheduleCriteriaDefinitionAdmin(id);
    },
    [isFarmMode, farmId]
  );

  const createScheduleSortation = useCallback(
    (body: { structure_template_id: number; sortation_definition_id?: number; sortations?: unknown; sort_order?: number }) =>
      (isFarmMode ? (farmId ? createFarmScheduleSortation(farmId, body) : Promise.reject(new Error('선택된 농장이 없습니다.'))) : createScheduleSortationAdmin(body)),
    [isFarmMode, farmId]
  );
  const updateScheduleSortation = useCallback(
    (id: number, body: { structure_template_id?: number; sortations?: unknown; sort_order?: number }) =>
      (isFarmMode ? (farmId ? updateFarmScheduleSortation(farmId, id, body) : Promise.reject(new Error('선택된 농장이 없습니다.'))) : updateScheduleSortationAdmin(id, body)),
    [isFarmMode, farmId]
  );
  const deleteScheduleSortation = useCallback(
    (id: number) => {
      if (isFarmMode) {
        if (!farmId) throw new Error('선택된 농장이 없습니다.');
        return deleteFarmScheduleSortation(farmId, id);
      }
      return deleteScheduleSortationAdmin(id);
    },
    [isFarmMode, farmId]
  );

  const createScheduleJobtype = useCallback(
    (body: { name?: string; sortation_id: number; jobtype_definition_id?: number; jobtypes?: unknown; sort_order?: number }) =>
      (isFarmMode ? (farmId ? createFarmScheduleJobtype(farmId, body) : Promise.reject(new Error('선택된 농장이 없습니다.'))) : createScheduleJobtypeAdmin(body)),
    [isFarmMode, farmId]
  );
  const updateScheduleJobtype = useCallback(
    (id: number, body: { sortation_id?: number; jobtypes?: unknown; sort_order?: number }) =>
      (isFarmMode ? (farmId ? updateFarmScheduleJobtype(farmId, id, body) : Promise.reject(new Error('선택된 농장이 없습니다.'))) : updateScheduleJobtypeAdmin(id, body)),
    [isFarmMode, farmId]
  );
  const deleteScheduleJobtype = useCallback(
    (id: number) => {
      if (isFarmMode) {
        if (!farmId) throw new Error('선택된 농장이 없습니다.');
        return deleteFarmScheduleJobtype(farmId, id);
      }
      return deleteScheduleJobtypeAdmin(id);
    },
    [isFarmMode, farmId]
  );

  const createScheduleCriteria = useCallback(
    (body: { name?: string; jobtype_id: number; criteria_definition_id?: number; criterias?: unknown; description?: string | null; sort_order?: number }) =>
      (isFarmMode ? (farmId ? createFarmScheduleCriteria(farmId, body) : Promise.reject(new Error('선택된 농장이 없습니다.'))) : createScheduleCriteriaAdmin(body)),
    [isFarmMode, farmId]
  );
  const updateScheduleCriteria = useCallback(
    (id: number, body: { jobtype_id?: number; criterias?: unknown; description?: string | null; sort_order?: number }) =>
      (isFarmMode ? (farmId ? updateFarmScheduleCriteria(farmId, id, body) : Promise.reject(new Error('선택된 농장이 없습니다.'))) : updateScheduleCriteriaAdmin(id, body)),
    [isFarmMode, farmId]
  );
  const deleteScheduleCriteria = useCallback(
    (id: number) => {
      if (isFarmMode) {
        if (!farmId) throw new Error('선택된 농장이 없습니다.');
        return deleteFarmScheduleCriteria(farmId, id);
      }
      return deleteScheduleCriteriaAdmin(id);
    },
    [isFarmMode, farmId]
  );

  const createScheduleWorkPlan = useCallback(
    (body: { structure_template_id: number | null; sortation_id: number | null; jobtype_id: number | null; criteria_id: number | null; criteria_content: CriteriaContent | null; work_content?: string | null }) =>
      (isFarmMode ? (farmId ? createFarmScheduleWorkPlanMaster(farmId, body) : Promise.reject(new Error('선택된 농장이 없습니다.'))) : createScheduleWorkPlanAdmin(body)),
    [isFarmMode, farmId]
  );
  const updateScheduleWorkPlan = useCallback(
    (id: number, body: { structure_template_id?: number | null; sortation_id?: number | null; jobtype_id?: number | null; criteria_id?: number | null; criteria_content?: CriteriaContent | null; work_content?: string | null }) =>
      (isFarmMode ? (farmId ? updateFarmScheduleWorkPlanMaster(farmId, id, body) : Promise.reject(new Error('선택된 농장이 없습니다.'))) : updateScheduleWorkPlanAdmin(id, body)),
    [isFarmMode, farmId]
  );
  const deleteScheduleWorkPlan = useCallback(
    (id: number) => {
      if (isFarmMode) {
        if (!farmId) throw new Error('선택된 농장이 없습니다.');
        return deleteFarmScheduleWorkPlanMaster(farmId, id);
      }
      return deleteScheduleWorkPlanAdmin(id);
    },
    [isFarmMode, farmId]
  );
  const reorderScheduleWorkPlans = useCallback(
    (idOrder: number[]) => (isFarmMode ? (farmId ? reorderFarmScheduleWorkPlansMaster(farmId, idOrder) : Promise.reject(new Error('선택된 농장이 없습니다.'))) : reorderScheduleWorkPlansAdmin(idOrder)),
    [isFarmMode, farmId]
  );

  const [facilities, setFacilities] = useState<StructureTemplate[]>([]);
  const [facilityCategory, setFacilityCategory] = useState<'production' | 'support'>('production');
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);
  const [sortations, setSortations] = useState<ScheduleSortationItem[]>([]);
  const [criterias, setCriterias] = useState<ScheduleCriteriaItem[]>([]);
  const [jobtypes, setJobtypes] = useState<ScheduleJobtypeItem[]>([]);
  const [workPlans, setWorkPlans] = useState<ScheduleWorkPlanItem[]>([]);
  const [workPlansError, setWorkPlansError] = useState<string | null>(null);
  const [workPlansLoading, setWorkPlansLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSortationIndex, setSelectedSortationIndex] = useState<number | null>(null);
  const [selectedCriteriaIndex, setSelectedCriteriaIndex] = useState<number | null>(null);
  const [selectedJobtypeIndex, setSelectedJobtypeIndex] = useState<number | null>(null);
  const [editModal, setEditModal] = useState<{ type: 'sortation' | 'criteria' | 'jobtype'; id: number; label: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editDeleting, setEditDeleting] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ type: 'sortation' | 'criteria' | 'jobtype'; id: number; label: string } | null>(null);
  const [messageModal, setMessageModal] = useState<string | null>(null);
  const [addSortationOpen, setAddSortationOpen] = useState(false);
  const [addSortationName, setAddSortationName] = useState('');
  const [addSortationSaving, setAddSortationSaving] = useState(false);
  const [sortationDefinitions, setSortationDefinitions] = useState<ScheduleSortationDefinitionItem[]>([]);
  const [sortationDefinitionsLoading, setSortationDefinitionsLoading] = useState(false);
  /** 구분 목록 선택 모달: 체크된 정의 id 집합 (확인 시 이 목록으로 시설의 구분 목록 동기화) */
  const [selectedSortationDefIds, setSelectedSortationDefIds] = useState<Set<number>>(new Set());
  const [sortationDefFormName, setSortationDefFormName] = useState('');
  const [sortationDefEditId, setSortationDefEditId] = useState<number | null>(null);
  const [sortationDefSaving, setSortationDefSaving] = useState(false);
  const addSortationInputRef = useRef<HTMLInputElement>(null);
  const addCriteriaInputRef = useRef<HTMLInputElement>(null);
  const [addCriteriaOpen, setAddCriteriaOpen] = useState(false);
  const [addCriteriaName, setAddCriteriaName] = useState('');
  const [addCriteriaSaving, setAddCriteriaSaving] = useState(false);
  const [criteriaDefinitions, setCriteriaDefinitions] = useState<ScheduleCriteriaDefinitionItem[]>([]);
  const [criteriaDefinitionsLoading, setCriteriaDefinitionsLoading] = useState(false);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<number | null>(null);
  /** 기준 목록 선택 모달에서 체크된 기준 정의 id 목록 (확인 시 이 목록으로 jobtype 기준 목록 동기화) */
  const [criteriaModalCheckedDefinitionIds, setCriteriaModalCheckedDefinitionIds] = useState<number[]>([]);
  const [defForm, setDefForm] = useState({ name: '', content_type: 'range' as CriteriaContentType });
  const [defEditId, setDefEditId] = useState<number | null>(null);
  const [defSaving, setDefSaving] = useState(false);
  const addJobtypeInputRef = useRef<HTMLInputElement>(null);
  const [addJobtypeOpen, setAddJobtypeOpen] = useState(false);
  const [addJobtypeName, setAddJobtypeName] = useState('');
  const [addJobtypeSaving, setAddJobtypeSaving] = useState(false);
  const [jobtypeDefinitions, setJobtypeDefinitions] = useState<ScheduleJobtypeDefinitionItem[]>([]);
  const [jobtypeDefinitionsLoading, setJobtypeDefinitionsLoading] = useState(false);
  const [selectedJobtypeDefIds, setSelectedJobtypeDefIds] = useState<Set<number>>(new Set());
  const [jobtypeDefFormName, setJobtypeDefFormName] = useState('');
  const [jobtypeDefEditId, setJobtypeDefEditId] = useState<number | null>(null);
  const [jobtypeDefSaving, setJobtypeDefSaving] = useState(false);
  /** 기준내용: 유형 + 유형별 입력값 (기초 일정 저장용). 시작/종료는 일(1-31)만 사용 */
  const [criteriaContentType, setCriteriaContentType] = useState<CriteriaContentType>('range');
  const [startDay, setStartDay] = useState<number | ''>('');
  const [endDay, setEndDay] = useState<number | ''>('');
  const [criteriaContentInterval, setCriteriaContentInterval] = useState(1);
  const [criteriaContentByWeekday, setCriteriaContentByWeekday] = useState<number[]>([]);
  const [criteriaContentDayOfMonth, setCriteriaContentDayOfMonth] = useState(1);
  const [criteriaContentMonth, setCriteriaContentMonth] = useState(1);
  const [criteriaContentDay, setCriteriaContentDay] = useState(1);
  const [criteriaContentCount, setCriteriaContentCount] = useState<number | ''>(1);
  const [criteriaWorkContent, setCriteriaWorkContent] = useState('');
  const [workPlanSaving, setWorkPlanSaving] = useState(false);
  const [workPlanDeleting, setWorkPlanDeleting] = useState(false);
  /** 목록에서 선택한 작업을 상단 폼에 넣어 수정. id가 있으면 수정 모드 */
  const [editingWorkPlanId, setEditingWorkPlanId] = useState<number | null>(null);
  /** 목록 행 클릭 시 폼에 채울 데이터. 시설/구분/작업유형/기준 인덱스는 연쇄 설정 */
  const [pendingLoadWorkPlan, setPendingLoadWorkPlan] = useState<ScheduleWorkPlanItem | null>(null);
  /** 드래그로 순서 변경: 드래그 중인 행 id, 시작 인덱스, 드롭 대상 인덱스 */
  const [dragPlanId, setDragPlanId] = useState<number | null>(null);
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const didDragRef = useRef(false);
  const workPlansRef = useRef<ScheduleWorkPlanItem[]>([]);
  workPlansRef.current = workPlans ?? [];
  const filteredWorkPlansRef = useRef<ScheduleWorkPlanItem[]>([]);
  /** 작업 목록 필터: 시설 구분(사육/일반)·사육시설·구분·작업유형·기준 */
  const [filterFacilityCategory, setFilterFacilityCategory] = useState<'' | 'production' | 'support'>('');
  const [filterFacilityId, setFilterFacilityId] = useState<number | ''>('');
  const [filterSortationId, setFilterSortationId] = useState<number | ''>('');
  const [filterJobtypeId, setFilterJobtypeId] = useState<number | ''>('');
  const [filterCriteriaId, setFilterCriteriaId] = useState<number | ''>('');
  const [filterSortations, setFilterSortations] = useState<ScheduleSortationItem[]>([]);
  /** 상단 시설 선택 시 하단 작업 목록 필터에 반영 */
  const [filterLinkEnabled, setFilterLinkEnabled] = useState(true);

  useEffect(() => {
    if (dragPlanId == null) return;
    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const tr = el?.closest('tr[data-work-plan-index]');
      if (tr) {
        const idx = parseInt(tr.getAttribute('data-work-plan-index') ?? '-1', 10);
        if (idx >= 0) setDragOverIndex(idx);
      } else {
        setDragOverIndex(null);
      }
    };
    const onUp = async () => {
      const start = dragStartIndex;
      const over = dragOverIndex;
      const fullList = workPlansRef.current;
      const displayList = filterActiveRef.current ? filteredWorkPlansRef.current : fullList;
      setDragPlanId(null);
      setDragStartIndex(null);
      setDragOverIndex(null);
      if (start != null && over != null && start !== over && displayList.length > 0) {
        didDragRef.current = true;
        const reordered = [...displayList];
        const [removed] = reordered.splice(start, 1);
        const insertAt = start < over ? over - 1 : over;
        reordered.splice(insertAt, 0, removed);
        const reorderedIds = reordered.map((x) => x.id);
        const idOrder = filterActiveRef.current
          ? [...reorderedIds, ...fullList.filter((p) => !reorderedIds.includes(p.id)).map((p) => p.id)]
          : reorderedIds;
        try {
          await reorderScheduleWorkPlans(idOrder);
          const data = await getScheduleWorkPlans();
          setWorkPlans(Array.isArray(data) ? data : []);
          setWorkPlansError(null);
        } catch (e) {
          setMessageModal(e instanceof Error ? e.message : '순서 변경 실패');
        }
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragPlanId, dragStartIndex, dragOverIndex]);

  useEffect(() => {
    if (isFarmMode) {
      if (!farmId) {
        setFacilities([]);
        setLoading(false);
        return;
      }
      getFarmStructureProduction(farmId)
        .then((list) => {
          const arr = (Array.isArray(list) ? list : []).map((x, idx) => ({
            id: x.templateId,
            name: x.name,
            category: 'production',
            weight: x.weight,
            optimalDensity: x.optimalDensity,
            description: x.description,
            sortOrder: idx,
          }));
          setFacilities(arr);
        })
        .catch((e) => setError(e instanceof Error ? e.message : '시설 목록 조회 실패'))
        .finally(() => setLoading(false));
      return;
    }

    getStructureTemplates()
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        setFacilities(arr);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '시설 목록 조회 실패'))
      .finally(() => setLoading(false));
  }, [isFarmMode, farmId]);

  const loadChains = useCallback(() => {
    Promise.all([getScheduleCriterias(), getScheduleJobtypes()])
      .then(([critList, jobList]) => {
        setCriterias(Array.isArray(critList) ? critList : []);
        setJobtypes(Array.isArray(jobList) ? jobList : []);
      })
      .catch(() => {});
  }, [getScheduleCriterias, getScheduleJobtypes]);

  useEffect(() => {
    loadChains();
  }, [loadChains]);

  useEffect(() => {
    if (selectedFacilityId == null) {
      setSortations([]);
      setSelectedSortationIndex(null);
      setSelectedCriteriaIndex(null);
      setSelectedJobtypeIndex(null);
      return;
    }
    setListLoading(true);
    setSelectedSortationIndex(null);
    setSelectedCriteriaIndex(null);
    setSelectedJobtypeIndex(null);
    getScheduleSortations(selectedFacilityId)
      .then((arr) => setSortations(Array.isArray(arr) ? arr : []))
      .catch(() => setSortations([]))
      .finally(() => setListLoading(false));
  }, [selectedFacilityId, getScheduleSortations]);

  const loadWorkPlans = useCallback(() => {
    setWorkPlansError(null);
    setWorkPlansLoading(true);
    getScheduleWorkPlans()
      .then((data) => {
        setWorkPlans(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        setWorkPlans([]);
        setWorkPlansError(e instanceof Error ? e.message : '작업 목록 조회 실패');
      })
      .finally(() => setWorkPlansLoading(false));
  }, [getScheduleWorkPlans]);

  useEffect(() => {
    loadWorkPlans();
  }, [loadWorkPlans]);

  /** 필터 시설 변경 시 해당 시설의 구분 목록 로드 */
  useEffect(() => {
    if (filterFacilityId === '') {
      setFilterSortations([]);
      setFilterSortationId('');
      return;
    }
    getScheduleSortations(filterFacilityId)
      .then((arr) => setFilterSortations(Array.isArray(arr) ? arr : []))
      .catch(() => setFilterSortations([]));
    setFilterSortationId('');
    setFilterJobtypeId('');
    setFilterCriteriaId('');
  }, [filterFacilityId, getScheduleSortations]);

  /** 시설 구분(사육/일반) 변경 시 선택된 시설이 해당 구분에 없으면 시설 필터 초기화 */
  useEffect(() => {
    if (filterFacilityCategory === '' || filterFacilityId === '') return;
    const facility = (facilities ?? []).find((f) => f.id === filterFacilityId);
    const match = facility && (filterFacilityCategory === 'production' ? facility.category === 'production' : facility.category === 'support');
    if (!match) {
      setFilterFacilityId('');
    }
  }, [filterFacilityCategory, facilities, filterFacilityId]);

  /** 필터 연동 체크 시: 상단 시설 선택이 바뀌면 하단 작업 목록 필터(시설 구분·시설)에 반영 */
  useEffect(() => {
    if (!filterLinkEnabled) return;
    if (selectedFacilityId == null) {
      setFilterFacilityId('');
      return;
    }
    const fac = (facilities ?? []).find((f) => f.id === selectedFacilityId);
    if (fac?.category === 'production' || fac?.category === 'support') {
      setFilterFacilityCategory(fac.category);
    }
    setFilterFacilityId(selectedFacilityId);
  }, [filterLinkEnabled, selectedFacilityId, facilities]);

  /** 목록에서 선택한 행을 상단 폼에 채우기. 시설 → 구분 → 작업유형 → 기준 순으로 인덱스 설정 후 기준내용/작업내용 적용 */
  useEffect(() => {
    const p = pendingLoadWorkPlan;
    if (!p || selectedFacilityId === null || p.structureTemplateId !== selectedFacilityId) return;

    const facilitySortations = (sortations ?? []).filter((s) => s.structure_template_id === selectedFacilityId);
    const sortationIdx = facilitySortations.findIndex((s) => (s as { sortation_definition_id?: number }).sortation_definition_id === p.sortationId);
    if (sortationIdx >= 0 && selectedSortationIndex !== sortationIdx) {
      setSelectedSortationIndex(sortationIdx);
      return;
    }
    if (sortationIdx < 0) return;

    const selectedSortationId = facilitySortations[sortationIdx]?.id ?? null;
    if (selectedSortationId === null) return;
    const jobtypeList = (jobtypes ?? []).filter((j) => j.sortation_id === selectedSortationId);
    const jobtypeIdx = jobtypeList.findIndex((j) => (j as { jobtype_definition_id?: number }).jobtype_definition_id === p.jobtypeId);
    if (jobtypeIdx >= 0 && selectedJobtypeIndex !== jobtypeIdx) {
      setSelectedJobtypeIndex(jobtypeIdx);
      return;
    }
    if (jobtypeIdx < 0) return;

    const selectedJobtypeId = jobtypeList[jobtypeIdx]?.id ?? null;
    if (selectedJobtypeId === null) return;
    const criteriaList = (criterias ?? []).filter((c) => c.jobtype_id === selectedJobtypeId);
    const criteriaIdx = criteriaList.findIndex((c) => (c as { criteria_definition_id?: number }).criteria_definition_id === p.criteriaId);
    if (criteriaIdx >= 0 && selectedCriteriaIndex !== criteriaIdx) {
      setSelectedCriteriaIndex(criteriaIdx);
      return;
    }
    if (criteriaIdx < 0) return;

    const cc = p.criteriaContent as { type?: string; start_day?: number; end_day?: number; interval?: number; by_weekday?: number[]; day_of_month?: number; month?: number; day?: number; count?: number } | null | undefined;
    if (cc?.type) {
      setCriteriaContentType(cc.type as CriteriaContentType);
      if (cc.start_day != null) setStartDay(cc.start_day);
      else setStartDay('');
      if (cc.end_day != null) setEndDay(cc.end_day);
      else setEndDay('');
      if (cc.interval != null) setCriteriaContentInterval(cc.interval);
      if (Array.isArray(cc.by_weekday)) setCriteriaContentByWeekday(cc.by_weekday);
      if (cc.day_of_month != null) setCriteriaContentDayOfMonth(cc.day_of_month);
      if (cc.month != null) setCriteriaContentMonth(cc.month);
      if (cc.day != null) setCriteriaContentDay(cc.day);
      if (cc.type === 'count') setCriteriaContentCount(cc.count != null ? cc.count : 1);
    }
    setCriteriaWorkContent(typeof p.workContent === 'string' ? p.workContent : '');
    setEditingWorkPlanId(p.id);
    setPendingLoadWorkPlan(null);
  }, [pendingLoadWorkPlan, selectedFacilityId, selectedSortationIndex, selectedJobtypeIndex, selectedCriteriaIndex, sortations, jobtypes, criterias]);

  /** 기준내용 객체 생성 (기초 일정 저장용). 시작일·종료일은 일(1-31) 숫자로 저장. 유형은 선택된 기준의 content_type(effectiveContentType) 사용 */
  const buildCriteriaContent = (type: CriteriaContentType): CriteriaContent | null => {
    const startNum = startDay === '' ? undefined : (typeof startDay === 'number' ? startDay : undefined);
    const endNum = endDay === '' ? undefined : (typeof endDay === 'number' ? endDay : undefined);
    switch (type) {
      case 'range':
        return { type: 'range', start_day: startNum, end_day: endNum };
      case 'daily':
        return { type: 'daily' };
      case 'weekly':
        return { type: 'weekly', interval: criteriaContentInterval, by_weekday: criteriaContentByWeekday.length ? criteriaContentByWeekday : undefined };
      case 'weekend':
        return { type: 'weekend', start_day: startNum, end_day: endNum };
      case 'monthly':
        return { type: 'monthly', day_of_month: criteriaContentDayOfMonth };
      case 'yearly':
        return { type: 'yearly', month: criteriaContentMonth, day: criteriaContentDay };
      case 'count': {
        const countNum = criteriaContentCount === '' ? undefined : (typeof criteriaContentCount === 'number' ? criteriaContentCount : undefined);
        return { type: 'count', count: countNum };
      }
      default:
        return null;
    }
  };

  const toggleWeekday = (d: number) => {
    setCriteriaContentByWeekday((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  };

  /** 기준내용·작업내용 입력 초기화 (다른 작업 추가 시 이전 값이 남지 않도록) */
  const resetCriteriaAndWorkContent = () => {
    setCriteriaContentType('range');
    setStartDay('');
    setEndDay('');
    setCriteriaContentInterval(1);
    setCriteriaContentByWeekday([]);
    setCriteriaContentDayOfMonth(1);
    setCriteriaContentMonth(1);
    setCriteriaContentDay(1);
    setCriteriaContentCount(1);
    setCriteriaWorkContent('');
  };

  const saveWorkPlan = async () => {
    if (selectedFacilityId == null || selectedSortationIndex === null || selectedJobtypeIndex === null || selectedCriteriaIndex === null) {
      setMessageModal('시설·구분·작업유형·기준을 모두 선택하세요.');
      return;
    }
    const sortationDefId = sortationRows[selectedSortationIndex]?.sortationDefinitionId ?? null;
    const jobtypeDefId = jobtypeRows[selectedJobtypeIndex]?.jobtypeDefinitionId ?? null;
    const criteriaDefId = criteriaRows[selectedCriteriaIndex]?.criteriaDefinitionId ?? null;
    if (sortationDefId == null || jobtypeDefId == null || criteriaDefId == null) {
      setMessageModal('선택한 구분·작업유형·기준에 정의 id가 없습니다. 목록 선택에서 정의를 사용한 항목을 선택해 주세요.');
      return;
    }
    if (!criteriaWorkContent?.trim()) {
      setMessageModal('작업내용을 입력하세요.');
      return;
    }
    const content = buildCriteriaContent(effectiveContentType);
    setWorkPlanSaving(true);
    try {
      if (editingWorkPlanId != null) {
        await updateScheduleWorkPlan(editingWorkPlanId, {
          structure_template_id: selectedFacilityId,
          sortation_id: sortationDefId,
          jobtype_id: jobtypeDefId,
          criteria_id: criteriaDefId,
          criteria_content: content,
          work_content: criteriaWorkContent.trim() || null,
        });
        setEditingWorkPlanId(null);
        setPendingLoadWorkPlan(null);
        resetCriteriaAndWorkContent();
        setSelectedFacilityId(null);
        setSelectedSortationIndex(null);
        setSelectedJobtypeIndex(null);
        setSelectedCriteriaIndex(null);
        setFilterFacilityCategory('');
        setFilterFacilityId('');
        setFilterSortationId('');
        setFilterJobtypeId('');
        setFilterCriteriaId('');
        setFilterSortations([]);
        const data = await getScheduleWorkPlans();
        setWorkPlans(Array.isArray(data) ? data : []);
        setWorkPlansError(null);
        setMessageModal('기초 일정이 수정되었습니다.');
      } else {
        await createScheduleWorkPlan({
          structure_template_id: selectedFacilityId,
          sortation_id: sortationDefId,
          jobtype_id: jobtypeDefId,
          criteria_id: criteriaDefId,
          criteria_content: content,
          work_content: criteriaWorkContent.trim() || null,
        });
        const data = await getScheduleWorkPlans();
        setWorkPlans(Array.isArray(data) ? data : []);
        setWorkPlansError(null);
        resetCriteriaAndWorkContent();
        setSelectedFacilityId(null);
        setEditingWorkPlanId(null);
        setPendingLoadWorkPlan(null);
        setFilterFacilityCategory('');
        setFilterFacilityId('');
        setFilterSortationId('');
        setFilterJobtypeId('');
        setFilterCriteriaId('');
        setFilterSortations([]);
        setMessageModal('기초 일정이 추가되었습니다.');
      }
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : editingWorkPlanId != null ? '기초 일정 수정 실패' : '기초 일정 추가 실패');
    } finally {
      setWorkPlanSaving(false);
    }
  };

  /** 작업 목록에서 행 선택 시 상단 입력 폼에 채우기 (같은 폼으로 수정 가능) */
  const loadWorkPlanIntoForm = (item: ScheduleWorkPlanItem) => {
    const fac = facilities.find((f) => f.id === item.structureTemplateId);
    if (fac?.category === 'production' || fac?.category === 'support') setFacilityCategory(fac.category);
    setSelectedFacilityId(item.structureTemplateId ?? null);
    setPendingLoadWorkPlan(item);
  };

  /** 목록에서 선택한 기초 일정 삭제 */
  const deleteWorkPlan = async () => {
    if (editingWorkPlanId == null) return;
    if (!window.confirm('선택한 기초 일정을 삭제하시겠습니까? 삭제된 항목은 복구할 수 없습니다.')) return;
    setWorkPlanDeleting(true);
    try {
      await deleteScheduleWorkPlan(editingWorkPlanId);
      setEditingWorkPlanId(null);
      setPendingLoadWorkPlan(null);
      setSelectedFacilityId(null);
      resetCriteriaAndWorkContent();
      const data = await getScheduleWorkPlans();
      setWorkPlans(Array.isArray(data) ? data : []);
      setWorkPlansError(null);
      setMessageModal('기초 일정이 삭제되었습니다.');
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '기초 일정 삭제 실패');
    } finally {
      setWorkPlanDeleting(false);
    }
  };

  /** 구분 목록 선택 모달 열리면 정의 목록 로드 + 현재 시설 구분 목록으로 체크 초기화 */
  useEffect(() => {
    if (addSortationOpen) {
      setSortationDefinitionsLoading(true);
      getScheduleSortationDefinitions()
        .then((defs) => {
          setSortationDefinitions(defs);
          const currentIds = (sortations ?? [])
            .filter((s) => s.structure_template_id === selectedFacilityId)
            .map((s) => getSortationDefId(s))
            .filter((id): id is number => id != null);
          setSelectedSortationDefIds(new Set(currentIds));
        })
        .catch(() => setSortationDefinitions([]))
        .finally(() => setSortationDefinitionsLoading(false));
      setSortationDefFormName('');
      setSortationDefEditId(null);
    }
  }, [addSortationOpen, sortations, selectedFacilityId]);

  /** 기준 목록 선택 모달 열리면 정의 목록 로드 + 현재 해당 작업유형에 선택된 기준 정의 id를 체크 상태로 설정 */
  useEffect(() => {
    if (addCriteriaOpen) {
      setCriteriaDefinitionsLoading(true);
      getScheduleCriteriaDefinitions()
        .then(setCriteriaDefinitions)
        .catch(() => setCriteriaDefinitions([]))
        .finally(() => setCriteriaDefinitionsLoading(false));
      setSelectedDefinitionId(null);
      setDefForm({ name: '', content_type: 'range' });
      setDefEditId(null);
      const sortationRowsForModal = (sortations ?? []).filter((s) => s.structure_template_id === selectedFacilityId);
      const sortationId = selectedSortationIndex != null && sortationRowsForModal[selectedSortationIndex] ? sortationRowsForModal[selectedSortationIndex].id : null;
      const jobtypeListForModal = sortationId != null ? (jobtypes ?? []).filter((j) => j.sortation_id === sortationId) : [];
      const jobtypeId = selectedJobtypeIndex != null && jobtypeListForModal[selectedJobtypeIndex] ? jobtypeListForModal[selectedJobtypeIndex].id : null;
      const currentDefIds = jobtypeId != null ? (criterias ?? []).filter((c) => c.jobtype_id === jobtypeId).map((c) => c.criteria_definition_id).filter((id): id is number => id != null) : [];
      setCriteriaModalCheckedDefinitionIds(currentDefIds);
    }
  }, [addCriteriaOpen, selectedFacilityId, selectedSortationIndex, selectedJobtypeIndex, sortations, jobtypes, criterias]);

  const facilitiesByCategory = (facilities ?? []).filter((f) => f.category === facilityCategory);
  const categoryLabel = facilityCategory === 'production' ? '사육시설' : '일반시설';

  const safeSortations = sortations ?? [];
  const safeCriterias = criterias ?? [];
  const safeJobtypes = jobtypes ?? [];

  /** 구분 컬럼용: 선택한 시설(단일)의 구분만 (sort_order 포함) */
  const sortationRows: { facilityName: string; facilityId: number; sortationId: number; sortationDefinitionId: number | null; sortationLabel: string; sortOrder: number }[] = [];
  if (selectedFacilityId != null) {
    const fac = facilities.find((f) => f.id === selectedFacilityId);
    const facilityName = fac?.name ?? '—';
    for (const s of safeSortations) {
      if (s.structure_template_id !== selectedFacilityId) continue;
      sortationRows.push({
        facilityName,
        facilityId: selectedFacilityId,
        sortationId: s.id,
        sortationDefinitionId: s.sortation_definition_id ?? null,
        sortationLabel: s.sortation_name ?? (labelFrom(s.sortations) || '—'),
        sortOrder: s.sort_order ?? 0,
      });
    }
  }

  /** 목록 한 줄 스타일 통일 (폰트·여백) */
  const listItemStyle = { fontSize: 14, padding: '8px 0', display: 'flex' as const, alignItems: 'center' as const, gap: 8, cursor: 'pointer' as const };
  const listItemMinHeight = 40;

  /** 선택된 구분 id */
  const selectedSortationId = selectedSortationIndex !== null && sortationRows[selectedSortationIndex] ? sortationRows[selectedSortationIndex].sortationId : null;

  /** 작업유형 컬럼용: 구분을 선택했을 때만 해당 구분의 작업유형 목록 (구분 → 작업유형). jobtypeDefinitionId: 정의 테이블 id (기초 일정 저장 시 사용) */
  const jobtypeRows: { id: number; jobtypeDefinitionId: number | null; jobtypeLabel: string; workContent: string; sortOrder: number }[] = selectedSortationId !== null
    ? safeJobtypes
        .filter((j) => j.sortation_id === selectedSortationId)
        .map((j) => ({ id: j.id, jobtypeDefinitionId: j.jobtype_definition_id ?? null, jobtypeLabel: j.jobtype_name ?? (labelFrom(j.jobtypes) || '—'), workContent: workContentFrom(j.jobtypes), sortOrder: j.sort_order ?? 0 }))
    : [];

  /** 선택된 작업유형 id */
  const selectedJobtypeId = selectedJobtypeIndex !== null && jobtypeRows[selectedJobtypeIndex] ? jobtypeRows[selectedJobtypeIndex].id : null;

  /** 작업유형 목록 선택 모달 열리면 정의 목록 로드 + 현재 구분의 작업유형 목록으로 체크 초기화 */
  useEffect(() => {
    if (addJobtypeOpen) {
      setJobtypeDefinitionsLoading(true);
      getScheduleJobtypeDefinitions()
        .then((defs) => {
          setJobtypeDefinitions(defs);
          const currentIds = (jobtypes ?? [])
            .filter((j) => j.sortation_id === selectedSortationId)
            .map((j) => getJobtypeDefId(j))
            .filter((id): id is number => id != null);
          setSelectedJobtypeDefIds(new Set(currentIds));
        })
        .catch(() => setJobtypeDefinitions([]))
        .finally(() => setJobtypeDefinitionsLoading(false));
      setJobtypeDefFormName('');
      setJobtypeDefEditId(null);
    }
  }, [addJobtypeOpen, jobtypes, selectedSortationId]);

  /** 기준 컬럼용: 작업유형을 선택했을 때만 해당 작업유형의 기준 목록 (작업유형 → 기준). criteriaDefinitionId: 정의 테이블 id (기초 일정 저장 시 사용) */
  const criteriaRows: { id: number; criteriaDefinitionId: number | null; criteriaLabel: string; startDate: string; endDate: string; sortOrder: number; content_type?: string | null }[] = selectedJobtypeId !== null
    ? safeCriterias
        .filter((c) => c.jobtype_id === selectedJobtypeId)
        .map((c) => {
          const dates = criteriaDatesFrom(c.criterias);
          return {
            id: c.id,
            criteriaDefinitionId: c.criteria_definition_id ?? null,
            criteriaLabel: c.criteria_name ?? (labelFrom(c.criterias) || c.description || '—'),
            startDate: dates.startDate,
            endDate: dates.endDate,
            sortOrder: c.sort_order ?? 0,
            content_type: c.content_type ?? null,
          };
        })
    : [];

  /** 기준 선택 시 해당 기준의 content_type으로 기준내용 유형 동기화(유형 셀렉트 제거됨). 편집 중 로드(pendingLoadWorkPlan) 시에는 그 효과에서 값을 채움 */
  const selectedCriteriaRow = selectedCriteriaIndex != null ? criteriaRows[selectedCriteriaIndex] : null;
  const effectiveContentType: CriteriaContentType = (selectedCriteriaRow?.content_type && ['range', 'daily', 'weekly', 'weekend', 'monthly', 'yearly', 'count'].includes(selectedCriteriaRow.content_type))
    ? (selectedCriteriaRow.content_type as CriteriaContentType)
    : 'range';

  /** 작업 목록 필터 옵션: 시설은 시설 구분(사육/일반) 선택 시 해당 카테고리만, 구분은 필터 시설 선택 시 filterSortations */
  const filterFacilityOptions = (facilities ?? []).filter(
    (f) => filterFacilityCategory === '' || f.category === filterFacilityCategory
  );
  const filterJobtypeOptions = filterSortationId === '' ? [] : (jobtypes ?? []).filter((j) => (sortations ?? []).some((s) => s.id === j.sortation_id && (s as ScheduleSortationItem).sortation_definition_id === filterSortationId));
  const filterCriteriaOptions = filterJobtypeId === '' ? [] : (criterias ?? []).filter((c) => (jobtypes ?? []).some((j) => j.id === c.jobtype_id && (j as ScheduleJobtypeItem).jobtype_definition_id === filterJobtypeId));
  /** 필터 적용된 작업 목록 (sortationId/jobtypeId/criteriaId 는 정의 id) */
  const filteredWorkPlans = (workPlans ?? []).filter((p) => {
    if (filterFacilityId !== '' && p.structureTemplateId !== filterFacilityId) return false;
    if (filterSortationId !== '' && p.sortationId !== filterSortationId) return false;
    if (filterJobtypeId !== '' && p.jobtypeId !== filterJobtypeId) return false;
    if (filterCriteriaId !== '' && p.criteriaId !== filterCriteriaId) return false;
    return true;
  });
  filteredWorkPlansRef.current = filteredWorkPlans;
  const filterActiveRef = useRef(false);
  filterActiveRef.current = filterFacilityId !== '' || filterSortationId !== '' || filterJobtypeId !== '' || filterCriteriaId !== '';

  if (loading) return <div>로딩 중...</div>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;

  const onCategoryChange = (cat: 'production' | 'support') => {
    setFacilityCategory(cat);
    setSelectedFacilityId(null);
    resetCriteriaAndWorkContent();
  };

  const selectFacility = (id: number) => {
    setEditingWorkPlanId(null);
    setPendingLoadWorkPlan(null);
    setSelectedFacilityId((prev) => (prev === id ? null : id));
    resetCriteriaAndWorkContent();
  };
  const clearFacility = () => {
    setSelectedFacilityId(null);
    setEditingWorkPlanId(null);
    setPendingLoadWorkPlan(null);
    resetCriteriaAndWorkContent();
  };
  const clearSortation = () => {
    setSelectedSortationIndex(null);
    setSelectedCriteriaIndex(null);
    setSelectedJobtypeIndex(null);
  };
  const clearCriteria = () => setSelectedCriteriaIndex(null);
  const clearJobtype = () => {
    setSelectedJobtypeIndex(null);
    setSelectedCriteriaIndex(null);
  };

  /** 구분 순서: 위로 (같은 sort_order여도 서로 다른 값으로 넣어서 순서 반영) */
  const moveSortationUp = async (idx: number) => {
    if (idx <= 0 || !sortationRows[idx] || !sortationRows[idx - 1]) return;
    const current = sortationRows[idx];
    const prev = sortationRows[idx - 1];
    try {
      await Promise.all([
        updateScheduleSortation(current.sortationId, { sort_order: prev.sortOrder - 1 }),
        updateScheduleSortation(prev.sortationId, { sort_order: current.sortOrder }),
      ]);
      if (selectedFacilityId != null) {
        const arr = await getScheduleSortations(selectedFacilityId);
        setSortations(Array.isArray(arr) ? arr : []);
      }
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '순서 변경 실패');
    }
  };

  /** 구분 순서: 아래로 */
  const moveSortationDown = async (idx: number) => {
    if (idx < 0 || idx >= sortationRows.length - 1 || !sortationRows[idx] || !sortationRows[idx + 1]) return;
    const current = sortationRows[idx];
    const next = sortationRows[idx + 1];
    try {
      await Promise.all([
        updateScheduleSortation(current.sortationId, { sort_order: next.sortOrder + 1 }),
        updateScheduleSortation(next.sortationId, { sort_order: current.sortOrder }),
      ]);
      if (selectedFacilityId != null) {
        const arr = await getScheduleSortations(selectedFacilityId);
        setSortations(Array.isArray(arr) ? arr : []);
      }
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '순서 변경 실패');
    }
  };

  /** 기준 순서: 위로 */
  const moveCriteriaUp = async (idx: number) => {
    if (idx <= 0 || !criteriaRows[idx] || !criteriaRows[idx - 1]) return;
    const current = criteriaRows[idx];
    const prev = criteriaRows[idx - 1];
    try {
      await Promise.all([
        updateScheduleCriteria(current.id, { sort_order: prev.sortOrder - 1 }),
        updateScheduleCriteria(prev.id, { sort_order: current.sortOrder }),
      ]);
      loadChains();
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '순서 변경 실패');
    }
  };

  /** 기준 순서: 아래로 */
  const moveCriteriaDown = async (idx: number) => {
    if (idx < 0 || idx >= criteriaRows.length - 1 || !criteriaRows[idx] || !criteriaRows[idx + 1]) return;
    const current = criteriaRows[idx];
    const next = criteriaRows[idx + 1];
    try {
      await Promise.all([
        updateScheduleCriteria(current.id, { sort_order: next.sortOrder + 1 }),
        updateScheduleCriteria(next.id, { sort_order: current.sortOrder }),
      ]);
      loadChains();
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '순서 변경 실패');
    }
  };

  /** 작업유형 순서: 위로 */
  const moveJobtypeUp = async (idx: number) => {
    if (idx <= 0 || !jobtypeRows[idx] || !jobtypeRows[idx - 1]) return;
    const current = jobtypeRows[idx];
    const prev = jobtypeRows[idx - 1];
    try {
      await Promise.all([
        updateScheduleJobtype(current.id, { sort_order: prev.sortOrder - 1 }),
        updateScheduleJobtype(prev.id, { sort_order: current.sortOrder }),
      ]);
      loadChains();
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '순서 변경 실패');
    }
  };

  /** 작업유형 순서: 아래로 */
  const moveJobtypeDown = async (idx: number) => {
    if (idx < 0 || idx >= jobtypeRows.length - 1 || !jobtypeRows[idx] || !jobtypeRows[idx + 1]) return;
    const current = jobtypeRows[idx];
    const next = jobtypeRows[idx + 1];
    try {
      await Promise.all([
        updateScheduleJobtype(current.id, { sort_order: next.sortOrder + 1 }),
        updateScheduleJobtype(next.id, { sort_order: current.sortOrder }),
      ]);
      loadChains();
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '순서 변경 실패');
    }
  };

  const openEditModal = (type: 'sortation' | 'criteria' | 'jobtype', id: number, label: string) => {
    setEditModal({ type, id, label });
    setEditValue(label);
  };

  const closeEditModal = () => {
    setEditModal(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editModal) return;
    setEditSaving(true);
    try {
      if (editModal.type === 'criteria') {
        await updateScheduleCriteria(editModal.id, { criterias: [{ name: editValue }] });
      }
      loadChains();
      if (selectedFacilityId != null) {
        getScheduleSortations(selectedFacilityId).then((arr) => setSortations(Array.isArray(arr) ? arr : []));
      }
      closeEditModal();
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '수정 실패');
    } finally {
      setEditSaving(false);
    }
  };

  const openDeleteConfirm = () => {
    if (editModal) setDeleteConfirmModal(editModal);
  };

  const closeDeleteConfirmModal = () => {
    if (!editDeleting) setDeleteConfirmModal(null);
  };

  const executeDelete = async () => {
    const target = deleteConfirmModal;
    if (!target) return;
    setEditDeleting(true);
    try {
      if (target.type === 'sortation') {
        await deleteScheduleSortation(target.id);
        if (sortationRows[selectedSortationIndex ?? -1]?.sortationId === target.id) {
          setSelectedSortationIndex(null);
          setSelectedJobtypeIndex(null);
          setSelectedCriteriaIndex(null);
        }
      } else if (target.type === 'criteria') {
        await deleteScheduleCriteria(target.id);
        if (criteriaRows[selectedCriteriaIndex ?? -1]?.id === target.id) {
          setSelectedCriteriaIndex(null);
        }
      } else {
        await deleteScheduleJobtype(target.id);
        if (jobtypeRows[selectedJobtypeIndex ?? -1]?.id === target.id) {
          setSelectedJobtypeIndex(null);
          setSelectedCriteriaIndex(null);
        }
      }
      loadChains();
      if (selectedFacilityId != null) {
        getScheduleSortations(selectedFacilityId).then((arr) => setSortations(Array.isArray(arr) ? arr : []));
      }
      setDeleteConfirmModal(null);
      closeEditModal();
      setMessageModal('삭제되었습니다.');
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setEditDeleting(false);
    }
  };

  const handleAddSortation = () => {
    if (selectedFacilityId == null) {
      setMessageModal('시설을 선택하세요.');
      return;
    }
    setAddSortationName('');
    setAddSortationOpen(true);
  };

  const closeAddSortationModal = () => {
    if (!addSortationSaving && !sortationDefSaving) {
      setAddSortationOpen(false);
      setAddSortationName('');
      setSortationDefEditId(null);
    }
  };

  const saveSortationDefForm = async () => {
    const name = sortationDefFormName.trim();
    if (!name) {
      setMessageModal('구분 정의 이름을 입력하세요.');
      return;
    }
    setSortationDefSaving(true);
    try {
      if (sortationDefEditId != null) {
        await updateScheduleSortationDefinition(sortationDefEditId, { name });
        setSortationDefinitions((prev) => prev.map((d) => (d.id === sortationDefEditId ? { ...d, name } : d)));
        setSortationDefEditId(null);
      } else {
        const nextSortOrder = sortationDefinitions.length === 0
          ? 0
          : Math.max(...sortationDefinitions.map((d) => d.sort_order), 0) + 1;
        const res = await createScheduleSortationDefinition({ name, sort_order: nextSortOrder });
        setSortationDefinitions((prev) => [...prev, { id: res.id, name, sort_order: nextSortOrder }]);
      }
      setSortationDefFormName('');
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSortationDefSaving(false);
    }
  };

  const deleteSortationDef = async (id: number) => {
    try {
      await deleteScheduleSortationDefinition(id);
      setSortationDefinitions((prev) => prev.filter((d) => d.id !== id));
      setSelectedSortationDefIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      if (sortationDefEditId === id) setSortationDefEditId(null);
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  /** 구분 목록 선택 모달 확인: 체크된 정의로 시설 구분 목록 동기화 */
  const confirmSortationSelection = async () => {
    if (selectedFacilityId == null) {
      setMessageModal('시설을 선택하세요.');
      return;
    }
    setAddSortationSaving(true);
    try {
      const newOrder = sortationDefinitions.filter((d) => selectedSortationDefIds.has(d.id)).map((d) => d.id);
      const facilitySortations = (sortations ?? []).filter((s) => s.structure_template_id === selectedFacilityId);
      const currentRows: { id: number; defId: number | null }[] = facilitySortations.map((s) => ({ id: s.id, defId: getSortationDefId(s) }));

      for (const row of currentRows) {
        if (row.defId == null || !newOrder.includes(row.defId)) await deleteScheduleSortation(row.id);
      }
      const currentWithDef = currentRows.filter((r): r is { id: number; defId: number } => r.defId != null);
      for (let i = 0; i < newOrder.length; i++) {
        const defId = newOrder[i];
        const existing = currentWithDef.find((r) => r.defId === defId);
        if (existing) {
          await updateScheduleSortation(existing.id, { sort_order: i });
        } else {
          await createScheduleSortation({ structure_template_id: selectedFacilityId, sortation_definition_id: defId, sort_order: i });
        }
      }
      loadChains();
      if (selectedFacilityId != null) {
        getScheduleSortations(selectedFacilityId).then((arr) => setSortations(Array.isArray(arr) ? arr : []));
      }
      closeAddSortationModal();
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '구분 목록 적용 실패');
    } finally {
      setAddSortationSaving(false);
    }
  };

  /** 구분 정의 목록 순서: 위로 */
  const moveSortationDefUp = async (idx: number) => {
    if (idx <= 0 || !sortationDefinitions[idx] || !sortationDefinitions[idx - 1]) return;
    const current = sortationDefinitions[idx];
    const prev = sortationDefinitions[idx - 1];
    try {
      await Promise.all([
        updateScheduleSortationDefinition(current.id, { sort_order: prev.sort_order }),
        updateScheduleSortationDefinition(prev.id, { sort_order: current.sort_order }),
      ]);
      const next = await getScheduleSortationDefinitions();
      setSortationDefinitions(next);
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '순서 변경 실패');
    }
  };

  /** 구분 정의 목록 순서: 아래로 */
  const moveSortationDefDown = async (idx: number) => {
    if (idx < 0 || idx >= sortationDefinitions.length - 1 || !sortationDefinitions[idx] || !sortationDefinitions[idx + 1]) return;
    const current = sortationDefinitions[idx];
    const next = sortationDefinitions[idx + 1];
    try {
      await Promise.all([
        updateScheduleSortationDefinition(current.id, { sort_order: next.sort_order }),
        updateScheduleSortationDefinition(next.id, { sort_order: current.sort_order }),
      ]);
      const list = await getScheduleSortationDefinitions();
      setSortationDefinitions(list);
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '순서 변경 실패');
    }
  };

  /** 작업유형 목록 선택 모달 확인: 체크된 정의로 구분의 작업유형 목록 동기화 */
  const confirmJobtypeSelection = async () => {
    if (selectedSortationId == null) {
      setMessageModal('구분을 선택하세요.');
      return;
    }
    setAddJobtypeSaving(true);
    try {
      const newOrder = jobtypeDefinitions.filter((d) => selectedJobtypeDefIds.has(d.id)).map((d) => d.id);
      const sortationJobtypes = (jobtypes ?? []).filter((j) => j.sortation_id === selectedSortationId);
      const currentRows: { id: number; defId: number | null }[] = sortationJobtypes.map((j) => ({ id: j.id, defId: getJobtypeDefId(j) }));

      for (const row of currentRows) {
        if (row.defId == null || !newOrder.includes(row.defId)) await deleteScheduleJobtype(row.id);
      }
      const currentWithDef = currentRows.filter((r): r is { id: number; defId: number } => r.defId != null);
      for (let i = 0; i < newOrder.length; i++) {
        const defId = newOrder[i];
        const existing = currentWithDef.find((r) => r.defId === defId);
        if (existing) {
          await updateScheduleJobtype(existing.id, { sort_order: i });
        } else {
          await createScheduleJobtype({ sortation_id: selectedSortationId, jobtype_definition_id: defId, sort_order: i });
        }
      }
      loadChains();
      closeAddJobtypeModal();
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '작업유형 목록 적용 실패');
    } finally {
      setAddJobtypeSaving(false);
    }
  };

  /** 작업유형 정의 목록 순서: 위로 */
  const moveJobtypeDefUp = async (idx: number) => {
    if (idx <= 0 || !jobtypeDefinitions[idx] || !jobtypeDefinitions[idx - 1]) return;
    const current = jobtypeDefinitions[idx];
    const prev = jobtypeDefinitions[idx - 1];
    try {
      await Promise.all([
        updateScheduleJobtypeDefinition(current.id, { sort_order: prev.sort_order }),
        updateScheduleJobtypeDefinition(prev.id, { sort_order: current.sort_order }),
      ]);
      const next = await getScheduleJobtypeDefinitions();
      setJobtypeDefinitions(next);
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '순서 변경 실패');
    }
  };

  /** 작업유형 정의 목록 순서: 아래로 */
  const moveJobtypeDefDown = async (idx: number) => {
    if (idx < 0 || idx >= jobtypeDefinitions.length - 1 || !jobtypeDefinitions[idx] || !jobtypeDefinitions[idx + 1]) return;
    const current = jobtypeDefinitions[idx];
    const next = jobtypeDefinitions[idx + 1];
    try {
      await Promise.all([
        updateScheduleJobtypeDefinition(current.id, { sort_order: next.sort_order }),
        updateScheduleJobtypeDefinition(next.id, { sort_order: current.sort_order }),
      ]);
      const list = await getScheduleJobtypeDefinitions();
      setJobtypeDefinitions(list);
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '순서 변경 실패');
    }
  };

  const saveJobtypeDefForm = async () => {
    const name = jobtypeDefFormName.trim();
    if (!name) {
      setMessageModal('작업유형 정의 이름을 입력하세요.');
      return;
    }
    setJobtypeDefSaving(true);
    try {
      if (jobtypeDefEditId != null) {
        await updateScheduleJobtypeDefinition(jobtypeDefEditId, { name });
        setJobtypeDefinitions((prev) =>
          prev.map((d) => (d.id === jobtypeDefEditId ? { ...d, name } : d))
        );
        setJobtypeDefEditId(null);
      } else {
        const res = await createScheduleJobtypeDefinition({ name });
        const newDef: ScheduleJobtypeDefinitionItem = { id: res.id, name, sort_order: 0 };
        setJobtypeDefinitions((prev) => [...prev, newDef]);
      }
      setJobtypeDefFormName('');
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setJobtypeDefSaving(false);
    }
  };

  const deleteJobtypeDef = async (id: number) => {
    try {
      await deleteScheduleJobtypeDefinition(id);
      setJobtypeDefinitions((prev) => prev.filter((d) => d.id !== id));
      setSelectedJobtypeDefIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      if (jobtypeDefEditId === id) setJobtypeDefEditId(null);
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  const handleAddCriteria = () => {
    if (selectedFacilityId == null) {
      setMessageModal('시설을 선택하세요.');
      return;
    }
    if (selectedSortationIndex === null) {
      setMessageModal('구분을 선택하세요.');
      return;
    }
    if (selectedJobtypeIndex === null || !jobtypeRows[selectedJobtypeIndex]) {
      setMessageModal('작업유형을 선택하세요.');
      return;
    }
    setAddCriteriaName('');
    setAddCriteriaOpen(true);
  };

  const closeAddCriteriaModal = () => {
    if (!addCriteriaSaving && !defSaving) {
      setAddCriteriaOpen(false);
      setAddCriteriaName('');
      setDefEditId(null);
    }
  };

  const contentTypeOptions: { value: CriteriaContentType; label: string }[] = [
    { value: 'range', label: '시작일 ~ 종료일' },
    { value: 'count', label: '횟수' },
    { value: 'daily', label: '매일' },
    { value: 'weekend', label: '주말' },
    { value: 'monthly', label: '월 단위' },
    { value: 'yearly', label: '년 1회' },
    { value: 'weekly', label: 'N주마다 요일' },
  ];

  const saveDefForm = async () => {
    const name = defForm.name.trim();
    if (!name) {
      setMessageModal('기준 정의 이름을 입력하세요.');
      return;
    }
    setDefSaving(true);
    try {
      if (defEditId != null) {
        await updateScheduleCriteriaDefinition(defEditId, { name, content_type: defForm.content_type });
        setCriteriaDefinitions((prev) =>
          prev.map((d) => (d.id === defEditId ? { ...d, name, content_type: defForm.content_type } : d))
        );
        setDefEditId(null);
      } else {
        const res = await createScheduleCriteriaDefinition({ name, content_type: defForm.content_type });
        const newDef: ScheduleCriteriaDefinitionItem = { id: res.id, name, content_type: defForm.content_type, sort_order: 0 };
        setCriteriaDefinitions((prev) => [...prev, newDef]);
      }
      setDefForm({ name: '', content_type: 'range' });
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setDefSaving(false);
    }
  };

  const deleteDef = async (id: number) => {
    try {
      await deleteScheduleCriteriaDefinition(id);
      setCriteriaDefinitions((prev) => prev.filter((d) => d.id !== id));
      if (selectedDefinitionId === id) setSelectedDefinitionId(null);
      if (defEditId === id) setDefEditId(null);
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  /** 기준 목록 선택 모달 확인: 체크된 정의만 해당 작업유형 기준 목록에 반영(추가/제거 동기화) */
  const confirmCriteriaModalSelection = async () => {
    if (selectedJobtypeIndex === null || !jobtypeRows[selectedJobtypeIndex]) {
      setMessageModal('작업유형을 선택하세요.');
      return;
    }
    const jobtypeId = jobtypeRows[selectedJobtypeIndex].id;
    const currentRows = criteriaRows.filter((r) => r.criteriaDefinitionId != null);
    const checkedSet = new Set(criteriaModalCheckedDefinitionIds);
    const toAdd = criteriaModalCheckedDefinitionIds.filter((id) => !currentRows.some((r) => r.criteriaDefinitionId === id));
    const toRemove = currentRows.filter((r) => r.criteriaDefinitionId != null && !checkedSet.has(r.criteriaDefinitionId!));
    setAddCriteriaSaving(true);
    try {
      for (const defId of toAdd) {
        await createScheduleCriteria({ jobtype_id: jobtypeId, criteria_definition_id: defId });
      }
      for (const row of toRemove) {
        await deleteScheduleCriteria(row.id);
      }
      loadChains();
      closeAddCriteriaModal();
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '기준 목록 반영 실패');
    } finally {
      setAddCriteriaSaving(false);
    }
  };

  const handleAddJobtype = () => {
    if (selectedFacilityId == null) {
      setMessageModal('시설을 선택하세요.');
      return;
    }
    if (selectedSortationIndex === null) {
      setMessageModal('구분을 선택하세요.');
      return;
    }
    setAddJobtypeName('');
    setAddJobtypeOpen(true);
  };

  const closeAddJobtypeModal = () => {
    if (!addJobtypeSaving && !jobtypeDefSaving) {
      setAddJobtypeOpen(false);
      setAddJobtypeName('');
    }
  };

  const saveAddJobtype = async () => {
    const name = addJobtypeName.trim();
    if (!name) {
      setMessageModal('작업유형 이름을 입력하세요.');
      return;
    }
    if (selectedSortationIndex === null || !sortationRows[selectedSortationIndex]) return;
    const sortationId = sortationRows[selectedSortationIndex].sortationId;
    setAddJobtypeSaving(true);
    try {
      await createScheduleJobtype({
        name,
        sortation_id: sortationId,
        jobtypes: [{ name }],
      });
      loadChains();
      closeAddJobtypeModal();
    } catch (e) {
      setMessageModal(e instanceof Error ? e.message : '작업유형 추가 실패');
    } finally {
      setAddJobtypeSaving(false);
    }
  };

  return (
    <>
      <h2 style={{ marginBottom: 16 }}>기초 일정 관리</h2>
      <p style={{ color: '#64748b', marginBottom: 20, fontSize: 14 }}>
        농장에 적용할 <strong>기초 자료</strong>입니다. 농장시설을 선택한 뒤 시설을 고르면 구분·기준·작업유형·작업내용이 표시됩니다.
      </p>

      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 14, fontWeight: 600, marginRight: 12 }}>농장시설</span>
        <span style={{ display: 'inline-flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => onCategoryChange('production')}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              border: 'none',
              background: facilityCategory === 'production' ? '#334155' : '#fff',
              color: facilityCategory === 'production' ? '#fff' : '#475569',
              cursor: 'pointer',
            }}
          >
            사육시설
          </button>
          <button
            type="button"
            onClick={() => onCategoryChange('support')}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              border: 'none',
              borderLeft: '1px solid #e2e8f0',
              background: facilityCategory === 'support' ? '#334155' : '#fff',
              color: facilityCategory === 'support' ? '#fff' : '#475569',
              cursor: 'pointer',
            }}
          >
            일반시설
          </button>
        </span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 20, padding: '8px 12px', fontSize: 14, color: '#f1f5f9', cursor: 'pointer', background: '#334155', borderRadius: 6 }}>
          <input
            type="checkbox"
            checked={filterLinkEnabled}
            onChange={(e) => {
            const checked = e.target.checked;
            setFilterLinkEnabled(checked);
            if (!checked) {
              setFilterFacilityId('');
              setFilterFacilityCategory('');
            }
          }}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          필터 연동
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', gap: 1, flexWrap: 'wrap' }}>
        {/* 사육시설 / 일반시설 - 단일 선택, 선택 시 한 줄만 표시 */}
        <div style={{ flex: '1 1 200px', minWidth: 200, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ background: '#334155', color: '#f1f5f9', padding: '10px 12px', fontSize: 12, fontWeight: 600 }}>
            {categoryLabel}
          </div>
          <div style={{ padding: 12, minHeight: listItemMinHeight }}>
            {facilitiesByCategory.length === 0 ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>해당 구분의 시설이 없습니다.</div>
            ) : selectedFacilityId != null ? (
              <label style={{ ...listItemStyle, borderBottom: '1px solid #e5e7eb' }}>
                <input type="checkbox" checked onChange={clearFacility} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <span style={{ flex: 1 }}>{facilitiesByCategory.find((f) => f.id === selectedFacilityId)?.name ?? '—'}</span>
              </label>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {facilitiesByCategory.map((f) => (
                  <label key={f.id} style={{ ...listItemStyle, borderBottom: '1px solid #e5e7eb' }}>
                    <input
                      type="checkbox"
                      checked={selectedFacilityId === f.id}
                      onChange={() => (selectedFacilityId === f.id ? clearFacility() : selectFacility(f.id))}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    {f.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 구분 DIV - 단일 선택, 선택 시 한 줄만 표시 */}
        <div style={{ flex: '1 1 200px', minWidth: 200, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ background: '#334155', color: '#f1f5f9', padding: '10px 12px', fontSize: 12, fontWeight: 600 }}>
            구분
          </div>
          <div style={{ padding: 12, minHeight: listItemMinHeight }}>
            {selectedFacilityId == null ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>시설을 선택하세요.</div>
            ) : listLoading ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>조회 중...</div>
            ) : selectedSortationIndex !== null && sortationRows[selectedSortationIndex] ? (
              <label style={{ ...listItemStyle, borderBottom: '1px solid #e5e7eb' }}>
                <input type="checkbox" checked onChange={clearSortation} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <span style={{ flex: 1 }}>{sortationRows[selectedSortationIndex].sortationLabel}</span>
              </label>
            ) : sortationRows.length === 0 ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>—</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {sortationRows.map((row, idx) => (
                  <div key={`sort-${idx}`} style={{ ...listItemStyle, borderBottom: '1px solid #e5e7eb' }}>
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 }}>
                      <input
                        type="checkbox"
                        checked={selectedSortationIndex === idx}
                        onChange={() => {
                          if (selectedSortationIndex === idx) clearSortation();
                          else {
                            setSelectedSortationIndex(idx);
                            setSelectedCriteriaIndex(null);
                            setSelectedJobtypeIndex(null);
                            resetCriteriaAndWorkContent();
                          }
                        }}
                        style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>{row.sortationLabel}</span>
                    </label>
                    <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button type="button" onClick={() => moveSortationUp(idx)} disabled={idx === 0} title="위로" style={{ padding: '2px 6px', fontSize: 12, lineHeight: 1, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.5 : 1 }}>↑</button>
                      <button type="button" onClick={() => moveSortationDown(idx)} disabled={idx === sortationRows.length - 1} title="아래로" style={{ padding: '2px 6px', fontSize: 12, lineHeight: 1, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', cursor: idx === sortationRows.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === sortationRows.length - 1 ? 0.5 : 1 }}>↓</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
              <button
                type="button"
                onClick={handleAddSortation}
                style={{ width: '100%', padding: '8px 12px', fontSize: 13, color: '#2563eb', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }}
              >
                구분 목록 선택
              </button>
            </div>
          </div>
        </div>

        {/* 작업유형 DIV - 단일 선택, 선택 시 한 줄만 표시 */}
        <div style={{ flex: '1 1 200px', minWidth: 200, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ background: '#334155', color: '#f1f5f9', padding: '10px 12px', fontSize: 12, fontWeight: 600 }}>
            작업유형
          </div>
          <div style={{ padding: 12, minHeight: listItemMinHeight }}>
            {selectedFacilityId == null ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>시설을 선택하세요.</div>
            ) : listLoading ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>조회 중...</div>
            ) : selectedSortationIndex === null ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>구분을 선택하세요.</div>
            ) : selectedJobtypeIndex !== null && jobtypeRows[selectedJobtypeIndex] ? (
              <label style={{ ...listItemStyle, borderBottom: '1px solid #e5e7eb' }}>
                <input type="checkbox" checked onChange={clearJobtype} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{jobtypeRows[selectedJobtypeIndex].jobtypeLabel}</span>
                  {jobtypeRows[selectedJobtypeIndex].workContent && jobtypeRows[selectedJobtypeIndex].workContent !== '—' && (
                    <span style={{ color: '#64748b', marginLeft: 4 }}>({jobtypeRows[selectedJobtypeIndex].workContent})</span>
                  )}
                </span>
              </label>
            ) : jobtypeRows.length === 0 ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>해당 구분에 작업유형이 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {jobtypeRows.map((row, idx) => (
                  <div key={`job-${row.id}`} style={{ ...listItemStyle, borderBottom: '1px solid #e5e7eb' }}>
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 }}>
                      <input
                        type="checkbox"
                        checked={selectedJobtypeIndex === idx}
                        onChange={() => {
                          if (selectedJobtypeIndex === idx) clearJobtype();
                          else {
                            setSelectedJobtypeIndex(idx);
                            setSelectedCriteriaIndex(null);
                            resetCriteriaAndWorkContent();
                          }
                        }}
                        style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 500 }}>{row.jobtypeLabel}</span>
                        {row.workContent && row.workContent !== '—' && (
                          <span style={{ color: '#64748b', marginLeft: 4 }}>({row.workContent})</span>
                        )}
                      </span>
                    </label>
                    <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button type="button" onClick={() => moveJobtypeUp(idx)} disabled={idx === 0} title="위로" style={{ padding: '2px 6px', fontSize: 12, lineHeight: 1, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.5 : 1 }}>↑</button>
                      <button type="button" onClick={() => moveJobtypeDown(idx)} disabled={idx === jobtypeRows.length - 1} title="아래로" style={{ padding: '2px 6px', fontSize: 12, lineHeight: 1, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', cursor: idx === jobtypeRows.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === jobtypeRows.length - 1 ? 0.5 : 1 }}>↓</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
              <button
                type="button"
                onClick={handleAddJobtype}
                style={{ width: '100%', padding: '8px 12px', fontSize: 13, color: '#2563eb', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }}
              >
                작업유형 목록 선택
              </button>
            </div>
          </div>
        </div>

        {/* 기준 DIV - 단일 선택, 선택 시 한 줄만 표시 */}
        <div style={{ flex: '1 1 200px', minWidth: 200, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ background: '#334155', color: '#f1f5f9', padding: '10px 12px', fontSize: 12, fontWeight: 600 }}>
            기준
          </div>
          <div style={{ padding: 12, minHeight: listItemMinHeight }}>
            {selectedFacilityId == null ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>시설을 선택하세요.</div>
            ) : listLoading ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>조회 중...</div>
            ) : selectedSortationIndex === null ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>구분을 선택하세요.</div>
            ) : selectedJobtypeIndex === null ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>작업유형을 선택하세요.</div>
            ) : selectedCriteriaIndex !== null && criteriaRows[selectedCriteriaIndex] ? (
              <label style={{ ...listItemStyle, borderBottom: '1px solid #e5e7eb' }}>
                <input type="checkbox" checked onChange={clearCriteria} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <span style={{ flex: 1 }}>{criteriaRows[selectedCriteriaIndex].criteriaLabel}</span>
              </label>
            ) : criteriaRows.length === 0 ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>해당 작업유형에 기준이 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {criteriaRows.map((row, idx) => (
                  <div key={`crit-${row.id}`} style={{ ...listItemStyle, borderBottom: '1px solid #e5e7eb' }}>
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 }}>
                      <input
                        type="checkbox"
                        checked={selectedCriteriaIndex === idx}
                        onChange={() => {
                          if (selectedCriteriaIndex === idx) clearCriteria();
                          else {
                            setSelectedCriteriaIndex(idx);
                            resetCriteriaAndWorkContent();
                          }
                        }}
                        style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>{row.criteriaLabel}</span>
                    </label>
                    <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button type="button" onClick={() => moveCriteriaUp(idx)} disabled={idx === 0} title="위로" style={{ padding: '2px 6px', fontSize: 12, lineHeight: 1, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.5 : 1 }}>↑</button>
                      <button type="button" onClick={() => moveCriteriaDown(idx)} disabled={idx === criteriaRows.length - 1} title="아래로" style={{ padding: '2px 6px', fontSize: 12, lineHeight: 1, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', cursor: idx === criteriaRows.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === criteriaRows.length - 1 ? 0.5 : 1 }}>↓</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
              <button
                type="button"
                onClick={handleAddCriteria}
                style={{ width: '100%', padding: '8px 12px', fontSize: 13, color: '#2563eb', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }}
              >
                기준 목록 선택
              </button>
            </div>
          </div>
        </div>

        {/* 기준내용 DIV - 유형 선택 + 입력 + 기초 일정 저장 */}
        <div style={{ flex: '1 1 340px', minWidth: 340, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ background: '#334155', color: '#f1f5f9', padding: '10px 12px', fontSize: 12, fontWeight: 600 }}>
            기준내용
          </div>
          <div style={{ padding: 12, minHeight: listItemMinHeight, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {selectedFacilityId == null ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>시설을 선택하세요.</div>
            ) : selectedSortationIndex === null ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>구분을 선택하세요.</div>
            ) : selectedJobtypeIndex === null ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>작업유형을 선택하세요.</div>
            ) : selectedCriteriaIndex === null || !criteriaRows[selectedCriteriaIndex] ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>기준을 선택하세요.</div>
            ) : (
              <>
                {effectiveContentType === 'count' && (
                  <div style={{ ...listItemStyle, borderBottom: 'none', padding: '4px 0' }}>
                    <span style={{ flexShrink: 0, color: '#475569' }}>횟수 :</span>
                    <input
                      type="number"
                      min={1}
                      placeholder="횟수"
                      value={criteriaContentCount === '' ? '' : criteriaContentCount}
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = parseInt(v, 10);
                        setCriteriaContentCount(v === '' ? '' : (Number.isNaN(n) ? 1 : n));
                      }}
                      style={{ width: 72, padding: '6px 8px', fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 6 }}
                    />
                  </div>
                )}
                {(effectiveContentType === 'range' || effectiveContentType === 'weekend') && (
                  <div style={{ ...listItemStyle, borderBottom: 'none', padding: '4px 0', flexWrap: 'wrap' }}>
                    <span style={{ flexShrink: 0, color: '#475569' }}>시작일 :</span>
                    <input type="number" placeholder="일" size={4} value={startDay === '' ? '' : startDay} onChange={(e) => { const v = e.target.value; const n = parseInt(v, 10); setStartDay(v === '' ? '' : (Number.isNaN(n) ? '' : n)); }} style={{ width: 56, minWidth: 56, padding: '6px 6px', fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 6 }} />
                    <span style={{ flexShrink: 0, color: '#475569', marginLeft: 8 }}>종료일 :</span>
                    <input type="number" placeholder="일" size={4} value={endDay === '' ? '' : endDay} onChange={(e) => { const v = e.target.value; const n = parseInt(v, 10); setEndDay(v === '' ? '' : (Number.isNaN(n) ? '' : n)); }} style={{ width: 56, minWidth: 56, padding: '6px 6px', fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 6 }} />
                  </div>
                )}
                {effectiveContentType === 'weekly' && (
                  <>
                    <div style={{ ...listItemStyle, borderBottom: 'none', padding: '4px 0' }}>
                      <span style={{ flexShrink: 0, color: '#475569' }}>몇 주마다 :</span>
                      <input type="number" min={1} value={criteriaContentInterval} onChange={(e) => setCriteriaContentInterval(parseInt(e.target.value, 10) || 1)} style={{ width: 56, padding: '6px 8px', fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 6 }} />
                    </div>
                    <div style={{ ...listItemStyle, borderBottom: 'none', padding: '4px 0' }}>
                      <span style={{ flexShrink: 0, color: '#475569' }}>요일 :</span>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {['일', '월', '화', '수', '목', '금', '토'].map((label, i) => (
                          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 15 }}>
                            <input type="checkbox" checked={criteriaContentByWeekday.includes(i)} onChange={() => toggleWeekday(i)} style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {effectiveContentType === 'monthly' && (
                  <div style={{ ...listItemStyle, borderBottom: 'none', padding: '4px 0' }}>
                    <span style={{ flexShrink: 0, color: '#475569' }}>매월 몇 일 :</span>
                    <input type="number" min={1} max={31} value={criteriaContentDayOfMonth} onChange={(e) => setCriteriaContentDayOfMonth(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))} style={{ width: 56, padding: '6px 8px', fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 6 }} />
                  </div>
                )}
                {effectiveContentType === 'yearly' && (
                  <div style={{ ...listItemStyle, borderBottom: 'none', padding: '4px 0' }}>
                    <span style={{ flexShrink: 0, color: '#475569' }}>매년</span>
                    <input type="number" min={1} max={12} value={criteriaContentMonth} onChange={(e) => setCriteriaContentMonth(Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 1)))} style={{ width: 48, padding: '6px 8px', fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 6 }} placeholder="월" />
                    <span style={{ color: '#475569' }}>월</span>
                    <input type="number" min={1} max={31} value={criteriaContentDay} onChange={(e) => setCriteriaContentDay(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))} style={{ width: 48, padding: '6px 8px', fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 6 }} placeholder="일" />
                    <span style={{ color: '#475569' }}>일</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* 작업내용 DIV - 기준내용 오른쪽, 작업내용 입력 + 기초 일정 저장 */}
        <div style={{ flex: '1 1 260px', minWidth: 260, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ background: '#334155', color: '#f1f5f9', padding: '10px 12px', fontSize: 12, fontWeight: 600 }}>
            작업내용 <span style={{ color: '#fbbf24', fontWeight: 500 }}>(필수)</span>
          </div>
          <div style={{ padding: 12, minHeight: listItemMinHeight, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedFacilityId == null ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>시설을 선택하세요.</div>
            ) : selectedSortationIndex === null ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>구분을 선택하세요.</div>
            ) : selectedJobtypeIndex === null ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>작업유형을 선택하세요.</div>
            ) : selectedCriteriaIndex === null || !criteriaRows[selectedCriteriaIndex] ? (
              <div style={{ ...listItemStyle, color: '#64748b' }}>기준을 선택하세요.</div>
            ) : (
              <>
                <div style={{ ...listItemStyle, borderBottom: 'none', padding: '4px 0' }}>
                  <input
                    type="text"
                    placeholder="작업내용 입력"
                    value={criteriaWorkContent}
                    onChange={(e) => setCriteriaWorkContent(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 6 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={saveWorkPlan} disabled={workPlanSaving} style={{ padding: '8px 12px', fontSize: 14, border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: workPlanSaving ? 'not-allowed' : 'pointer' }}>
                      {workPlanSaving ? '저장 중...' : editingWorkPlanId != null ? '기초 일정 수정' : '기초 일정 저장'}
                    </button>
                    {editingWorkPlanId != null && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWorkPlanId(null);
                          setPendingLoadWorkPlan(null);
                          setSelectedFacilityId(null);
                          resetCriteriaAndWorkContent();
                        }}
                        disabled={workPlanSaving || workPlanDeleting}
                        style={{ padding: '8px 12px', fontSize: 14, border: '1px solid #cbd5e1', borderRadius: 6, background: '#e2e8f0', color: '#475569', cursor: workPlanSaving || workPlanDeleting ? 'not-allowed' : 'pointer' }}
                      >
                        취소
                      </button>
                    )}
                  </span>
                  {editingWorkPlanId != null && (
                    <button
                      type="button"
                      onClick={deleteWorkPlan}
                      disabled={workPlanSaving || workPlanDeleting}
                      style={{ padding: '8px 12px', fontSize: 14, border: '1px solid #dc2626', borderRadius: 6, background: '#fff', color: '#dc2626', cursor: workPlanSaving || workPlanDeleting ? 'not-allowed' : 'pointer', marginLeft: 'auto' }}
                    >
                      {workPlanDeleting ? '삭제 중...' : '삭제'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {messageModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 280, maxWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <p style={{ margin: 0, marginBottom: 20, fontSize: 15, lineHeight: 1.5 }}>{messageModal}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setMessageModal(null)} style={{ padding: '8px 20px', fontSize: 14, border: 'none', borderRadius: 6, background: '#334155', color: '#fff', cursor: 'pointer' }}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 55 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 320, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <p style={{ margin: 0, marginBottom: 20, fontSize: 15, lineHeight: 1.5 }}>
              정말 삭제하시겠습니까? 삭제된 항목은 복구할 수 없습니다.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeDeleteConfirmModal} disabled={editDeleting} style={{ padding: '8px 16px', fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: editDeleting ? 'not-allowed' : 'pointer' }}>
                취소
              </button>
              <button type="button" onClick={executeDelete} disabled={editDeleting} style={{ padding: '8px 16px', fontSize: 14, border: 'none', borderRadius: 6, background: '#dc2626', color: '#fff', cursor: editDeleting ? 'not-allowed' : 'pointer' }}>
                {editDeleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 8, minWidth: 320, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            <div style={{ background: '#334155', color: '#f1f5f9', padding: '12px 20px', fontSize: 16, fontWeight: 600 }}>
              {editModal.type === 'criteria' ? '기준 수정' : '작업유형 수정'}
            </div>
            <div style={{ padding: 20 }}>
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="이름"
              style={{ width: '100%', padding: '8px 12px', marginBottom: 16, border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={openDeleteConfirm}
                disabled={editSaving || editDeleting}
                style={{ padding: '8px 16px', fontSize: 14, border: '1px solid #dc2626', borderRadius: 6, background: '#fff', color: '#dc2626', cursor: editSaving || editDeleting ? 'not-allowed' : 'pointer', opacity: editSaving || editDeleting ? 0.6 : 1 }}
              >
                {editDeleting ? '삭제 중...' : '삭제'}
              </button>
              <span style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={closeEditModal} disabled={editDeleting} style={{ padding: '8px 16px', fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: editDeleting ? 'not-allowed' : 'pointer' }}>
                  취소
                </button>
                <button type="button" onClick={saveEdit} disabled={editSaving || editDeleting} style={{ padding: '8px 16px', fontSize: 14, border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: editSaving || editDeleting ? 'not-allowed' : 'pointer' }}>
                  {editSaving ? '저장 중...' : '저장'}
                </button>
              </span>
            </div>
            </div>
          </div>
        </div>
      )}

      {addSortationOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 8, minWidth: 420, maxWidth: 520, maxHeight: '85vh', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#334155', color: '#f1f5f9', padding: '12px 20px', fontSize: 16, fontWeight: 600 }}>구분 목록 선택</div>
            <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
              <p style={{ margin: 0, marginBottom: 12, fontSize: 13, color: '#64748b' }}>
                선택한 시설의 구분 목록을 체크하여 정한 뒤 「확인」을 누르면 반영됩니다.
              </p>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#475569' }}>구분 정의 목록</div>
                {sortationDefinitionsLoading ? (
                  <div style={{ padding: 12, color: '#64748b', fontSize: 13 }}>조회 중...</div>
                ) : sortationDefinitions.length === 0 ? (
                  <div style={{ padding: 12, color: '#64748b', fontSize: 13 }}>정의가 없습니다. 아래에서 추가하세요.</div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                    {sortationDefinitions.map((d, idx) => (
                      <div
                        key={d.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderBottom: '1px solid #f1f5f9',
                          background: '#fff',
                        }}
                      >
                        <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={selectedSortationDefIds.has(d.id)}
                            onChange={() => {
                              setSelectedSortationDefIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(d.id)) next.delete(d.id);
                                else next.add(d.id);
                                return next;
                              });
                            }}
                            style={{ width: 16, height: 16, flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 14 }}>{d.name}</span>
                        </label>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button type="button" onClick={() => moveSortationDefUp(idx)} disabled={idx === 0} title="위로" style={{ padding: '2px 6px', fontSize: 12, lineHeight: 1, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.5 : 1 }}>↑</button>
                          <button type="button" onClick={() => moveSortationDefDown(idx)} disabled={idx === sortationDefinitions.length - 1} title="아래로" style={{ padding: '2px 6px', fontSize: 12, lineHeight: 1, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', cursor: idx === sortationDefinitions.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === sortationDefinitions.length - 1 ? 0.5 : 1 }}>↓</button>
                          <button
                            type="button"
                            onClick={() => { setSortationDefEditId(sortationDefEditId === d.id ? null : d.id); setSortationDefFormName(sortationDefEditId === d.id ? '' : d.name); }}
                            style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                          >
                            수정
                          </button>
                          <button type="button" onClick={() => { if (confirm('이 구분 정의를 삭제할까요?')) deleteSortationDef(d.id); }} style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #fecaca', borderRadius: 4, background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                            삭제
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#475569' }}>{sortationDefEditId != null ? '구분 정의 수정' : '구분 정의 추가'}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={sortationDefFormName}
                    onChange={(e) => setSortationDefFormName(e.target.value)}
                    placeholder="이름 (예: 비육, 모돈)"
                    style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, minWidth: 140 }}
                  />
                  <button type="button" onClick={saveSortationDefForm} disabled={sortationDefSaving} style={{ padding: '6px 12px', fontSize: 13, border: 'none', borderRadius: 6, background: '#334155', color: '#fff', cursor: sortationDefSaving ? 'not-allowed' : 'pointer' }}>
                    {sortationDefSaving ? '저장 중...' : sortationDefEditId != null ? '수정' : '추가'}
                  </button>
                  {sortationDefEditId != null && (
                    <button type="button" onClick={() => { setSortationDefEditId(null); setSortationDefFormName(''); }} style={{ padding: '6px 12px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
                      취소
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" onClick={closeAddSortationModal} disabled={addSortationSaving} style={{ padding: '8px 16px', fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: addSortationSaving ? 'not-allowed' : 'pointer' }}>
                  취소
                </button>
                <button type="button" onClick={confirmSortationSelection} disabled={addSortationSaving} style={{ padding: '8px 16px', fontSize: 14, border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: addSortationSaving ? 'not-allowed' : 'pointer' }}>
                  {addSortationSaving ? '적용 중...' : '확인'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addCriteriaOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 8, minWidth: 420, maxWidth: 520, maxHeight: '85vh', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#334155', color: '#f1f5f9', padding: '12px 20px', fontSize: 16, fontWeight: 600 }}>기준 목록 선택</div>
            <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
              <p style={{ margin: 0, marginBottom: 12, fontSize: 13, color: '#64748b' }}>
                작업유형 「{selectedJobtypeIndex !== null && jobtypeRows[selectedJobtypeIndex] ? jobtypeRows[selectedJobtypeIndex].jobtypeLabel : '—'}」에 적용할 기준을 체크하세요. 선택 해제 후 확인하면 목록에서 제거됩니다.
              </p>
              {/* 기준 정의 목록 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#475569' }}>기준 정의 목록</div>
                {criteriaDefinitionsLoading ? (
                  <div style={{ padding: 12, color: '#64748b', fontSize: 13 }}>조회 중...</div>
                ) : criteriaDefinitions.length === 0 ? (
                  <div style={{ padding: 12, color: '#64748b', fontSize: 13 }}>정의가 없습니다. 아래에서 추가하세요.</div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                    {criteriaDefinitions.map((d) => (
                      <div
                        key={d.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderBottom: '1px solid #f1f5f9',
                          background: criteriaModalCheckedDefinitionIds.includes(d.id) ? '#eff6ff' : '#fff',
                        }}
                      >
                        <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={criteriaModalCheckedDefinitionIds.includes(d.id)}
                            onChange={() => {
                              setCriteriaModalCheckedDefinitionIds((prev) =>
                                prev.includes(d.id) ? prev.filter((id) => id !== d.id) : [...prev, d.id]
                              );
                            }}
                            style={{ width: 16, height: 16, flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 14 }}>{d.name}</span>
                          <span style={{ fontSize: 12, color: '#64748b' }}>{contentTypeOptions.find((o) => o.value === d.content_type)?.label ?? d.content_type}</span>
                        </label>
                        <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setDefEditId(defEditId === d.id ? null : d.id); setDefForm(defEditId === d.id ? { name: '', content_type: 'range' } : { name: d.name, content_type: d.content_type as CriteriaContentType }); }}
                            style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                          >
                            수정
                          </button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); if (confirm('이 기준 정의를 삭제할까요?')) deleteDef(d.id); }} style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #fecaca', borderRadius: 4, background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                            삭제
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* 기준 정의 추가/수정 */}
              <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#475569' }}>{defEditId != null ? '기준 정의 수정' : '기준 정의 추가'}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={defForm.name}
                    onChange={(e) => setDefForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="이름 (예: 출생일(일령))"
                    style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, minWidth: 140 }}
                  />
                  <select
                    value={defForm.content_type}
                    onChange={(e) => setDefForm((f) => ({ ...f, content_type: e.target.value as CriteriaContentType }))}
                    style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6 }}
                  >
                    {contentTypeOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={saveDefForm} disabled={defSaving} style={{ padding: '6px 12px', fontSize: 13, border: 'none', borderRadius: 6, background: '#334155', color: '#fff', cursor: defSaving ? 'not-allowed' : 'pointer' }}>
                    {defSaving ? '저장 중...' : defEditId != null ? '수정' : '추가'}
                  </button>
                  {defEditId != null && (
                    <button type="button" onClick={() => { setDefEditId(null); setDefForm({ name: '', content_type: 'range' }); }} style={{ padding: '6px 12px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
                      취소
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" onClick={closeAddCriteriaModal} disabled={addCriteriaSaving} style={{ padding: '8px 16px', fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: addCriteriaSaving ? 'not-allowed' : 'pointer' }}>
                  취소
                </button>
                <button type="button" onClick={confirmCriteriaModalSelection} disabled={addCriteriaSaving} style={{ padding: '8px 16px', fontSize: 14, border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: addCriteriaSaving ? 'not-allowed' : 'pointer' }}>
                  {addCriteriaSaving ? '반영 중...' : '확인'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addJobtypeOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 8, minWidth: 420, maxWidth: 520, maxHeight: '85vh', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#334155', color: '#f1f5f9', padding: '12px 20px', fontSize: 16, fontWeight: 600 }}>작업유형 목록 선택</div>
            <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
              <p style={{ margin: 0, marginBottom: 12, fontSize: 13, color: '#64748b' }}>
                선택한 구분의 작업유형 목록을 체크하여 정한 뒤 「확인」을 누르면 반영됩니다.
              </p>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#475569' }}>작업유형 정의 목록</div>
                {jobtypeDefinitionsLoading ? (
                  <div style={{ padding: 12, color: '#64748b', fontSize: 13 }}>조회 중...</div>
                ) : jobtypeDefinitions.length === 0 ? (
                  <div style={{ padding: 12, color: '#64748b', fontSize: 13 }}>정의가 없습니다. 아래에서 추가하세요.</div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                    {jobtypeDefinitions.map((d, idx) => (
                      <div
                        key={d.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderBottom: '1px solid #f1f5f9',
                          background: '#fff',
                        }}
                      >
                        <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={selectedJobtypeDefIds.has(d.id)}
                            onChange={() => {
                              setSelectedJobtypeDefIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(d.id)) next.delete(d.id);
                                else next.add(d.id);
                                return next;
                              });
                            }}
                            style={{ width: 16, height: 16, flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 14 }}>{d.name}</span>
                        </label>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button type="button" onClick={() => moveJobtypeDefUp(idx)} disabled={idx === 0} title="위로" style={{ padding: '2px 6px', fontSize: 12, lineHeight: 1, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.5 : 1 }}>↑</button>
                          <button type="button" onClick={() => moveJobtypeDefDown(idx)} disabled={idx === jobtypeDefinitions.length - 1} title="아래로" style={{ padding: '2px 6px', fontSize: 12, lineHeight: 1, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', cursor: idx === jobtypeDefinitions.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === jobtypeDefinitions.length - 1 ? 0.5 : 1 }}>↓</button>
                          <button
                            type="button"
                            onClick={() => { setJobtypeDefEditId(jobtypeDefEditId === d.id ? null : d.id); setJobtypeDefFormName(jobtypeDefEditId === d.id ? '' : d.name); }}
                            style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                          >
                            수정
                          </button>
                          <button type="button" onClick={() => { if (confirm('이 작업유형 정의를 삭제할까요?')) deleteJobtypeDef(d.id); }} style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #fecaca', borderRadius: 4, background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                            삭제
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#475569' }}>{jobtypeDefEditId != null ? '작업유형 정의 수정' : '작업유형 정의 추가'}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={jobtypeDefFormName}
                    onChange={(e) => setJobtypeDefFormName(e.target.value)}
                    placeholder="이름 (예: 일상점검, 투입)"
                    style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, minWidth: 140 }}
                  />
                  <button type="button" onClick={saveJobtypeDefForm} disabled={jobtypeDefSaving} style={{ padding: '6px 12px', fontSize: 13, border: 'none', borderRadius: 6, background: '#334155', color: '#fff', cursor: jobtypeDefSaving ? 'not-allowed' : 'pointer' }}>
                    {jobtypeDefSaving ? '저장 중...' : jobtypeDefEditId != null ? '수정' : '추가'}
                  </button>
                  {jobtypeDefEditId != null && (
                    <button type="button" onClick={() => { setJobtypeDefEditId(null); setJobtypeDefFormName(''); }} style={{ padding: '6px 12px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
                      취소
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" onClick={closeAddJobtypeModal} disabled={addJobtypeSaving} style={{ padding: '8px 16px', fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: addJobtypeSaving ? 'not-allowed' : 'pointer' }}>
                  취소
                </button>
                <button type="button" onClick={confirmJobtypeSelection} disabled={addJobtypeSaving} style={{ padding: '8px 16px', fontSize: 14, border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: addJobtypeSaving ? 'not-allowed' : 'pointer' }}>
                  {addJobtypeSaving ? '적용 중...' : '확인'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 작업 추가한 schedule_work_plans 목록 - 상단 패널과 구분선 없이 바로 이어서 표시 */}
      <section style={{ marginTop: 12, paddingTop: 0, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>
            작업 목록 (schedule_work_plans)
          </h3>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>시설 구분</label>
            <select
              value={filterFacilityCategory}
              onChange={(e) => {
                const v = e.target.value as '' | 'production' | 'support';
                setFilterFacilityCategory(v);
                setFilterFacilityId('');
              }}
              style={{ padding: '4px 8px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', minWidth: 100 }}
            >
              <option value="">전체</option>
              <option value="production">사육시설</option>
              <option value="support">일반시설</option>
            </select>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>시설</label>
            <select
              value={filterFacilityId === '' ? '' : filterFacilityId}
              onChange={(e) => setFilterFacilityId(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ padding: '4px 8px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', minWidth: 100 }}
            >
              <option value="">전체</option>
              {filterFacilityOptions.map((f) => (
                <option key={f.id} value={f.id}>{f.name ?? `ID ${f.id}`}</option>
              ))}
            </select>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>구분</label>
            <select
              value={filterSortationId === '' ? '' : filterSortationId}
              onChange={(e) => {
                const v = e.target.value === '' ? '' : Number(e.target.value);
                setFilterSortationId(v);
                setFilterJobtypeId('');
                setFilterCriteriaId('');
              }}
              style={{ padding: '4px 8px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', minWidth: 100 }}
            >
              <option value="">전체</option>
              {filterSortations.map((s) => (
                <option key={s.id} value={(s as ScheduleSortationItem).sortation_definition_id ?? s.id}>{(s as ScheduleSortationItem).sortation_name ?? (labelFrom(s.sortations) ?? '—')}</option>
              ))}
            </select>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>작업유형</label>
            <select
              value={filterJobtypeId === '' ? '' : filterJobtypeId}
              onChange={(e) => {
                setFilterJobtypeId(e.target.value === '' ? '' : Number(e.target.value));
                setFilterCriteriaId('');
              }}
              style={{ padding: '4px 8px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', minWidth: 100 }}
            >
              <option value="">전체</option>
              {filterJobtypeOptions.map((j) => (
                <option key={j.id} value={(j as ScheduleJobtypeItem).jobtype_definition_id ?? j.id}>{((j as ScheduleJobtypeItem).jobtype_name ?? labelFrom(j.jobtypes)) || '—'}</option>
              ))}
            </select>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>기준</label>
            <select
              value={filterCriteriaId === '' ? '' : filterCriteriaId}
              onChange={(e) => setFilterCriteriaId(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ padding: '4px 8px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', minWidth: 100 }}
            >
              <option value="">전체</option>
              {filterCriteriaOptions.map((c) => (
                <option key={c.id} value={(c as ScheduleCriteriaItem).criteria_definition_id ?? c.id}>{(((c as ScheduleCriteriaItem).criteria_name ?? labelFrom(c.criterias)) || c.description || '—')}</option>
              ))}
            </select>
          </span>
          <button
            type="button"
            onClick={loadWorkPlans}
            style={{ padding: '6px 12px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#475569', marginLeft: 'auto' }}
          >
            새로고침
          </button>
        </div>
        {workPlansError && (
          <div style={{ marginBottom: 12, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 14 }}>
            {workPlansError}
            <div style={{ marginTop: 6, fontSize: 12, color: '#991b1b' }}>
              관리자로 로그인했는지, DB에 structure_template_id 등 컬럼이 추가되었는지 확인하세요.
            </div>
          </div>
        )}
        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ width: 44, minWidth: 44, padding: 6, textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#94a3b8' }} title="순서 이동">⋮⋮</th>
                <th style={{ padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569' }}>사육시설</th>
                <th style={{ padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569' }}>구분</th>
                <th style={{ padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569' }}>작업유형</th>
                <th style={{ padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569' }}>기준</th>
                <th style={{ padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569' }}>기준내용</th>
                <th style={{ padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#475569' }}>작업내용</th>
              </tr>
            </thead>
            <tbody>
              {workPlansLoading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: 'center', fontSize: 14, color: '#64748b' }}>
                    목록 불러오는 중…
                  </td>
                </tr>
              ) : filteredWorkPlans.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: 'center', fontSize: 14, color: '#64748b' }}>
                    {workPlans?.length === 0 ? '등록된 작업이 없습니다. 위에서 사육시설·구분·작업유형·기준·기준내용을 선택 후 「기초 일정 저장」으로 추가하세요.' : '필터 조건에 맞는 작업이 없습니다.'}
                  </td>
                </tr>
              ) : (
                filteredWorkPlans.map((p, index) => {
                  const cc = p.criteriaContent as { type?: string; start_day?: number; end_day?: number; start_date?: string; end_date?: string; month?: number; day?: number; day_of_month?: number; interval?: number; by_weekday?: number[]; count?: number } | null | undefined;
                  const contentSummary =
                    cc?.type == null
                      ? '—'
                      : cc.type === 'range' && (cc.start_day != null || cc.end_day != null)
                        ? `${cc.start_day ?? '—'}일 ~ ${cc.end_day ?? '—'}일`
                        : cc.type === 'weekend' && (cc.start_day != null || cc.end_day != null)
                          ? `주말 ${cc.start_day ?? '—'} ~ ${cc.end_day ?? '—'}일`
                          : cc.type === 'range' && cc.start_date != null && cc.end_date != null
                            ? `${cc.start_date} ~ ${cc.end_date}`
                            : cc.type === 'yearly' && cc.month != null && cc.day != null
                          ? `매년 ${cc.month}월 ${cc.day}일`
                          : cc.type === 'monthly' && cc.day_of_month != null
                            ? `매월 ${cc.day_of_month}일`
                            : cc.type === 'weekly' && (cc.interval != null || (cc.by_weekday && cc.by_weekday.length > 0))
                              ? `${cc.interval ?? 1}주마다 ${cc.by_weekday?.length ? cc.by_weekday.map((d) => WEEKDAY_NAMES[d] ?? `요일${d}`).join(', ') : ''}`
                              : cc.type === 'daily'
                                ? '매일'
                                : cc.type === 'weekend'
                                  ? '주말'
                                  : cc.type === 'count'
                                    ? `횟수 ${cc.count ?? '—'}`
                                    : cc.type ?? '—';
                  const isSelected = editingWorkPlanId === p.id;
                  const isDragOver = dragOverIndex === index;
                  return (
                    <tr
                      key={p.id}
                      data-work-plan-index={index}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (didDragRef.current) {
                          didDragRef.current = false;
                          return;
                        }
                        loadWorkPlanIntoForm(p);
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadWorkPlanIntoForm(p); } }}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        background: isDragOver ? '#e0e7ff' : isSelected ? '#eff6ff' : undefined,
                        cursor: 'pointer',
                      }}
                    >
                      <td
                        style={{ width: 44, minWidth: 44, padding: 6, textAlign: 'center', verticalAlign: 'middle', color: '#94a3b8', cursor: dragPlanId != null ? (dragPlanId === p.id ? 'grabbing' : 'pointer') : 'grab', userSelect: 'none' }}
                        title="이 칸을 눌러 끌어서 순서 이동"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDragPlanId(p.id);
                          setDragStartIndex(index);
                          setDragOverIndex(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        ⋮⋮
                      </td>
                      <td style={{ padding: 10, fontSize: 14 }}>{p.structureTemplateName ?? (p.structureTemplateId != null ? `ID ${p.structureTemplateId}` : '—')}</td>
                      <td style={{ padding: 10, fontSize: 14 }}>{p.sortationName ?? '—'}</td>
                      <td style={{ padding: 10, fontSize: 14 }}>{p.jobtypeName ?? '—'}</td>
                      <td style={{ padding: 10, fontSize: 14 }}>{p.criteriaName ?? '—'}</td>
                      <td style={{ padding: 10, fontSize: 14 }}>{contentSummary}</td>
                      <td style={{ padding: 10, fontSize: 14 }}>{p.workContent ?? '—'}</td>
                    </tr>
                  );
                })
              ) }
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
