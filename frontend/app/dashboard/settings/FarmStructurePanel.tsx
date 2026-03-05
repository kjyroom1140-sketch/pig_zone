'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getFarmFacilitiesTree,
  saveFarmOpeningSection,
  deleteFarmOpeningSection,
  createFarmBuilding,
  createFarmBarn,
  createFarmRoomsBulk,
  createFarmSectionsBulk,
  updateFarmRoom,
  deleteFarmBuilding,
  deleteFarmBarn,
  saveFarmStructureProduction,
  reorderFarmBarns,
  type FarmBuilding,
  type FarmBarn,
  type FarmRoom,
  type StructureTemplate,
} from '@/lib/api';

const SECTION_TITLE_HEIGHT = 48;
const SECTION_TITLE_BG = '#e0f2fe';
const BODY_FONT_SIZE = 15;
const TREE_TOGGLE_BTN_BASE_STYLE = {
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
const TREE_TOGGLE_PLACEHOLDER_STYLE = { display: 'inline-block', width: 22 };

function treeToggleBtnStyle(expanded: boolean) {
  return {
    ...TREE_TOGGLE_BTN_BASE_STYLE,
    color: expanded ? '#334155' : '#ffffff',
    borderColor: expanded ? '#cbd5e1' : '#64748b',
    background: expanded ? '#ffffff' : '#475569',
  };
}

function normalizeHexColor(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) return null;
  return v.toUpperCase();
}

