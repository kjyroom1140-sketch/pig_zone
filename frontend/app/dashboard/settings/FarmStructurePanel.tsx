'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getFarmFacilitiesTree,
  createFarmBuilding,
  createFarmBarn,
  createFarmRoomsBulk,
  createFarmSectionsBulk,
  deleteFarmBuilding,
  deleteFarmBarn,
  deleteFarmRoom,
  type FarmBuilding,
  type FarmBarn,
  type FarmRoom,
  type StructureTemplate,
} from '@/lib/api';

const SECTION_TITLE_HEIGHT = 48;
const SECTION_TITLE_BG = '#e0f2fe';
const BODY_FONT_SIZE = 15;

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

type Props = {
  farmId: string;
  productionTemplates?: StructureTemplate[] | null;
  hasSavedProductionSelection?: boolean;
  selectedProductionTemplateIds?: number[];
};

export default function FarmStructurePanel({
  farmId,
  productionTemplates = [],
  hasSavedProductionSelection = true,
  selectedProductionTemplateIds = [],
}: Props) {
  const productionTemplateNameById = new Map(
    (Array.isArray(productionTemplates) ? productionTemplates : [])
      .map((t) => [t.id, t.name] as const)
  );
  const productionTemplateColorById = new Map(
    (Array.isArray(productionTemplates) ? productionTemplates : [])
      .map((t) => [t.id, normalizeHexColor(t.themeColor)] as const)
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
  const [roomBulkCount, setRoomBulkCount] = useState(5);
  const [addingRooms, setAddingRooms] = useState(false);

  const [sectionBulkRoomId, setSectionBulkRoomId] = useState<string | null>(null);
  const [sectionBulkCurrentCount, setSectionBulkCurrentCount] = useState(0);
  const [sectionBulkCount, setSectionBulkCount] = useState(5);
  const [addingSections, setAddingSections] = useState(false);

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
    loadTree();
  }, [farmId]);

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

  function handleSectionsBulk(roomId: string) {
    if (sectionBulkCount < 1 || sectionBulkCount > 500) {
      alert('칸 개수는 1~500 사이로 입력하세요.');
      return;
    }
    setAddingSections(true);
    createFarmSectionsBulk(farmId, roomId, sectionBulkCount)
      .then(() => {
        setSectionBulkRoomId(null);
        setSectionBulkCount(5);
        loadTree();
      })
      .catch((e) => alert(e instanceof Error ? e.message : '칸 추가 실패'))
      .finally(() => setAddingSections(false));
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
  function handleDeleteRoom(roomId: string) {
    if (!confirm('이 방과 하위 칸을 모두 삭제할까요?')) return;
    deleteFarmRoom(farmId, roomId)
      .then(loadTree)
      .catch((e) => alert(e instanceof Error ? e.message : '삭제 실패'));
  }

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
          <span style={{ fontSize: 16, fontWeight: 600, color: '#0c4a6e' }}>농장 구조 설정</span>
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
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 12, minHeight: 200 }}>
          {loading && <p style={{ color: '#64748b', fontSize: 15 }}>로딩 중...</p>}
          {error && <p style={{ color: '#b91c1c', fontSize: 15 }}>{error}</p>}
          {!loading && !error && tree.length === 0 && (
            <p style={{ color: '#64748b', fontSize: 15 }}>건물이 없습니다. &quot;건물 추가&quot;로 추가하세요.</p>
          )}
          {!loading && !error && tree.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {tree.map((building) => (
                <div key={building.id} style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      background: '#e5edf5',
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleBuilding(building.id)}
                  >
                    <span
                      style={{
                        fontSize: 26,
                        fontWeight: 700,
                        lineHeight: 1,
                        width: 20,
                        display: 'inline-flex',
                        justifyContent: 'center',
                      }}
                    >
                      {(building.barns?.length ?? 0) === 0
                        ? '-'
                        : (expandedBuilding.has(building.id) ? '-' : '+')}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{building.name || '건물'}</span>
                    <span style={{ color: '#64748b', fontSize: 15 }}>
                      시설 {building.barns?.length ?? 0}개
                    </span>
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
                        borderRadius: 4,
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
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      삭제
                    </button>
                  </div>
                  {expandedBuilding.has(building.id) && (
                    <div style={{ padding: '8px 8px 8px 28px', background: '#fff' }}>
                      {(building.barns ?? []).map((barn) => (
                        <BarnRow
                          key={barn.id}
                          barn={barn}
                          templateNameById={productionTemplateNameById}
                          templateColorById={productionTemplateColorById}
                          expanded={expandedBarn.has(barn.id)}
                          onToggle={() => toggleBarn(barn.id)}
                          onAddRooms={(currentCount) => {
                            setRoomBulkBarnId(barn.id);
                            setRoomBulkCurrentCount(currentCount);
                            setRoomBulkCount(Math.max(1, Math.min(200, currentCount || 1)));
                          }}
                          onAddSections={(roomId, currentCount) => {
                            setSectionBulkRoomId(roomId);
                            setSectionBulkCurrentCount(currentCount);
                            setSectionBulkCount(Math.max(1, Math.min(500, currentCount || 1)));
                          }}
                          expandedRoom={expandedRoom}
                          toggleRoom={toggleRoom}
                          onDeleteBarn={() => handleDeleteBarn(barn.id)}
                          onDeleteRoom={handleDeleteRoom}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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
          onClick={() => setShowProductionRequiredModal(false)}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 12,
              minWidth: 360,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>안내</h3>
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
          onClick={() => !addingBuilding && setShowAddBuilding(false)}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 12,
              minWidth: 320,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>건물 추가</h3>
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
          onClick={() => !addingBarn && setShowAddBarn(null)}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 12,
              minWidth: 340,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>시설 추가</h3>
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
            <div style={{ marginBottom: 16 }}>
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
          onClick={() => !addingRooms && setRoomBulkBarnId(null)}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 12,
              minWidth: 300,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>
              {roomBulkCurrentCount === 0 ? '방 추가' : '방 갯수 변경'}
            </h3>
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
      )}

      {/* 칸 일괄 추가 모달 */}
      {sectionBulkRoomId && (
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
          onClick={() => !addingSections && setSectionBulkRoomId(null)}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 12,
              minWidth: 300,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>
              {sectionBulkCurrentCount === 0 ? '칸 추가' : '칸 갯수 변경'}
            </h3>
            <p style={{ fontSize: 15, color: '#64748b', marginBottom: 6 }}>현재 칸 개수: {sectionBulkCurrentCount}개</p>
            <p style={{ fontSize: 15, color: '#64748b', marginBottom: 12 }}>변경할 칸 개수를 입력하세요.</p>
            <input
              type="number"
              min={1}
              max={500}
              value={sectionBulkCount}
              onChange={(e) => setSectionBulkCount(parseInt(e.target.value, 10) || 1)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 16, fontSize: 15 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSectionBulkRoomId(null)} style={{ padding: '8px 16px', fontSize: 15, background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer' }}>취소</button>
              <button type="button" onClick={() => sectionBulkRoomId && handleSectionsBulk(sectionBulkRoomId)} disabled={addingSections} style={{ padding: '8px 16px', fontSize: 15, background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                {addingSections ? '저장 중...' : '저장'}
              </button>
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
  onAddSections,
  expandedRoom,
  toggleRoom,
  onDeleteBarn,
  onDeleteRoom,
}: {
  barn: FarmBarn;
  templateNameById: Map<number, string>;
  templateColorById: Map<number, string | null>;
  expanded: boolean;
  onToggle: () => void;
  onAddRooms: (currentCount: number) => void;
  onAddSections: (roomId: string, currentCount: number) => void;
  expandedRoom: Set<string>;
  toggleRoom: (id: string) => void;
  onDeleteBarn: () => void;
  onDeleteRoom: (roomId: string) => void;
}) {
  const mappedTemplateName = barn.structureTemplateId
    ? templateNameById.get(barn.structureTemplateId)
    : undefined;
  const mappedTemplateColor = barn.structureTemplateId
    ? templateColorById.get(barn.structureTemplateId)
    : null;
  const roomCount = barn.rooms?.length ?? 0;
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

  function getSectionDisplayName(sec: { name?: string | null; sectionNumber?: number | null }): string {
    const rawName = sec.name?.trim();
    if (rawName) {
      const sectionMatch = rawName.match(/^Section\s*(\d+)$/i);
      if (sectionMatch) return `${sectionMatch[1]}번칸`;
      return rawName;
    }
    if (sec.sectionNumber != null) return `${sec.sectionNumber}번칸`;
    return '칸';
  }

  return (
    <div key={barn.id} style={{ marginBottom: 8, border: `1px solid ${barnBorder}`, borderRadius: 6, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          background: barnHeaderBg,
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        <span
          style={{
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1,
            width: 18,
            display: 'inline-flex',
            justifyContent: 'center',
          }}
        >
          {expanded ? '-' : '+'}
        </span>
        <span style={{ fontSize: 15 }}>{displayName}{templateSuffix}</span>
        <span style={{ color: '#64748b', fontSize: 15 }}>방 {roomCount}개</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); onAddRooms(roomCount); }} style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 15, background: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          {roomCount === 0 ? '방 추가' : '방 갯수 변경'}
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteBarn(); }} style={{ padding: '4px 10px', fontSize: 15, background: '#fef2f2', color: '#b91c1c', border: 'none', borderRadius: 4, cursor: 'pointer' }}>삭제</button>
      </div>
      {expanded && (
        <div style={{ padding: '6px 8px 6px 24px', background: '#fff' }}>
          {(barn.rooms ?? []).map((room: FarmRoom) => {
            const sectionCount = room.sections?.length ?? 0;
            return (
              <div key={room.id} style={{ marginBottom: 6 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 8px',
                    background: '#fafafa',
                    borderRadius: 4,
                  }}
                >
                  <span style={{ fontSize: 12, cursor: 'pointer' }} onClick={() => toggleRoom(room.id)}>{expandedRoom.has(room.id) ? '-' : '+'}</span>
                  <span style={{ fontSize: 15 }}>{getRoomDisplayName(room)}</span>
                  <span style={{ color: '#64748b', fontSize: 15 }}>칸 {sectionCount}개</span>
                  <button type="button" onClick={() => onAddSections(room.id, sectionCount)} style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: 15, background: '#dcfce7', color: '#166534', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    {sectionCount === 0 ? '칸 추가' : '칸 갯수 변경'}
                  </button>
                  <button type="button" onClick={() => onDeleteRoom(room.id)} style={{ padding: '4px 8px', fontSize: 15, background: '#fef2f2', color: '#b91c1c', border: 'none', borderRadius: 4, cursor: 'pointer' }}>삭제</button>
                </div>
                {expandedRoom.has(room.id) && (
                  <div
                    style={{
                      marginLeft: 20,
                      marginTop: 6,
                      padding: '8px 10px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                    }}
                  >
                    {(room.sections ?? []).length === 0 && (
                      <span style={{ fontSize: 14, color: '#94a3b8' }}>등록된 칸이 없습니다.</span>
                    )}
                    {(room.sections ?? []).map((sec) => (
                      <span
                        key={sec.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 8px',
                          borderRadius: 999,
                          border: '1px solid #bfdbfe',
                          background: '#eff6ff',
                          color: '#1e3a8a',
                          fontSize: 14,
                          lineHeight: 1.4,
                        }}
                      >
                        {getSectionDisplayName(sec)}
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


