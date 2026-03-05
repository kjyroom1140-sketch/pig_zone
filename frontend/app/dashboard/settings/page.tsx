'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getFarms,
  updateFarm,
  getStructureTemplates,
  getFarmStructureProduction,
  saveFarmStructureProduction,
  type FarmItem,
  type FarmUpdateBody,
  type StructureTemplate,
} from '@/lib/api';
import FarmStructurePanel from './FarmStructurePanel';

const FARM_KEY = 'currentFarmId';
const FARM_NAME_KEY = 'currentFarmName';
const SECTION_TITLE_BG = '#e0f2fe';
const SECTION_TITLE_HEIGHT = 48;

type FacilityTheme = {
  selectedBg: string;
  selectedBorder: string;
  selectedAccent: string;
  selectedText: string;
  unselectedBorder: string;
};

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

function brightenHex(hex: string, ratio: number): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r + (255 - r) * clamped);
  const ng = Math.round(g + (255 - g) * clamped);
  const nb = Math.round(b + (255 - b) * clamped);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`.toUpperCase();
}

function getFacilityTheme(template: StructureTemplate): FacilityTheme {
  const fallback = template.category === 'support' ? '#94A3B8' : '#38BDF8';
  const base = normalizeHexColor(template.themeColor) ?? fallback;
  const bright = brightenHex(base, 0.28);
  return {
    selectedBg: hexToRgba(bright, 0.36),
    selectedBorder: bright,
    selectedAccent: bright,
    selectedText: '#0f172a',
    unselectedBorder: hexToRgba(base, 0.55),
  };
}

function farmValue(farm: FarmItem, key: keyof FarmUpdateBody): string {
  const v = farm[key as keyof FarmItem];
  return v != null && typeof v === 'string' ? v : '';
}

function mapFarmToForm(found: FarmItem): FarmUpdateBody {
  return {
    farmCode: found.farmCode ?? '',
    farmName: found.farmName ?? '',
    ownerName: found.ownerName ?? '',
    businessNumber: found.businessNumber ?? '',
    address: found.address ?? '',
    postalCode: found.postalCode ?? '',
    country: found.country && found.country.trim() !== '' ? found.country : '대한민국',
    addressDetail: found.addressDetail ?? '',
    phone: found.phone ?? '',
    faxNumber: found.faxNumber ?? '',
    contactName: found.contactName ?? '',
    contactPhone: found.contactPhone ?? '',
    contactEmail: found.contactEmail ?? '',
  };
}

export default function DashboardSettingsFarmPage() {
  const [farm, setFarm] = useState<FarmItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FarmUpdateBody>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [productionTemplates, setProductionTemplates] = useState<StructureTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<number>>(new Set());
  const [savedTemplateIds, setSavedTemplateIds] = useState<Set<number>>(new Set());
  const initialFacilityIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const farmId = typeof window !== 'undefined' ? localStorage.getItem(FARM_KEY) : null;
    if (!farmId) {
      setLoading(false);
      setError('선택된 농장이 없습니다. 농장을 선택해 주세요.');
      return;
    }

    // 사육시설 선택: 체크박스 목록 = structure_templates (category=production), 체크 상태 = farm_structure
    Promise.all([
      getFarms().then(({ farms }) => {
        const found = farms.find((f) => f.id === farmId);
        if (!found) {
          setError('선택된 농장 정보를 찾을 수 없습니다.');
          if (typeof window !== 'undefined') {
            localStorage.removeItem(FARM_KEY);
            localStorage.removeItem(FARM_NAME_KEY);
          }
          return;
        }
        setFarm(found);
        setForm(mapFarmToForm(found));
        if (typeof window !== 'undefined') {
          localStorage.setItem(FARM_NAME_KEY, found.farmName ?? '');
        }
      }),
      getStructureTemplates()
        .then((list) => {
          const arr = Array.isArray(list) ? list : [];
          setProductionTemplates(arr.filter((t) => String(t?.category ?? '').toLowerCase() === 'production'));
          setTemplatesLoaded(true);
        })
        .catch(() => setTemplatesLoaded(true)),
      getFarmStructureProduction(farmId)
        .then((list) => {
          // API는 배열을 그대로 반환. 래핑된 응답({ data: [...] })도 허용
          const rawList = Array.isArray(list)
            ? list
            : (list && typeof list === 'object' && 'data' in list && Array.isArray((list as { data: unknown }).data))
              ? (list as { data: unknown[] }).data
              : [];
          const ids = rawList
            .map((s) => {
              if (!s || typeof s !== 'object') return null;
              const o = s as Record<string, unknown>;
              const raw = o.templateId ?? o.template_id;
              const n = typeof raw === 'number' ? raw : Number(raw);
              return Number.isFinite(n) ? n : null;
            })
            .filter((id): id is number => id != null);
          const idSet = new Set(ids);
          setSelectedTemplateIds(idSet);
          setSavedTemplateIds(new Set(idSet));
        })
        .catch((_err) => {
          // GET 실패(401/403/네트워크) 시 체크 해제됨. 권한 확인 또는 네트워크 탭에서 /api/farm-structure/:farmId/production 응답 확인
          setSelectedTemplateIds(new Set());
          setSavedTemplateIds(new Set());
        }),
    ])
      .catch((e) => {
        setError(e instanceof Error ? e.message : '농장 정보를 불러오지 못했습니다.');
      })
      .finally(() => setLoading(false));
  }, []);

  function startEditing() {
    if (!farm) return;
    setSaveError('');
    setForm(mapFarmToForm(farm));
    initialFacilityIdsRef.current = new Set(savedTemplateIds);
    setEditing(true);
  }

  function cancelEditing() {
    setSelectedTemplateIds(new Set(initialFacilityIdsRef.current));
    setEditing(false);
  }

  function handleFacilityToggle(templateId: number, checked: boolean) {
    if (!editing) return;
    const next = new Set(selectedTemplateIds);
    if (checked) next.add(templateId);
    else next.delete(templateId);
    setSelectedTemplateIds(next);
  }

  function handleSaveBasic() {
    if (!farm) return;
    setSaveError('');
    setSaving(true);
    const idsToSave = Array.from(selectedTemplateIds);
    updateFarm(farm.id, form)
      .then(() => saveFarmStructureProduction(farm.id, idsToSave))
      .then(() => {
        setFarm((prev) => (prev ? { ...prev, ...form } : null));
        setSavedTemplateIds(new Set(selectedTemplateIds));
        setEditing(false);
        if (form.farmName && typeof window !== 'undefined') {
          localStorage.setItem(FARM_NAME_KEY, form.farmName);
        }
      })
      .catch((e) => {
        setSaveError(e instanceof Error ? e.message : '저장 실패');
      })
      .finally(() => setSaving(false));
  }

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#0f172a', borderRadius: '50%', margin: '0 auto 16px' }} />
        <p style={{ color: '#64748b', fontSize: 15 }}>로딩 중...</p>
      </div>
    );
  }

  if (error || !farm) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 24, textAlign: 'center' }}>
          <p style={{ color: '#b91c1c', fontSize: 15, marginBottom: 16 }}>{error || '농장 정보가 없습니다.'}</p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.href = '/select-farm';
            }}
            style={{ display: 'inline-block', padding: '10px 20px', background: '#0f172a', color: '#fff', fontSize: 14, fontWeight: 500, borderRadius: 8, border: 'none', cursor: 'pointer' }}
          >
            농장 선택하기
          </button>
        </div>
      </div>
    );
  }

  const LABEL_BG = '#e5e7eb';
  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
  };
  const labelWidth = 150;
  const labelStyle: React.CSSProperties = {
    fontSize: 15,
    color: '#1e293b',
    width: labelWidth,
    minWidth: labelWidth,
    flexShrink: 0,
    padding: '10px 12px',
    background: LABEL_BG,
    border: '1px solid #cbd5e1',
    borderRight: 'none',
    borderRadius: '6px 0 0 6px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  };
  const fieldRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'stretch', gap: 0 };
  const inputJoinedStyle: React.CSSProperties = { borderLeft: 'none', borderTopLeftRadius: 0, borderBottomLeftRadius: 0 };
  const editableInputStyle = editing ? { background: '#fffbeb' as const } : {};

  return (
    <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24, background: '#e5edf5' }}>
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ minHeight: SECTION_TITLE_HEIGHT, background: SECTION_TITLE_BG, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#0c4a6e' }}>기본정보</span>
            {!editing ? (
              <button type="button" onClick={startEditing} style={{ padding: '8px 18px', fontSize: 15, fontWeight: 500, background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                수정
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={handleSaveBasic} disabled={saving} style={{ padding: '10px 18px', fontSize: 15, fontWeight: 500, background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button type="button" onClick={cancelEditing} disabled={saving} style={{ padding: '10px 18px', fontSize: 15, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                  취소
                </button>
              </div>
            )}
          </div>
          <div style={{ padding: 20 }}>
            {saveError && <p style={{ color: '#b91c1c', fontSize: 15, marginBottom: 12 }}>{saveError}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={fieldRowStyle}>
                  <label style={labelStyle}>축산물등록번호</label>
                  <input
                    type="text"
                    value={editing ? (form.farmCode ?? '') : farmValue(farm, 'farmCode')}
                    readOnly={!editing}
                    onChange={(e) => setForm((f) => ({ ...f, farmCode: e.target.value }))}
                    style={{ ...inputStyle, ...inputJoinedStyle, ...editableInputStyle }}
                    placeholder="축산물등록번호"
                  />
                </div>
                <div style={fieldRowStyle}>
                  <label style={labelStyle}>사업자번호</label>
                  <input
                    type="text"
                    value={editing ? (form.businessNumber ?? '') : farmValue(farm, 'businessNumber')}
                    readOnly={!editing}
                    onChange={(e) => setForm((f) => ({ ...f, businessNumber: e.target.value }))}
                    style={{ ...inputStyle, ...inputJoinedStyle, ...editableInputStyle }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={fieldRowStyle}>
                  <label style={labelStyle}>농장명</label>
                  <input
                    type="text"
                    value={editing ? (form.farmName ?? '') : farmValue(farm, 'farmName')}
                    readOnly={!editing}
                    onChange={(e) => setForm((f) => ({ ...f, farmName: e.target.value }))}
                    style={{ ...inputStyle, ...inputJoinedStyle, ...editableInputStyle }}
                  />
                </div>
                <div style={fieldRowStyle}>
                  <label style={labelStyle}>대표자명</label>
                  <input
                    type="text"
                    value={editing ? (form.ownerName ?? '') : farmValue(farm, 'ownerName')}
                    readOnly={!editing}
                    onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
                    style={{ ...inputStyle, ...inputJoinedStyle, ...editableInputStyle }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={fieldRowStyle}>
                  <label style={labelStyle}>우편번호</label>
                  <input
                    type="text"
                    value={editing ? (form.postalCode ?? '') : farmValue(farm, 'postalCode')}
                    readOnly={!editing}
                    onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                    style={{ ...inputStyle, ...inputJoinedStyle, ...editableInputStyle }}
                    placeholder="우편번호"
                  />
                </div>
                <div style={fieldRowStyle}>
                  <label style={labelStyle}>국가</label>
                  <select
                    value={editing ? (form.country ?? '대한민국') : (farmValue(farm, 'country') || '대한민국')}
                    disabled={!editing}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    style={{ ...inputStyle, ...inputJoinedStyle, ...editableInputStyle, cursor: editing ? 'pointer' : 'default' }}
                  >
                    <option value="대한민국">대한민국</option>
                    <option value="중국">중국</option>
                    <option value="일본">일본</option>
                    <option value="미국">미국</option>
                    <option value="베트남">베트남</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
              </div>

              <div style={fieldRowStyle}>
                <label style={labelStyle}>농장주소</label>
                <div style={{ flex: 1, display: 'flex', gap: 8, minWidth: 0 }}>
                  <input
                    type="text"
                    value={editing ? (form.address ?? '') : farmValue(farm, 'address')}
                    readOnly={!editing}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    style={{ ...inputStyle, ...inputJoinedStyle, ...editableInputStyle, flex: 1 }}
                    placeholder="농장주소"
                  />
                  <input
                    type="text"
                    value={editing ? (form.addressDetail ?? '') : farmValue(farm, 'addressDetail')}
                    readOnly={!editing}
                    onChange={(e) => setForm((f) => ({ ...f, addressDetail: e.target.value }))}
                    style={{ ...inputStyle, ...editableInputStyle, flex: 1, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }}
                    placeholder="상세주소"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={fieldRowStyle}>
                  <label style={labelStyle}>농장 전화</label>
                  <input
                    type="text"
                    value={editing ? (form.phone ?? '') : farmValue(farm, 'phone')}
                    readOnly={!editing}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    style={{ ...inputStyle, ...inputJoinedStyle, ...editableInputStyle }}
                    placeholder="농장 전화"
                  />
                </div>
                <div style={fieldRowStyle}>
                  <label style={labelStyle}>농장 팩스</label>
                  <input
                    type="text"
                    value={editing ? (form.faxNumber ?? '') : farmValue(farm, 'faxNumber')}
                    readOnly={!editing}
                    onChange={(e) => setForm((f) => ({ ...f, faxNumber: e.target.value }))}
                    style={{ ...inputStyle, ...inputJoinedStyle, ...editableInputStyle }}
                    placeholder="농장 팩스"
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 6, paddingTop: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 12 }}>담당자 정보</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={fieldRowStyle}>
                      <label style={labelStyle}>담당자 이름</label>
                      <input
                        type="text"
                        value={editing ? (form.contactName ?? '') : farmValue(farm, 'contactName')}
                        readOnly={!editing}
                        onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                        style={{ ...inputStyle, ...inputJoinedStyle, ...editableInputStyle }}
                        placeholder="담당자 이름"
                      />
                    </div>
                    <div style={fieldRowStyle}>
                      <label style={labelStyle}>담당자 핸드폰</label>
                      <input
                        type="text"
                        value={editing ? (form.contactPhone ?? '') : farmValue(farm, 'contactPhone')}
                        readOnly={!editing}
                        onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                        style={{ ...inputStyle, ...inputJoinedStyle, ...editableInputStyle }}
                        placeholder="담당자 핸드폰"
                      />
                    </div>
                  </div>
                  <div style={fieldRowStyle}>
                    <label style={labelStyle}>담당자 이메일</label>
                    <input
                      type="email"
                      value={editing ? (form.contactEmail ?? '') : farmValue(farm, 'contactEmail')}
                      readOnly={!editing}
                      onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                      style={{ ...inputStyle, ...inputJoinedStyle, ...editableInputStyle }}
                      placeholder="담당자 이메일"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ minHeight: SECTION_TITLE_HEIGHT, background: SECTION_TITLE_BG, display: 'flex', alignItems: 'center', padding: '12px 16px' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#0c4a6e' }}>사육시설 선택</span>
          </div>
          <div style={{ padding: 20, minHeight: 120 }}>
            {!templatesLoaded ? (
              <p style={{ color: '#64748b', fontSize: 15 }}>사육시설 목록 로딩 중...</p>
            ) : productionTemplates.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: 15 }}>등록된 사육시설 템플릿이 없습니다. 관리자 &gt; 시설 템플릿에서 먼저 등록하세요.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                {productionTemplates.map((t) => {
                  const isSelected = selectedTemplateIds.has(t.id);
                  const theme = getFacilityTheme(t);
                  return (
                    <label
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: editing ? 'pointer' : 'default',
                        fontSize: 15,
                        padding: '8px 14px',
                        borderRadius: 8,
                        color: isSelected ? theme.selectedText : '#1e293b',
                        background: isSelected ? theme.selectedBg : '#fff',
                        border: `1px solid ${isSelected ? theme.selectedBorder : theme.unselectedBorder}`,
                        boxShadow: isSelected ? `0 0 0 2px ${hexToRgba(theme.selectedAccent, 0.25)}` : 'none',
                        transition: 'all 120ms ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleFacilityToggle(t.id, e.target.checked)}
                        disabled={!editing || saving}
                        style={{
                          opacity: 0,
                          width: 0,
                          height: 0,
                          margin: 0,
                          pointerEvents: 'none',
                        }}
                      />
                      <span
                        aria-hidden="true"
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 700,
                          lineHeight: 1,
                          border: `1px solid ${isSelected ? theme.selectedBorder : '#94a3b8'}`,
                          background: isSelected ? theme.selectedBorder : '#fff',
                          color: '#fff',
                          boxSizing: 'border-box',
                        }}
                      >
                        {isSelected ? '✓' : ''}
                      </span>
                      <span>{t.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <FarmStructurePanel
        farmId={farm.id}
        productionTemplates={productionTemplates}
        hasSavedProductionSelection={savedTemplateIds.size > 0}
        selectedProductionTemplateIds={Array.from(savedTemplateIds)}
        onProductionOrderSaved={(orderedIds) => setSavedTemplateIds(new Set(orderedIds))}
      />
    </div>
  );
}