function parseAgeDaysFromLabel(value?: string | null): number | null {
  if (!value) return null;
  const match = value.match(/(\d{1,4})/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type Props = {
  farmId: string;
  productionTemplates?: StructureTemplate[] | null;
  hasSavedProductionSelection?: boolean;
  selectedProductionTemplateIds?: number[];
  onProductionOrderSaved?: (orderedIds: number[]) => void;
};

type OpeningFacilityKind = 'breedingGestation' | 'farrowing' | 'other';

type OpeningSectionDraft = {
  sowNos: string;
  headCount: number;
  entryDate: string;
  birthDate: string;
  ageDays: number | null;
};

type OpeningRequiredState = {
  entryRequired: boolean;
  sowRequired: boolean;
  headRequired: boolean;
  birthOrAgeRequired: boolean;
  sowCount: number;
  entryValid: boolean;
  sowValid: boolean;
  headValid: boolean;
  birthOrAgeValid: boolean;
};

export default function FarmStructurePanel({
  farmId,
  productionTemplates = [],
  hasSavedProductionSelection = true,
  selectedProductionTemplateIds = [],
  onProductionOrderSaved,
}: Props) {
  const productionTemplateNameById = new Map(
    (Array.isArray(productionTemplates) ? productionTemplates : [])
      .map((t) => [t.id, t.name] as const)
  );
  const productionTemplateColorById = new Map(
    (Array.isArray(productionTemplates) ? productionTemplates : [])
      .map((t) => [t.id, normalizeHexColor(t.themeColor)] as const)
  );
  const productionTemplateAgeDaysById = new Map(
    (Array.isArray(productionTemplates) ? productionTemplates : [])
      .map((t) => [t.id, parseAgeDaysFromLabel(t.ageLabel)] as const)
  );
  const allowedTemplateIdSet = new Set(
    selectedProductionTemplateIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
  );
  const templates = Array.isArray(productionTemplates)
    ? productionTemplates.filter((t) => allowedTemplateIdSet.has(t.id))
    : [];
  const [tree, setTree] = useState<FarmBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingDraftBySection, setOpeningDraftBySection] = useState<Record<string, OpeningSectionDraft>>({});
  const [openingSectionModal, setOpeningSectionModal] = useState<{
    sectionId: string;
    buildingName: string;
    facilityName: string;
    roomName: string;
    sectionName: string;
    unitLabel: '칸' | '스톨';
    kind: OpeningFacilityKind;
    defaultAgeDays: number | null;
  } | null>(null);
  const [openingResult, setOpeningResult] = useState<string>('');
  const [openingSectionSaving, setOpeningSectionSaving] = useState(false);
  const [openingSectionDeleting, setOpeningSectionDeleting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isOpeningInputMode, setIsOpeningInputMode] = useState(false);
  const [expandedBuilding, setExpandedBuilding] = useState<Set<string>>(new Set());
  const [expandedBarn, setExpandedBarn] = useState<Set<string>>(new Set());
  const [expandedRoom, setExpandedRoom] = useState<Set<string>>(new Set());
  const hasInitializedExpandRef = useRef(false);

  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [showProductionRequiredModal, setShowProductionRequiredModal] = useState(false);
  const [newBuildingName, setNewBuildingName] = useState('');
  const [addingBuilding, setAddingBuilding] = useState(false);

  const [showAddBarn, setShowAddBarn] = useState<string | null>(null);
  const [barnCategory, setBarnCategory] = useState<'production' | 'support'>('production');
  const [barnTemplateId, setBarnTemplateId] = useState<number | ''>('');
  const [barnName, setBarnName] = useState('');
  const [barnRoomCount, setBarnRoomCount] = useState(1);
  const [addingBarn, setAddingBarn] = useState(false);

  const [roomBulkBarnId, setRoomBulkBarnId] = useState<string | null>(null);
  const [roomBulkCurrentCount, setRoomBulkCurrentCount] = useState(0);
  const [roomBulkTargetLabel, setRoomBulkTargetLabel] = useState('');
  const [roomBulkCount, setRoomBulkCount] = useState(5);
  const [addingRooms, setAddingRooms] = useState(false);

  const [roomConfigModal, setRoomConfigModal] = useState<{
    roomId: string;
    facilityName: string;
    roomName: string;
    currentMode: 'stall' | 'group';
    currentCount: number;
    allowModeSelection: boolean;
  } | null>(null);
  const [roomConfigMode, setRoomConfigMode] = useState<'stall' | 'group'>('group');
  const [roomConfigCount, setRoomConfigCount] = useState(1);
  const [savingRoomConfig, setSavingRoomConfig] = useState(false);

  /** 사육시설 순서 (농장 구조 설정에서 변경) */
  const [orderedTemplateIds, setOrderedTemplateIds] = useState<number[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    setOrderedTemplateIds([...selectedProductionTemplateIds]);
  }, [selectedProductionTemplateIds]);

  function moveTemplateUp(idx: number) {
    if (idx <= 0) return;
    setOrderedTemplateIds((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveTemplateDown(idx: number) {
    if (idx < 0 || idx >= orderedTemplateIds.length - 1) return;
    setOrderedTemplateIds((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  async function saveTemplateOrder() {
    if (orderedTemplateIds.length === 0) return;
    setSavingOrder(true);
    try {
      await saveFarmStructureProduction(farmId, orderedTemplateIds);
      onProductionOrderSaved?.(orderedTemplateIds);
    } catch (e) {
      alert(e instanceof Error ? e.message : '순서 저장 실패');
    } finally {
      setSavingOrder(false);
    }
  }

  function moveBarnUp(buildingId: string, barnIndex: number) {
    if (barnIndex <= 0) return;
    setTree((prev) => {
      const next = [...prev];
      const buildingIdx = next.findIndex((b) => b.id === buildingId);
      if (buildingIdx < 0) return prev;
      const building = { ...next[buildingIdx] };
      const barns = [...(building.barns ?? [])];
      [barns[barnIndex - 1], barns[barnIndex]] = [barns[barnIndex], barns[barnIndex - 1]];
      building.barns = barns;
      next[buildingIdx] = building;
      return next;
    });
  }

  function moveBarnDown(buildingId: string, barnIndex: number) {
    setTree((prev) => {
      const building = prev.find((b) => b.id === buildingId);
      if (!building || !building.barns || barnIndex >= building.barns.length - 1) return prev;
      const next = [...prev];
      const buildingIdx = next.findIndex((b) => b.id === buildingId);
      const updatedBuilding = { ...next[buildingIdx] };
      const barns = [...(updatedBuilding.barns ?? [])];
      [barns[barnIndex], barns[barnIndex + 1]] = [barns[barnIndex + 1], barns[barnIndex]];
      updatedBuilding.barns = barns;
      next[buildingIdx] = updatedBuilding;
      return next;
    });
  }

  async function handleMoveBarnUp(buildingId: string, barnIndex: number) {
    if (barnIndex <= 0) return;
    const building = tree.find((b) => b.id === buildingId);
    const barns = building?.barns ?? [];
    if (barnIndex >= barns.length) return;
    const newOrder = [...barns];
    [newOrder[barnIndex - 1], newOrder[barnIndex]] = [newOrder[barnIndex], newOrder[barnIndex - 1]];
    const barnIds = newOrder.map((b) => b.id);
    moveBarnUp(buildingId, barnIndex);
    try {
      await reorderFarmBarns(farmId, buildingId, barnIds);
      loadTree();
    } catch (e) {
      alert('순서 저장 실패: ' + (e instanceof Error ? e.message : '알 수 없는 오류'));
      loadTree();
    }
  }

  async function handleMoveBarnDown(buildingId: string, barnIndex: number) {
    const building = tree.find((b) => b.id === buildingId);
    const barns = building?.barns ?? [];
    if (barnIndex < 0 || barnIndex >= barns.length - 1) return;
    const newOrder = [...barns];
    [newOrder[barnIndex], newOrder[barnIndex + 1]] = [newOrder[barnIndex + 1], newOrder[barnIndex]];
    const barnIds = newOrder.map((b) => b.id);
    moveBarnDown(buildingId, barnIndex);
    try {
      await reorderFarmBarns(farmId, buildingId, barnIds);
      loadTree();
    } catch (e) {
      alert('순서 저장 실패: ' + (e instanceof Error ? e.message : '알 수 없는 오류'));
      loadTree();
    }
  }

  function loadTree() {
    setLoading(true);
    setError('');
    getFarmFacilitiesTree(farmId)
      .then((data) => {
        const nextTree = Array.isArray(data) ? data : [];
        setTree(nextTree);
        // 페이지 최초 진입 시에는 건물을 펼쳐 시설 레벨까지 기본 노출
        if (!hasInitializedExpandRef.current) {
          setExpandedBuilding(new Set(nextTree.map((b) => b.id)));
          setExpandedBarn(new Set());
          setExpandedRoom(new Set());
          hasInitializedExpandRef.current = true;
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : '트리를 불러오지 못했습니다.');
        setTree([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!farmId) return;
    hasInitializedExpandRef.current = false;
    setIsEditMode(false);
    setIsOpeningInputMode(false);
    loadTree();
  }, [farmId]);

  function normalizeDisplayName(raw: string | null | undefined, fallback: string): string {
    const v = raw?.trim();
    return v || fallback;
  }

  function extractYmd(value: unknown): string {
    if (typeof value === 'string') {
      const text = value.trim().slice(0, 10);
      return isValidYmdDate(text) ? text : '';
    }
    if (value instanceof Date) return toYmd(value);
    return '';
  }

  function getFacilityKind(name: string): OpeningFacilityKind {
    const v = name.trim();
    if (v.includes('교배사') || v.includes('임신사')) return 'breedingGestation';
    if (v.includes('분만사')) return 'farrowing';
    return 'other';
  }

  function parseSowNos(raw: string): string[] {
    return raw
      .split(/[\n,]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  function getOpeningDraft(sectionId: string): OpeningSectionDraft {
    return openingDraftBySection[sectionId] ?? { sowNos: '', headCount: 0, entryDate: '', birthDate: '', ageDays: null };
  }

  function isValidYmdDate(v: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(v);
  }

  function toYmd(date: Date): string {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function calcAgeDaysFromBirthDate(birthDate: string, asOfDate: string): number | null {
    if (!isValidYmdDate(birthDate) || !isValidYmdDate(asOfDate)) return null;
    const birth = new Date(`${birthDate}T00:00:00.000Z`);
    const asOf = new Date(`${asOfDate}T00:00:00.000Z`);
    if (Number.isNaN(birth.getTime()) || Number.isNaN(asOf.getTime())) return null;
    const diffMs = asOf.getTime() - birth.getTime();
    if (diffMs < 0) return null;
    return Math.floor(diffMs / 86400000);
  }

  function calcBirthDateFromAge(entryDate: string, ageDays: number | null): string {
    if (!isValidYmdDate(entryDate) || ageDays == null || ageDays < 0) return '';
    const base = new Date(`${entryDate}T00:00:00.000Z`);
    if (Number.isNaN(base.getTime())) return '';
    base.setUTCDate(base.getUTCDate() - ageDays);
    return toYmd(base);
  }

  function getOpeningRequiredState(kind: OpeningFacilityKind, draft: OpeningSectionDraft): OpeningRequiredState {
    const entryRequired = true;
    const sowRequired = kind === 'breedingGestation' || kind === 'farrowing';
    const headRequired = kind === 'farrowing' || kind === 'other';
    const birthOrAgeRequired = headRequired;
    const sowCount = parseSowNos(draft.sowNos).length;
    const entryValid = !entryRequired || isValidYmdDate(draft.entryDate);
    const sowValid = !sowRequired || sowCount > 0;
    const headValid = !headRequired || (Number.isFinite(draft.headCount) && draft.headCount > 0);
    const birthValid = isValidYmdDate(draft.birthDate);
    const ageValid = draft.ageDays != null && draft.ageDays >= 0 && entryValid;
    const birthOrAgeValid = !birthOrAgeRequired || birthValid || ageValid;
    return { entryRequired, sowRequired, headRequired, birthOrAgeRequired, sowCount, entryValid, sowValid, headValid, birthOrAgeValid };
  }

  function getRoomDisplayNameForOpening(room: FarmRoom): string {
    const rawName = room.name?.trim();
    if (rawName) {
      const roomMatch = rawName.match(/^Room\s*(\d+)$/i);
      if (roomMatch) return `${roomMatch[1]}번방`;
      const normalizedNumberMatch = rawName.match(/^(\d+)\s*[^\d\s]{1,4}$/);
      if (normalizedNumberMatch) return `${normalizedNumberMatch[1]}번방`;
      return rawName;
    }
    if (room.roomNumber != null) return `${room.roomNumber}번방`;
    return '방';
  }

  function getSectionDisplayNameForOpening(
    section: { name?: string | null; sectionNumber?: number | null },
    unitLabel: '칸' | '스톨'
  ): string {
    const formatByUnit = (num: string | number) => (unitLabel === '스톨' ? `스톨${num}` : `${num}번칸`);
    const rawName = section.name?.trim();
    if (rawName) {
      const sectionMatch = rawName.match(/^Section\s*(\d+)$/i);
      if (sectionMatch) return formatByUnit(sectionMatch[1]);
      const koreanSectionMatch = rawName.match(/^(\d+)\s*번칸$/);
      if (koreanSectionMatch) return formatByUnit(koreanSectionMatch[1]);
      const stallMatch = rawName.match(/^스톨\s*(\d+)$/);
      if (stallMatch) return formatByUnit(stallMatch[1]);
      const normalizedNumberMatch = rawName.match(/^(\d+)\s*[^\d\s]{1,6}$/);
      if (normalizedNumberMatch) return formatByUnit(normalizedNumberMatch[1]);
      return rawName;
    }
    if (section.sectionNumber != null) return formatByUnit(section.sectionNumber);
    return unitLabel;
  }

  const openingTargets = tree.flatMap((building) =>
    (building.barns ?? []).flatMap((barn) => {
      const facilityName = normalizeDisplayName(barn.name, '시설');
      const kind = getFacilityKind(facilityName);
      const templateDefaultAgeDays = typeof barn.structureTemplateId === 'number'
        ? (productionTemplateAgeDaysById.get(barn.structureTemplateId) ?? null)
        : null;
      return (barn.rooms ?? []).flatMap((room) => {
        const unitLabel: '칸' | '스톨' = room.housingMode === 'stall' ? '스톨' : '칸';
        const roomName = getRoomDisplayNameForOpening(room);
        return (room.sections ?? []).map((section) => ({
          sectionId: section.id,
          buildingName: normalizeDisplayName(building.name, '건물'),
          facilityName,
          roomName,
          sectionName: getSectionDisplayNameForOpening(section, unitLabel),
          unitLabel,
          kind,
          defaultAgeDays: (kind === 'farrowing' || kind === 'other') ? templateDefaultAgeDays : null,
          savedEntryDate: extractYmd(section.entryDate),
          savedHeadCount: Number.isFinite(Number(section.currentPigCount)) ? Number(section.currentPigCount) : 0,
        }));
      });
    })
  );

  const openingTargetBySectionId = new Map(openingTargets.map((t) => [t.sectionId, t] as const));
  const savedOpeningSectionIdSet = new Set(
    openingTargets
      .filter((t) => isValidYmdDate(t.savedEntryDate))
      .map((t) => t.sectionId)
  );

  function openOpeningSectionModal(sectionId: string) {
    const target = openingTargetBySectionId.get(sectionId);
    if (!target) return;
    setOpeningDraftBySection((prev) => {
      if (prev[sectionId]) return prev;
      return {
        ...prev,
        [sectionId]: {
          sowNos: '',
          headCount: target.savedHeadCount > 0 ? target.savedHeadCount : 0,
          entryDate: target.savedEntryDate || '',
          birthDate: '',
          ageDays: target.defaultAgeDays,
        },
      };
    });
    setOpeningSectionModal(target);
  }

  function updateOpeningSectionDraft(sectionId: string, patch: Partial<OpeningSectionDraft>) {
    setOpeningDraftBySection((prev) => {
      const current = prev[sectionId] ?? { sowNos: '', headCount: 0, entryDate: '', birthDate: '', ageDays: null };
      const nextDraft: OpeningSectionDraft = { ...current, ...patch };
      const hasBirthDatePatch = Object.prototype.hasOwnProperty.call(patch, 'birthDate');
      const hasEntryDatePatch = Object.prototype.hasOwnProperty.call(patch, 'entryDate');
      const hasAgeDaysPatch = Object.prototype.hasOwnProperty.call(patch, 'ageDays');

      if (hasEntryDatePatch && isValidYmdDate(nextDraft.entryDate)) {
        const target = openingTargetBySectionId.get(sectionId);
        let birthFromEntryAge = '';
        if (target?.defaultAgeDays != null && target.defaultAgeDays >= 0) {
          birthFromEntryAge = calcBirthDateFromAge(nextDraft.entryDate, target.defaultAgeDays);
        } else if (current.ageDays != null && current.ageDays >= 0) {
          birthFromEntryAge = calcBirthDateFromAge(nextDraft.entryDate, current.ageDays);
        } else if (isValidYmdDate(current.birthDate)) {
          birthFromEntryAge = current.birthDate;
        }
        if (birthFromEntryAge) {
          nextDraft.birthDate = birthFromEntryAge;
          const todayAge = calcAgeDaysFromBirthDate(birthFromEntryAge, toYmd(new Date()));
          if (todayAge != null) nextDraft.ageDays = todayAge;
        }
      } else if (!hasBirthDatePatch && hasAgeDaysPatch && nextDraft.ageDays != null && nextDraft.ageDays >= 0) {
        const birthFromTodayAge = calcBirthDateFromAge(toYmd(new Date()), nextDraft.ageDays);
        if (birthFromTodayAge) nextDraft.birthDate = birthFromTodayAge;
      }

      return { ...prev, [sectionId]: nextDraft };
    });
  }

  function isOpeningSectionComplete(sectionId: string): boolean {
    const target = openingTargetBySectionId.get(sectionId);
    if (!target) return false;
    const draft = getOpeningDraft(sectionId);
    const required = getOpeningRequiredState(target.kind, draft);
    return required.entryValid && required.sowValid && required.headValid && required.birthOrAgeValid;
  }

  function isOpeningSectionSaved(sectionId: string): boolean {
    return savedOpeningSectionIdSet.has(sectionId);
  }

  async function saveOpeningSection() {
    if (!farmId || !openingSectionModal) return;
    const sectionId = openingSectionModal.sectionId;
    const draft = getOpeningDraft(sectionId);
    const required = getOpeningRequiredState(openingSectionModal.kind, draft);
    if (!(required.entryValid && required.sowValid && required.headValid && required.birthOrAgeValid)) return;

    const sows = parseSowNos(draft.sowNos).map((sowNo) => ({ sowNo }));
    const calculatedBirthDate = calcBirthDateFromAge(draft.entryDate, draft.ageDays);
    const groupBirthDate = isValidYmdDate(draft.birthDate) ? draft.birthDate : calculatedBirthDate || undefined;
    const body = {
      kind: openingSectionModal.kind,
      entryDate: draft.entryDate,
      replaceExisting: isOpeningSectionSaved(sectionId),
      sows,
      group: (openingSectionModal.kind === 'farrowing' || openingSectionModal.kind === 'other')
        ? {
          headCount: draft.headCount,
          birthDate: groupBirthDate,
          ageDays: draft.ageDays ?? undefined,
        }
        : undefined,
    } as const;

    setOpeningSectionSaving(true);
    setOpeningResult('');
    try {
      const result = await saveFarmOpeningSection(farmId, sectionId, body);
      setOpeningResult(
        `${isOpeningSectionSaved(sectionId) ? '수정 저장 완료' : '저장 완료'}: ${openingSectionModal.sectionName} (모돈 ${result.sowCount}두, 돈군두수 ${result.headCount})`
      );
      setOpeningSectionModal(null);
      loadTree();
    } catch (e) {
      setOpeningResult(e instanceof Error ? e.message : '초기값 저장 실패');
    } finally {
      setOpeningSectionSaving(false);
    }
  }

  async function deleteOpeningSection() {
    if (!farmId || !openingSectionModal) return;
    const sectionId = openingSectionModal.sectionId;
    if (!isOpeningSectionSaved(sectionId)) {
      setOpeningResult('삭제할 초기값이 없습니다.');
      return;
    }
    if (!confirm(`${openingSectionModal.sectionName} 초기값을 삭제할까요?\n(연결된 opening 원장/돈군/이동/일정 실행도 함께 정리됩니다)`)) return;
    setOpeningSectionDeleting(true);
    setOpeningResult('');
    try {
      const res = await deleteFarmOpeningSection(farmId, sectionId);
      setOpeningDraftBySection((prev) => {
        const next = { ...prev };
        delete next[sectionId];
        return next;
      });
      setOpeningResult(
        `삭제 완료: ${openingSectionModal.sectionName} (원장 ${res.ledgerRowsDeleted}건, 돈군 ${res.groupRowsDeleted}건, 일정 ${res.scheduleExecutionRowsDeleted}건)`
      );
      setOpeningSectionModal(null);
      loadTree();
    } catch (e) {
      setOpeningResult(e instanceof Error ? e.message : '초기값 삭제 실패');
    } finally {
      setOpeningSectionDeleting(false);
    }
  }

  function toggleBuilding(id: string) {
    setExpandedBuilding((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleBarn(id: string) {
    setExpandedBarn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleRoom(id: string) {
    setExpandedRoom((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openAddBuildingModal() {
    if (!hasSavedProductionSelection) {
      setShowProductionRequiredModal(true);
      return;
    }
    setShowAddBuilding(true);
  }

  function handleAddBuilding() {
    if (!newBuildingName.trim()) return;
    setAddingBuilding(true);
    createFarmBuilding(farmId, { name: newBuildingName.trim() })
      .then(() => {
        setNewBuildingName('');
        setShowAddBuilding(false);
        loadTree();
      })
      .catch((e) => alert(e instanceof Error ? e.message : '건물 추가 실패'))
      .finally(() => setAddingBuilding(false));
  }

  function handleAddBarn(buildingId: string) {
    const normalizedBarnName = barnName.trim();
    if (barnCategory === 'support' && normalizedBarnName === '') {
      alert('일반 시설은 이름이 필수입니다.');
      return;
    }
    setAddingBarn(true);
    const templateId = barnCategory === 'production' && barnTemplateId !== '' ? Number(barnTemplateId) : undefined;
    createFarmBarn(farmId, buildingId, {
      structureTemplateId: templateId,
      category: barnCategory,
      name: barnCategory === 'support' ? normalizedBarnName : undefined,
      roomCount: barnRoomCount > 0 ? barnRoomCount : 0,
    })
      .then(() => {
        setShowAddBarn(null);
        setBarnName('');
        setBarnTemplateId('');
        setBarnRoomCount(1);
        loadTree();
      })
      .catch((e) => alert(e instanceof Error ? e.message : '시설 추가 실패'))
      .finally(() => setAddingBarn(false));
  }

  function handleRoomsBulk(barnId: string) {
    if (roomBulkCount < 1 || roomBulkCount > 200) {
      alert('방 개수는 1~200 사이로 입력하세요.');
      return;
    }
    setAddingRooms(true);
    createFarmRoomsBulk(farmId, barnId, roomBulkCount)
      .then(() => {
        setRoomBulkBarnId(null);
        setRoomBulkCount(5);
        loadTree();
      })
      .catch((e) => alert(e instanceof Error ? e.message : '방 추가 실패'))
      .finally(() => setAddingRooms(false));
  }

  function handleDeleteBuilding(buildingId: string) {
    if (!confirm('이 건물과 하위 시설을 모두 삭제할까요?')) return;
    deleteFarmBuilding(farmId, buildingId)
      .then(loadTree)
      .catch((e) => alert(e instanceof Error ? e.message : '삭제 실패'));
  }
  function handleDeleteBarn(barnId: string) {
    if (!confirm('이 시설과 하위 방/칸을 모두 삭제할까요?')) return;
    deleteFarmBarn(farmId, barnId)
      .then(loadTree)
      .catch((e) => alert(e instanceof Error ? e.message : '삭제 실패'));
  }
  function openRoomConfigModal(params: {
    roomId: string;
    facilityName: string;
    roomName: string;
    currentMode: 'stall' | 'group';
    currentCount: number;
    allowModeSelection: boolean;
  }) {
    const safeCount = Math.max(1, Math.min(500, params.currentCount || 1));
    setRoomConfigModal(params);
    setRoomConfigMode(params.allowModeSelection ? params.currentMode : 'group');
    setRoomConfigCount(safeCount);
  }

  function closeRoomConfigModal() {
    if (savingRoomConfig) return;
    setRoomConfigModal(null);
  }

  function saveRoomConfig() {
    if (!roomConfigModal) return;
    if (roomConfigCount < 1 || roomConfigCount > 500) {
      const unitLabel = roomConfigMode === 'stall' ? '스톨' : '칸';
      alert(`${unitLabel} 개수는 1~500 사이로 입력하세요.`);
      return;
    }
    setSavingRoomConfig(true);
    const modeChanged = roomConfigModal.allowModeSelection && roomConfigModal.currentMode !== roomConfigMode;
    const roomId = roomConfigModal.roomId;
    const saveMode = modeChanged
      ? updateFarmRoom(farmId, roomId, { housingMode: roomConfigMode })
      : Promise.resolve({ message: 'unchanged' });

    saveMode
      .then(() => createFarmSectionsBulk(farmId, roomId, roomConfigCount))
      .then(() => {
        setRoomConfigModal(null);
        loadTree();
      })
      .catch((e) => alert(e instanceof Error ? e.message : '운영방식/개수 저장 실패'))
      .finally(() => setSavingRoomConfig(false));
  }

  const openingModalDraft: OpeningSectionDraft = openingSectionModal
    ? getOpeningDraft(openingSectionModal.sectionId)
    : { sowNos: '', headCount: 0, entryDate: '', birthDate: '', ageDays: null };
  const openingModalRequired: OpeningRequiredState | null = openingSectionModal
    ? getOpeningRequiredState(openingSectionModal.kind, openingModalDraft)
    : null;
  const openingModalCalculatedBirthDate = isValidYmdDate(openingModalDraft.birthDate)
    ? openingModalDraft.birthDate
    : calcBirthDateFromAge(openingModalDraft.entryDate, openingModalDraft.ageDays);
  const openingModalMissingItems: string[] = openingModalRequired
    ? [
      openingModalRequired.entryRequired && !openingModalRequired.entryValid ? '전입일' : '',
      openingModalRequired.sowRequired && !openingModalRequired.sowValid ? '모돈번호' : '',
      openingModalRequired.headRequired && !openingModalRequired.headValid ? '두수' : '',
      openingModalRequired.birthOrAgeRequired && !openingModalRequired.birthOrAgeValid ? '출생일 또는 일령' : '',
    ].filter(Boolean)
    : [];
  const openingModalSaveDisabled = !!openingSectionModal && (openingModalMissingItems.length > 0 || openingSectionSaving);
  const openingModalAlreadySaved = !!openingSectionModal && isOpeningSectionSaved(openingSectionModal.sectionId);

  return (
    <div style={{ width: 460, flexShrink: 0, display: 'flex', flexDirection: 'column', fontSize: BODY_FONT_SIZE, color: '#1e293b' }}>
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            minHeight: SECTION_TITLE_HEIGHT,
            background: SECTION_TITLE_BG,
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0c4a6e' }}>농장 구조 설정</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isEditMode ? (
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                style={{ padding: '8px 16px', fontSize: 15, background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                수정
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openAddBuildingModal}
                  style={{
                    padding: '8px 18px',
                    fontSize: 15,
                    fontWeight: 500,
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  + 건물 추가
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpeningInputMode((prev) => !prev)}
                  style={{
                    padding: '8px 14px',
                    fontSize: 15,
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: isOpeningInputMode ? '#16a34a' : '#dbeafe',
                    color: isOpeningInputMode ? '#fff' : '#1d4ed8',
                  }}
                >
                  초기값 설정
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditMode(false);
                    setIsOpeningInputMode(false);
                  }}
                  style={{ padding: '8px 14px', fontSize: 15, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#dc2626', color: '#ffffff' }}
                >
                  종료
                </button>
              </>
            )}
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 12, minHeight: 200 }}>
          {loading && <p style={{ color: '#64748b', fontSize: 15 }}>로딩 중...</p>}
          {error && <p style={{ color: '#b91c1c', fontSize: 15 }}>{error}</p>}
          {!loading && !error && tree.length === 0 && (
            <p style={{ color: '#64748b', fontSize: 15 }}>건물이 없습니다. &quot;건물 추가&quot;로 추가하세요.</p>
          )}
          {!loading && !error && tree.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tree.map((building) => {
                const buildingHasChildren = (building.barns?.length ?? 0) > 0;
                return (
                <div key={building.id} style={{ border: '1px solid #dbe4ee', borderRadius: 10, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      background: '#f1f5f9',
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleBuilding(building.id)}
                  >
                    {buildingHasChildren ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBuilding(building.id);
                        }}
                        style={treeToggleBtnStyle(expandedBuilding.has(building.id))}
                        aria-label={expandedBuilding.has(building.id) ? '접기' : '펼치기'}
                        title={expandedBuilding.has(building.id) ? '접기' : '펼치기'}
                      >
                        {expandedBuilding.has(building.id) ? '▾' : '▸'}
                      </button>
                    ) : (
                      <span style={TREE_TOGGLE_PLACEHOLDER_STYLE} />
                    )}
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{building.name || '건물'}</span>
                    <span style={{ color: '#64748b', fontSize: 14 }}>
                      시설 {building.barns?.length ?? 0}개
                    </span>
                    {isEditMode && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAddBarn(building.id);
                            setBarnName('');
                            setBarnTemplateId(templates[0]?.id ?? '');
                            setBarnRoomCount(1);
                          }}
                          style={{
                            marginLeft: 'auto',
                            padding: '6px 10px',
                            fontSize: 15,
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        >
                          + 시설 추가
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBuilding(building.id);
                          }}
                          style={{
                            padding: '6px 10px',
                            fontSize: 15,
                            background: '#fef2f2',
                            color: '#b91c1c',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </div>
                  {expandedBuilding.has(building.id) && (
                    <div style={{ padding: '10px 10px 10px 24px', background: '#fff' }}>
                      {(building.barns ?? []).map((barn, barnIndex) => (
                        <BarnRow
                          key={barn.id}
                          barn={barn}
                          templateNameById={productionTemplateNameById}
                          templateColorById={productionTemplateColorById}
                          expanded={expandedBarn.has(barn.id)}
                          onToggle={() => toggleBarn(barn.id)}
                          onAddRooms={(currentCount, targetLabel) => {
                            setRoomBulkBarnId(barn.id);
                            setRoomBulkCurrentCount(currentCount);
                            setRoomBulkTargetLabel(targetLabel || `${(barn.name || '돈사').trim() || '돈사'}`);
                            setRoomBulkCount(Math.max(1, Math.min(200, currentCount || 1)));
                          }}
                          onOpenRoomConfigModal={openRoomConfigModal}
                          expandedRoom={expandedRoom}
                          toggleRoom={toggleRoom}
                          onDeleteBarn={() => handleDeleteBarn(barn.id)}
                          onOpenOpeningSectionModal={openOpeningSectionModal}
                          hasOpeningInput={(sectionId) => isOpeningSectionSaved(sectionId) || isOpeningSectionComplete(sectionId)}
                          openingInputEnabled={isOpeningInputMode}
                          onMoveBarnUp={barnIndex > 0 ? () => handleMoveBarnUp(building.id, barnIndex) : undefined}
                          onMoveBarnDown={barnIndex < (building.barns?.length ?? 1) - 1 ? () => handleMoveBarnDown(building.id, barnIndex) : undefined}
                          isEditMode={isEditMode}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}
          {openingResult && <p style={{ margin: '8px 0 0', fontSize: 13, color: '#334155' }}>{openingResult}</p>}
        </div>
      </div>

      {/* 사육시설 저장 안내 모달 */}
      {showProductionRequiredModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              minWidth: 360,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '12px 16px', background: '#e0f2fe', borderBottom: '1px solid #bae6fd' }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#0c4a6e' }}>안내</h3>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ margin: 0, fontSize: 15, color: '#334155', lineHeight: 1.5 }}>
                사육시설이 저장되어 있지 않으면 건물을 추가할 수 없습니다.
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 15, color: '#334155', lineHeight: 1.5 }}>
                사육시설선택을 수정 버튼 누르고 선택 저장하시기 바랍니다.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowProductionRequiredModal(false)}
                  style={{ padding: '8px 16px', fontSize: 15, background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddBuilding && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              minWidth: 320,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '12px 16px', background: '#e0f2fe', borderBottom: '1px solid #bae6fd' }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#0c4a6e' }}>건물 추가</h3>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 15, marginBottom: 4, color: '#475569' }}>건물명</label>
                <input
                  type="text"
                  value={newBuildingName}
                  onChange={(e) => setNewBuildingName(e.target.value)}
                  placeholder="예: 1동"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 15 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddBuilding(false)} style={{ padding: '8px 16px', fontSize: 15, background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                  취소
                </button>
                <button type="button" onClick={handleAddBuilding} disabled={addingBuilding || !newBuildingName.trim()} style={{ padding: '8px 16px', fontSize: 15, background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                  {addingBuilding ? '추가 중...' : '추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 시설 추가 모달 */}
      {showAddBarn && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              minWidth: 340,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '12px 16px', background: '#e0f2fe', borderBottom: '1px solid #bae6fd' }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#0c4a6e' }}>시설 추가</h3>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 15, color: '#475569', marginRight: 12 }}>시설 유형</span>
                <label style={{ marginRight: 16 }}>
                  <input type="radio" checked={barnCategory === 'production'} onChange={() => setBarnCategory('production')} /> 사육시설
                </label>
                <label>
                  <input type="radio" checked={barnCategory === 'support'} onChange={() => setBarnCategory('support')} /> 일반 시설
                </label>
              </div>
              {barnCategory === 'production' && templates.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 15, marginBottom: 4, color: '#475569' }}>사육시설 선택</label>
                  <select
                    value={barnTemplateId}
                    onChange={(e) => setBarnTemplateId(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 15 }}
                  >
                    <option value="">선택</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {barnCategory === 'production' && templates.length === 0 && (
                <p style={{ marginBottom: 12, fontSize: 15, color: '#b45309' }}>
                  농장에서 선택 저장된 사육시설 목록이 없습니다.
                </p>
              )}
              {barnCategory === 'support' && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 15, marginBottom: 4, color: '#475569' }}>일반 시설 이름 *</label>
                  <input
                    type="text"
                    value={barnName}
                    onChange={(e) => setBarnName(e.target.value)}
                    placeholder="예: 창고동"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 15 }}
                  />
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 15, marginBottom: 4, color: '#475569' }}>방 개수 (각 돈사에 1번방~N번방 생성)</label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={barnRoomCount}
                  onChange={(e) => setBarnRoomCount(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 15 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddBarn(null)} style={{ padding: '8px 16px', fontSize: 15, background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => showAddBarn && handleAddBarn(showAddBarn)}
                  disabled={addingBarn || (barnCategory === 'production' && barnTemplateId === '') || (barnCategory === 'support' && !barnName.trim())}
                  style={{ padding: '8px 16px', fontSize: 15, background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >
                  {addingBarn ? '추가 중...' : '추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 방 일괄 추가 모달 */}
      {roomBulkBarnId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              minWidth: 300,
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '12px 16px', background: '#e0f2fe', borderBottom: '1px solid #bae6fd' }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#0c4a6e' }}>
                {roomBulkCurrentCount === 0 ? '방 추가' : '방 갯수 변경'}
              </h3>
            </div>
            <div style={{ padding: 24 }}>
              {roomBulkTargetLabel && (
                <p style={{ fontSize: 14, color: '#475569', marginBottom: 10 }}>
                  대상: <strong>{roomBulkTargetLabel}</strong>
                </p>
              )}
              <p style={{ fontSize: 15, color: '#64748b', marginBottom: 6 }}>현재 방 개수: {roomBulkCurrentCount}개</p>
              <p style={{ fontSize: 15, color: '#64748b', marginBottom: 12 }}>변경할 방 개수를 입력하세요.</p>
              <input
                type="number"
                min={1}
                max={200}
                value={roomBulkCount}
                onChange={(e) => setRoomBulkCount(parseInt(e.target.value, 10) || 1)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 16, fontSize: 15 }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setRoomBulkBarnId(null)} style={{ padding: '8px 16px', fontSize: 15, background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer' }}>취소</button>
                <button type="button" onClick={() => roomBulkBarnId && handleRoomsBulk(roomBulkBarnId)} disabled={addingRooms} style={{ padding: '8px 16px', fontSize: 15, background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                  {addingRooms ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 초기입력 섹션 입력 모달 */}
      {openingSectionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              minWidth: 420,
              maxWidth: 520,
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '12px 16px', background: '#e0f2fe', borderBottom: '1px solid #bae6fd' }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#0c4a6e' }}>초기입력 상세</h3>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ margin: 0, fontSize: 14, color: '#475569' }}>
                대상: <strong>{openingSectionModal.buildingName}</strong> / <strong>{openingSectionModal.facilityName}</strong> / <strong>{openingSectionModal.roomName}</strong> / <strong>{openingSectionModal.sectionName}</strong>
              </p>
              <p style={{ margin: '6px 0 12px', fontSize: 13, color: '#64748b' }}>
                입력 유형: {openingSectionModal.kind === 'breedingGestation' ? '모돈 정보' : openingSectionModal.kind === 'farrowing' ? '모돈 + 자돈(돈군) 정보' : '돈군 정보'}
              </p>
              {openingModalRequired && (
                <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff1f2' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>필수 입력 항목</p>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {openingModalRequired.entryRequired && (
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
                        전입일 *
                      </span>
                    )}
                    {openingModalRequired.sowRequired && (
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
                        모돈번호 *
                      </span>
                    )}
                    {openingModalRequired.headRequired && (
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
                        두수 *
                      </span>
                    )}
                    {openingModalRequired.birthOrAgeRequired && (
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
                        출생일 또는 일령 *
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 14, marginBottom: 6, color: '#475569' }}>
                  전입일{openingModalRequired?.entryRequired ? <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span> : null}
                </label>
                <input
                  type="date"
                  value={openingModalDraft.entryDate}
                  onChange={(e) => updateOpeningSectionDraft(openingSectionModal.sectionId, { entryDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: openingModalRequired?.entryRequired && !openingModalRequired.entryValid ? '1px solid #f87171' : '1px solid #cbd5e1',
                    fontSize: 14,
                  }}
                />
              </div>
              {(openingSectionModal.kind === 'breedingGestation' || openingSectionModal.kind === 'farrowing') && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 14, marginBottom: 6, color: '#475569' }}>
                    모돈번호 목록 (쉼표/줄바꿈 구분){openingModalRequired?.sowRequired ? <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span> : null}
                  </label>
                  <textarea
                    value={openingModalDraft.sowNos}
                    onChange={(e) => updateOpeningSectionDraft(openingSectionModal.sectionId, { sowNos: e.target.value })}
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: openingModalRequired?.sowRequired && !openingModalRequired.sowValid ? '1px solid #f87171' : '1px solid #cbd5e1',
                      fontSize: 14,
                      resize: 'vertical',
                    }}
                  />
                </div>
              )}
              {(openingSectionModal.kind === 'farrowing' || openingSectionModal.kind === 'other') && (
                <>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, marginBottom: 6, color: '#475569' }}>
                      두수{openingModalRequired?.headRequired ? <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span> : null}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={openingModalDraft.headCount}
                      onChange={(e) => updateOpeningSectionDraft(openingSectionModal.sectionId, { headCount: parseInt(e.target.value, 10) || 0 })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: openingModalRequired?.headRequired && !openingModalRequired.headValid ? '1px solid #f87171' : '1px solid #cbd5e1',
                        fontSize: 14,
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                      돈군번호는 저장 시 자동 생성됩니다.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, marginBottom: 6, color: '#475569' }}>
                      출생일{openingModalRequired?.birthOrAgeRequired ? <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span> : null}
                    </label>
                    <input
                      type="date"
                      value={openingModalDraft.birthDate}
                      onChange={(e) => updateOpeningSectionDraft(openingSectionModal.sectionId, { birthDate: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: openingModalRequired?.birthOrAgeRequired && !openingModalRequired.birthOrAgeValid ? '1px solid #f87171' : '1px solid #cbd5e1',
                        fontSize: 14,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, marginBottom: 6, color: '#475569' }}>일령(일, 오늘 기준)</label>
                    <input
                      type="number"
                      min={0}
                      value={openingModalDraft.ageDays ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        updateOpeningSectionDraft(openingSectionModal.sectionId, { ageDays: raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0) });
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: openingModalRequired?.birthOrAgeRequired && !openingModalRequired.birthOrAgeValid ? '1px solid #f87171' : '1px solid #cbd5e1',
                        fontSize: 14,
                      }}
                    />
                  </div>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>
                  {openingModalCalculatedBirthDate ? `일령 기준 계산 출생일: ${openingModalCalculatedBirthDate}` : '출생일 직접 입력 또는 일령 입력 중 하나는 필수입니다.'}
                </p>
                </>
              )}
              {openingModalMissingItems.length > 0 && (
                <p style={{ margin: '0 0 12px', fontSize: 13, color: '#b91c1c' }}>
                  필수 입력 항목을 확인하세요: {openingModalMissingItems.join(', ')}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setOpeningSectionModal(null)} style={{ padding: '8px 16px', fontSize: 15, background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer' }}>닫기</button>
                {openingModalAlreadySaved ? (
                  <button
                    type="button"
                    onClick={deleteOpeningSection}
                    disabled={openingSectionSaving || openingSectionDeleting}
                    style={{
                      padding: '8px 16px',
                      fontSize: 15,
                      background: '#dc2626',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: openingSectionSaving || openingSectionDeleting ? 'not-allowed' : 'pointer',
                      opacity: openingSectionSaving || openingSectionDeleting ? 0.7 : 1,
                    }}
                  >
                    {openingSectionDeleting ? '삭제 중...' : '삭제'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={saveOpeningSection}
                  disabled={openingModalSaveDisabled || openingSectionDeleting}
                  style={{
                    padding: '8px 16px',
                    fontSize: 15,
                    background: openingModalSaveDisabled || openingSectionDeleting ? '#94a3b8' : '#0284c7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: openingModalSaveDisabled || openingSectionDeleting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {openingSectionSaving ? (openingModalAlreadySaved ? '수정 저장 중...' : '저장 중...') : (openingModalAlreadySaved ? '수정 저장' : '저장')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 방 운영방식/개수 설정 모달 */}
      {roomConfigModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              minWidth: 340,
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '12px 16px', background: '#e0f2fe', borderBottom: '1px solid #bae6fd' }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#0c4a6e' }}>
                운영방식/개수 설정
              </h3>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ fontSize: 14, color: '#475569', marginBottom: 10 }}>
                대상: <strong>{roomConfigModal.facilityName}</strong> / <strong>{roomConfigModal.roomName}</strong>
              </p>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 14, marginBottom: 6, color: '#475569' }}>운영방식</label>
                {roomConfigModal.allowModeSelection ? (
                  <select
                    value={roomConfigMode}
                    onChange={(e) => setRoomConfigMode(e.target.value as 'stall' | 'group')}
                    disabled={savingRoomConfig}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 15 }}
                  >
                    <option value="group">군사</option>
                    <option value="stall">스톨</option>
                  </select>
                ) : (
                  <div style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 15 }}>
                    군사 (고정)
                  </div>
                )}
              </div>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 6 }}>
                현재 {roomConfigMode === 'stall' ? '스톨' : '칸'} 개수: {roomConfigModal.currentCount}개
              </p>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 12 }}>
                변경할 {roomConfigMode === 'stall' ? '스톨' : '칸'} 개수를 입력하세요.
              </p>
              <input
                type="number"
                min={1}
                max={500}
                value={roomConfigCount}
                onChange={(e) => setRoomConfigCount(parseInt(e.target.value, 10) || 1)}
                disabled={savingRoomConfig}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 16, fontSize: 15 }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeRoomConfigModal} style={{ padding: '8px 16px', fontSize: 15, background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer' }}>취소</button>
                <button type="button" onClick={saveRoomConfig} disabled={savingRoomConfig} style={{ padding: '8px 16px', fontSize: 15, background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                  {savingRoomConfig ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BarnRow({
  barn,
  templateNameById,
  templateColorById,
  expanded,
  onToggle,
  onAddRooms,
  onOpenRoomConfigModal,
  expandedRoom,
  toggleRoom,
  onDeleteBarn,
  onOpenOpeningSectionModal,
  hasOpeningInput,
  openingInputEnabled,
  onMoveBarnUp,
  onMoveBarnDown,
  isEditMode = false,
}: {
  barn: FarmBarn;
  templateNameById: Map<number, string>;
  templateColorById: Map<number, string | null>;
  expanded: boolean;
  onToggle: () => void;
  onAddRooms: (currentCount: number, targetLabel: string) => void;
  onOpenRoomConfigModal: (params: {
    roomId: string;
    facilityName: string;
    roomName: string;
    currentMode: 'stall' | 'group';
    currentCount: number;
    allowModeSelection: boolean;
  }) => void;
  expandedRoom: Set<string>;
  toggleRoom: (id: string) => void;
  onDeleteBarn: () => void;
  onOpenOpeningSectionModal: (sectionId: string) => void;
  hasOpeningInput: (sectionId: string) => boolean;
  openingInputEnabled: boolean;
  onMoveBarnUp?: () => void;
  onMoveBarnDown?: () => void;
  isEditMode?: boolean;
}) {
  const mappedTemplateName = barn.structureTemplateId
    ? templateNameById.get(barn.structureTemplateId)
    : undefined;
  const mappedTemplateColor = barn.structureTemplateId
    ? templateColorById.get(barn.structureTemplateId)
    : null;
  const roomCount = barn.rooms?.length ?? 0;
  const barnHasChildren = roomCount > 0;
  const displayName = mappedTemplateName || barn.name || '돈사';
  const templateSuffix = mappedTemplateName
    ? ''
    : (barn.structureTemplateId ? ` (템플릿 ${barn.structureTemplateId})` : '');
  const barnHeaderBg = mappedTemplateColor ? hexToRgba(mappedTemplateColor, 0.18) : '#f1f5f9';
  const barnBorder = mappedTemplateColor ? hexToRgba(mappedTemplateColor, 0.55) : '#e2e8f0';

  function getRoomDisplayName(room: FarmRoom): string {
    const rawName = room.name?.trim();
    if (rawName) {
      const roomMatch = rawName.match(/^Room\s*(\d+)$/i);
      if (roomMatch) return `${roomMatch[1]}번방`;

      // 과거 데이터의 깨진 방명도 숫자 기준으로 정규화
      const normalizedNumberMatch = rawName.match(/^(\d+)\s*[^\d\s]{1,4}$/);
      if (normalizedNumberMatch) return `${normalizedNumberMatch[1]}번방`;

      return rawName;
    }
    if (room.roomNumber != null) return `${room.roomNumber}번방`;
    return '방';
  }

  function getSectionDisplayName(
    sec: { name?: string | null; sectionNumber?: number | null },
    unitLabel: '칸' | '스톨'
  ): string {
    const formatByUnit = (num: string | number) => (unitLabel === '스톨' ? `스톨${num}` : `${num}번칸`);
    const rawName = sec.name?.trim();
    if (rawName) {
      const sectionMatch = rawName.match(/^Section\s*(\d+)$/i);
      if (sectionMatch) return formatByUnit(sectionMatch[1]);
      const koreanSectionMatch = rawName.match(/^(\d+)\s*번칸$/);
      if (koreanSectionMatch) return formatByUnit(koreanSectionMatch[1]);
      const stallMatch = rawName.match(/^스톨\s*(\d+)$/);
      if (stallMatch) return formatByUnit(stallMatch[1]);
      // Legacy mojibake names like "1踰덉뭏" -> normalize by leading number.
      const normalizedNumberMatch = rawName.match(/^(\d+)\s*[^\d\s]{1,6}$/);
      if (normalizedNumberMatch) return formatByUnit(normalizedNumberMatch[1]);
      return rawName;
    }
    if (sec.sectionNumber != null) return formatByUnit(sec.sectionNumber);
    return unitLabel;
  }

  function getRoomUnitLabel(room: FarmRoom): '칸' | '스톨' {
    return room.housingMode === 'stall' ? '스톨' : '칸';
  }

  /** 사육시설(비육사·육성사·교배사·임신사·분만사 등)이면 스톨/군사 운영방식 선택 가능 */
  function isProductionBarn(barn: FarmBarn): boolean {
    if (barn.structureTemplateId != null) return true;
    return /^[0-9]+$/.test(String(barn.barnType ?? ''));
  }

  return (
    <div key={barn.id} style={{ marginBottom: 8, border: `1px solid ${barnBorder}`, borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          background: barnHeaderBg,
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        {barnHasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            style={treeToggleBtnStyle(expanded)}
            aria-label={expanded ? '접기' : '펼치기'}
            title={expanded ? '접기' : '펼치기'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span style={TREE_TOGGLE_PLACEHOLDER_STYLE} />
        )}
        <span style={{ fontSize: 15, fontWeight: 600 }}>{displayName}{templateSuffix}</span>
        <span style={{ color: '#64748b', fontSize: 14 }}>방 {roomCount}개</span>
        {isEditMode && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); onAddRooms(roomCount, `${displayName}${templateSuffix}`); }} style={{ marginLeft: 'auto', padding: '5px 10px', fontSize: 14, background: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              {roomCount === 0 ? '방 추가' : '방 갯수 변경'}
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteBarn(); }} style={{ padding: '5px 10px', fontSize: 14, background: '#fef2f2', color: '#b91c1c', border: 'none', borderRadius: 6, cursor: 'pointer' }}>삭제</button>
          </>
        )}
        {(onMoveBarnUp || onMoveBarnDown) && isEditMode && (
          <span style={{ display: 'flex', gap: 2 }}>
            {onMoveBarnUp ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveBarnUp?.();
                }}
                style={{
                  width: 22,
                  height: 22,
                  border: '1px solid #cbd5e1',
                  borderRadius: 4,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="위로"
              >
                ↑
              </button>
            ) : (
              <span style={{ width: 22, height: 22 }} />
            )}
            {onMoveBarnDown ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveBarnDown?.();
                }}
                style={{
                  width: 22,
                  height: 22,
                  border: '1px solid #cbd5e1',
                  borderRadius: 4,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="아래로"
              >
                ↓
              </button>
            ) : (
              <span style={{ width: 22, height: 22 }} />
            )}
          </span>
        )}
      </div>
      {expanded && (
        <div style={{ padding: '8px 8px 8px 20px', background: '#fff' }}>
          {(barn.rooms ?? []).map((room: FarmRoom) => {
            const sectionCount = room.sections?.length ?? 0;
            const roomHasChildren = sectionCount > 0;
            const allowModeSelection = isProductionBarn(barn);
            const roomUnitLabel: '칸' | '스톨' = allowModeSelection ? getRoomUnitLabel(room) : '칸';
            const roomHousingMode: 'stall' | 'group' = room.housingMode === 'stall' ? 'stall' : 'group';
            return (
              <div key={room.id} style={{ marginBottom: 6 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 8px',
                    background: '#f8fafc',
                    borderRadius: 6,
                    cursor: roomHasChildren ? 'pointer' : 'default',
                  }}
                  onClick={roomHasChildren ? () => toggleRoom(room.id) : undefined}
                >
                  {roomHasChildren ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRoom(room.id);
                      }}
                      style={treeToggleBtnStyle(expandedRoom.has(room.id))}
                      aria-label={expandedRoom.has(room.id) ? '접기' : '펼치기'}
                      title={expandedRoom.has(room.id) ? '접기' : '펼치기'}
                    >
                      {expandedRoom.has(room.id) ? '▾' : '▸'}
                    </button>
                  ) : (
                    <span style={TREE_TOGGLE_PLACEHOLDER_STYLE} />
                  )}
                  <span style={{ fontSize: 15 }}>{getRoomDisplayName(room)}</span>
                  <span style={{ color: '#64748b', fontSize: 14 }}>{roomUnitLabel} {sectionCount}개</span>
                  <span style={{ color: '#64748b', fontSize: 14 }}>
                    {allowModeSelection ? (roomHousingMode === 'stall' ? '스톨' : '군사') : '군사'}
                  </span>
                  {isEditMode && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenRoomConfigModal({
                          roomId: room.id,
                          facilityName: `${displayName}${templateSuffix}`,
                          roomName: getRoomDisplayName(room),
                          currentMode: allowModeSelection ? roomHousingMode : 'group',
                          currentCount: sectionCount,
                          allowModeSelection,
                        });
                        }}
                        style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: 14, background: '#dcfce7', color: '#166534', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                      >
                        {allowModeSelection ? '운영방식' : '칸 갯수 변경'}
                      </button>
                    </>
                  )}
                </div>
                {expandedRoom.has(room.id) && (
                  <div
                    style={{
                      marginLeft: 20,
                      marginTop: 6,
                      padding: '8px 10px',
                      background: isEditMode && openingInputEnabled ? '#fffbeb' : '#f8fafc',
                      border: isEditMode && openingInputEnabled ? '1px solid #fcd34d' : '1px solid #e2e8f0',
                      borderRadius: 6,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                    }}
                  >
                    {(room.sections ?? []).length === 0 && (
                      <span style={{ fontSize: 15, color: '#94a3b8' }}>등록된 {roomUnitLabel}이 없습니다.</span>
                    )}
                    {isEditMode
                      ? (room.sections ?? []).map((sec) => (
                          <button
                            key={sec.id}
                            type="button"
                            onClick={() => openingInputEnabled && onOpenOpeningSectionModal(sec.id)}
                            disabled={!openingInputEnabled}
                            title="초기입력"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 8px',
                              borderRadius: 999,
                              border: `1px solid ${!openingInputEnabled ? '#cbd5e1' : (hasOpeningInput(sec.id) ? '#86efac' : '#bfdbfe')}`,
                              background: !openingInputEnabled ? '#f1f5f9' : (hasOpeningInput(sec.id) ? '#dcfce7' : '#fef3c7'),
                              color: !openingInputEnabled ? '#94a3b8' : (hasOpeningInput(sec.id) ? '#166534' : '#92400e'),
                              fontSize: 15,
                              lineHeight: 1.4,
                              cursor: openingInputEnabled ? 'pointer' : 'not-allowed',
                            }}
                          >
                            {getSectionDisplayName(sec, roomUnitLabel)}
                          </button>
                        ))
                      : (room.sections ?? []).map((sec) => (
                          <span
                            key={sec.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 8px',
                              borderRadius: 999,
                              border: '1px solid #e2e8f0',
                              background: '#f1f5f9',
                              color: '#64748b',
                              fontSize: 15,
                            }}
                          >
                            {getSectionDisplayName(sec, roomUnitLabel)}
                          </span>
                        ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


