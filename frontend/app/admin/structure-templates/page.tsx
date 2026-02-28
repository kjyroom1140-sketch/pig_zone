'use client';

import { useEffect, useState } from 'react';
import { getStructureTemplates, createStructureTemplate, updateStructureTemplate, deleteStructureTemplate, reorderStructureTemplate, type StructureTemplate } from '@/lib/api';

const listItemStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderBottom: '1px solid #e5e7eb',
  fontSize: 15,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
};
const colHeaderStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderBottom: '1px solid #cbd5e1',
  fontSize: 14,
  fontWeight: 600,
  color: '#475569',
  background: '#f1f5f9',
  position: 'sticky',
  top: 0,
  zIndex: 1,
};
const gridProduction = { display: 'grid' as const, gridTemplateColumns: '40px 140px 110px 90px 80px 1fr 72px', gap: 8, alignItems: 'center' };
const gridSupport = { display: 'grid' as const, gridTemplateColumns: '40px 140px 1fr 72px', gap: 8, alignItems: 'center' };
const cellCenter: React.CSSProperties = { textAlign: 'center' };
/** 순서 숫자 동그라미 배지 */
const orderBadgeStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  fontWeight: 600,
  background: '#e2e8f0',
  color: '#475569',
  flexShrink: 0,
};
const SECTION_TITLE_BG = '#e0f2fe';
const SECTION_TITLE_BORDER = '#cbd5e1';
const listHeaderStyle: React.CSSProperties = {
  padding: '16px 14px',
  background: SECTION_TITLE_BG,
  borderBottom: `1px solid ${SECTION_TITLE_BORDER}`,
  fontSize: 17,
  fontWeight: 700,
  color: '#0c4a6e',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  fontSize: 14,
  marginBottom: 12,
  boxSizing: 'border-box' as const,
};

/** 모달 공통 스타일: 모달 헤더/바디/푸터 */
const modalHeaderStyle: React.CSSProperties = {
  margin: 0,
  padding: '20px 20px 14px',
  background: '#94a3b8',
  color: '#1e293b',
  fontSize: 17,
  fontWeight: 700,
  borderRadius: '8px 8px 0 0',
  borderBottom: '1px solid #64748b',
};
const modalBodyStyle: React.CSSProperties = {
  padding: 20,
  paddingBottom: 16,
  borderBottom: '1px solid #e2e8f0',
};
const modalFooterStyle: React.CSSProperties = {
  padding: '10px 20px 16px',
  background: '#f8fafc',
  borderRadius: '0 0 8px 8px',
  display: 'flex',
  gap: 8,
};
const modalRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 12,
};
const modalLabelStyle: React.CSSProperties = {
  flex: '0 0 120px',
  padding: '8px 10px',
  background: '#f1f5f9',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  color: '#334155',
};
const modalInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '8px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  fontSize: 14,
  marginBottom: 0,
  boxSizing: 'border-box' as const,
};
const modalRangeWrapStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
};
const modalRangeInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '8px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  fontSize: 14,
  boxSizing: 'border-box' as const,
};
const modalRangeSepStyle: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: '#64748b', flexShrink: 0 };

function normalizeHexColor(value?: string | null): string | null {
  if (!value) return null;
  const hex = value.trim();
  if (!hex.startsWith('#')) return null;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}

function getTextColorOnBg(hexColor: string): '#0f172a' | '#ffffff' {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  // Relative luminance approximation for text contrast selection.
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? '#0f172a' : '#ffffff';
}

/** 카테고리는 2가지로 설정. 추가 버튼 옆 목록(사육시설/보조시설)에 따라 카테고리 지정됨 */
const CATEGORY_PRODUCTION = 'production';
const CATEGORY_SUPPORT = 'support'; // DB enum enum_structure_templates_category 참고
type StructureCategory = 'production' | 'support';

export default function AdminStructureTemplatesPage() {
  const [list, setList] = useState<StructureTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** 모달 표시 상태. 추가 시 사육시설 목록에 추가 시 production, 보조시설 목록에 추가 시 support */
  const [addCategory, setAddCategory] = useState<StructureCategory | null>(null);
  const [addForm, setAddForm] = useState({
    name: '',
    themeColor: '#38BDF8',
    weightMin: '',
    weightMax: '',
    optimalDensity: '',
    ageLabel: '',
    description: '',
  });
  const [addError, setAddError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<StructureTemplate | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    themeColor: '#38BDF8',
    weightMin: '',
    weightMax: '',
    optimalDensity: '',
    ageLabel: '',
    description: '',
  });
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  function parseWeightRange(weight?: string): { min: string; max: string } {
    if (!weight || !weight.includes('~')) return { min: '', max: '' };
    const [min, max] = weight.split('~').map((s) => s.trim());
    return { min: min ?? '', max: max ?? '' };
  }

  function openEditModal(t: StructureTemplate) {
    const { min, max } = parseWeightRange(t.weight);
    setEditingTemplate(t);
    setEditForm({
      name: t.name,
      themeColor: (t.themeColor || '#38BDF8').toUpperCase(),
      weightMin: min,
      weightMax: max,
      optimalDensity: t.optimalDensity != null ? String(t.optimalDensity) : '',
      ageLabel: t.ageLabel ?? '',
      description: t.description ?? '',
    });
    setEditError('');
  }

  function loadList() {
    getStructureTemplates()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : '목록 조회 실패'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadList();
  }, []);

  function openAddModal(category: StructureCategory) {
    setAddCategory(category);
    setAddForm({
      name: '',
      themeColor: category === CATEGORY_SUPPORT ? '#94A3B8' : '#38BDF8',
      weightMin: '',
      weightMax: '',
      optimalDensity: '',
      ageLabel: '',
      description: '',
    });
    setAddError('');
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!addCategory) return;
    setAddError('');
    const name = addForm.name.trim();
    if (!name) {
      setAddError('이름을 입력해주세요.');
      return;
    }
    const weightRange =
      addCategory === CATEGORY_PRODUCTION && (addForm.weightMin.trim() || addForm.weightMax.trim())
        ? [addForm.weightMin.trim(), addForm.weightMax.trim()].join('~')
        : undefined;
    setSubmitting(true);
    try {
      // 카테고리는 추가 버튼 옆 목록에 따라 설정(사육시설 = production, 보조시설 = support) 
      const categoryValue: StructureCategory = addCategory === CATEGORY_PRODUCTION ? CATEGORY_PRODUCTION : CATEGORY_SUPPORT;
      const payload: Parameters<typeof createStructureTemplate>[0] = {
        name,
        category: categoryValue,
        themeColor: addForm.themeColor.trim().toUpperCase(),
        description: addForm.description.trim() || undefined,
      };
      if (addCategory === CATEGORY_PRODUCTION) {
        payload.weight = weightRange;
        const od = addForm.optimalDensity.trim();
        payload.optimalDensity = od ? Number(od) : undefined;
        const al = addForm.ageLabel.trim();
        payload.ageLabel = al || undefined;
      }
      await createStructureTemplate(payload);
      setAddCategory(null);
      loadList();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : '추가 실패');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTemplate) return;
    setEditError('');
    const name = editForm.name.trim();
    if (!name) {
      setEditError('이름을 입력해주세요.');
      return;
    }
    const weightRange =
      editingTemplate.category === CATEGORY_PRODUCTION && (editForm.weightMin.trim() || editForm.weightMax.trim())
        ? [editForm.weightMin.trim(), editForm.weightMax.trim()].join('~')
        : undefined;
    setEditSubmitting(true);
    try {
      await updateStructureTemplate(editingTemplate.id, {
        name,
        themeColor: editForm.themeColor.trim().toUpperCase(),
        weight: weightRange,
        optimalDensity: editForm.optimalDensity.trim() ? Number(editForm.optimalDensity) : undefined,
        ageLabel: editForm.ageLabel.trim() || undefined,
        description: editForm.description.trim() || undefined,
      });
      setEditingTemplate(null);
      loadList();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '수정 실패');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleEditDelete() {
    if (!editingTemplate) return;
    if (!confirm(`"${editingTemplate.name}" 템플릿을 삭제하시겠습니까?`)) return;
    setEditSubmitting(true);
    try {
      await deleteStructureTemplate(editingTemplate.id);
      setEditingTemplate(null);
      loadList();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '삭제 실패');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleReorder(t: StructureTemplate, direction: 'up' | 'down') {
    try {
      await reorderStructureTemplate(t.id, direction);
      loadList();
    } catch {
      // ignore
    }
  }

  if (loading) return <div>로딩 중...</div>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;

  const production = list.filter((t) => t.category === CATEGORY_PRODUCTION);
  const support = list.filter((t) => t.category === CATEGORY_SUPPORT);

  return (
    <div className="admin-structure-templates-page">
      <h2 style={{ marginBottom: 16, fontSize: 22, fontWeight: 700 }}>농장 구조 설정</h2>
      <p style={{ color: '#64748b', marginBottom: 20, fontSize: 15 }}>
        카테고리는 사육시설(production)·보조시설(support) 2가지로 사용합니다. 각 목록의 추가 버튼을 누르면 해당 카테고리로 지정됩니다.
      </p>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* 왼쪽 - 사육시설. 여기서 추가 시 category = production */}
        <div style={{ flex: '0 0 60%', background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={listHeaderStyle}>
            <span>사육시설</span>
            <button
              type="button"
              onClick={() => openAddModal(CATEGORY_PRODUCTION)}
              style={{ padding: '8px 14px', fontSize: 14, background: '#111', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              추가
            </button>
          </div>
          <div style={{ background: '#fff' }}>
            {production.length === 0 ? (
              <div style={{ padding: 24, color: '#64748b', fontSize: 15 }}>등록된 사육시설이 없습니다.</div>
            ) : (
              <>
                <div style={{ ...colHeaderStyle, ...gridProduction }}>
                  <span style={cellCenter}>순서</span>
                  <span>사육시설 이름</span>
                  <span style={cellCenter}>적정밀도(마리수)</span>
                  <span style={cellCenter}>체중 범위</span>
                  <span style={cellCenter}>일령 표기</span>
                  <span>설명</span>
                  <span style={{ ...cellCenter, fontSize: 13 }}>정렬</span>
                </div>
                {production.map((t, idx) => (
                    <div
                      key={t.id}
                      style={{
                        ...listItemStyle,
                        ...gridProduction,
                        background: '#fff',
                        color: '#1e293b',
                        borderBottom: '1px solid #e5e7eb',
                      }}
                      onClick={() => openEditModal(t)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && openEditModal(t)}
                    >
                      <span style={{ ...cellCenter }}>
                        <span
                          style={{
                            ...orderBadgeStyle,
                            background: normalizeHexColor(t.themeColor) ?? '#e2e8f0',
                            color: getTextColorOnBg(normalizeHexColor(t.themeColor) ?? '#e2e8f0'),
                          }}
                        >
                          {idx + 1}
                        </span>
                      </span>
                      <span>{t.name}</span>
                      <span style={{ fontSize: 14, color: '#64748b', ...cellCenter }}>{t.optimalDensity != null ? t.optimalDensity : '-'}</span>
                      <span style={{ fontSize: 14, color: '#64748b', ...cellCenter }}>{t.weight ?? '-'}</span>
                      <span style={{ fontSize: 14, color: '#64748b', ...cellCenter }}>{t.ageLabel ?? '-'}</span>
                      <span style={{ fontSize: 14, color: '#64748b' }}>{t.description ?? '-'}</span>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          title="위로"
                          disabled={idx === 0}
                          onClick={() => handleReorder(t, 'up')}
                          style={{
                            padding: '5px 9px',
                            fontSize: 13,
                            border: '1px solid #e2e8f0',
                            borderRadius: 4,
                            background: idx === 0 ? '#f1f5f9' : '#fff',
                            cursor: idx === 0 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          title="아래로"
                          disabled={idx === production.length - 1}
                          onClick={() => handleReorder(t, 'down')}
                          style={{
                            padding: '5px 9px',
                            fontSize: 13,
                            border: '1px solid #e2e8f0',
                            borderRadius: 4,
                            background: idx === production.length - 1 ? '#f1f5f9' : '#fff',
                            cursor: idx === production.length - 1 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>
        {/* 오른쪽 - 보조시설. 여기서 추가 시 category = support */}
        <div style={{ flex: '0 0 40%', background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={listHeaderStyle}>
            <span>보조시설</span>
            <button
              type="button"
              onClick={() => openAddModal(CATEGORY_SUPPORT)}
              style={{ padding: '8px 14px', fontSize: 14, background: '#111', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              추가
            </button>
          </div>
          <div style={{ background: '#fff' }}>
            {support.length === 0 ? (
              <div style={{ padding: 24, color: '#64748b', fontSize: 15 }}>등록된 보조시설이 없습니다.</div>
            ) : (
              <>
                <div style={{ ...colHeaderStyle, ...gridSupport }}>
                  <span style={cellCenter}>순서</span>
                  <span>템플릿 이름</span>
                  <span>설명</span>
                  <span style={{ ...cellCenter, fontSize: 13 }}>정렬</span>
                </div>
                {support.map((t, idx) => (
                  <div key={t.id} style={{ ...listItemStyle, ...gridSupport, background: '#fff', color: '#1e293b', borderBottom: '1px solid #e5e7eb' }} onClick={() => openEditModal(t)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openEditModal(t)}>
                    <span style={{ ...cellCenter }}>
                      <span
                        style={{
                          ...orderBadgeStyle,
                          background: normalizeHexColor(t.themeColor) ?? '#e2e8f0',
                          color: getTextColorOnBg(normalizeHexColor(t.themeColor) ?? '#e2e8f0'),
                        }}
                      >
                        {idx + 1}
                      </span>
                    </span>
                    <span>{t.name}</span>
                    <span style={{ fontSize: 14, color: '#64748b' }}>{t.description ?? '-'}</span>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button type="button" title="위로" disabled={idx === 0} onClick={() => handleReorder(t, 'up')} style={{ padding: '5px 9px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 4, background: idx === 0 ? '#f1f5f9' : '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}>↑</button>
                      <button type="button" title="아래로" disabled={idx === support.length - 1} onClick={() => handleReorder(t, 'down')} style={{ padding: '5px 9px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 4, background: idx === support.length - 1 ? '#f1f5f9' : '#fff', cursor: idx === support.length - 1 ? 'not-allowed' : 'pointer' }}>↓</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 추가 모달 */}
      {addCategory && (
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
              borderRadius: 8,
              width: '100%',
              maxWidth: 440,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={modalHeaderStyle}>
              {addCategory === CATEGORY_PRODUCTION ? '사육시설 추가' : '보조시설 추가'}
            </div>
            <form onSubmit={handleAddSubmit}>
              <div style={modalBodyStyle}>
              <div style={modalRowStyle}>
                <label style={modalLabelStyle}>{addCategory === CATEGORY_PRODUCTION ? '사육시설 이름' : '템플릿 이름'}</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  style={modalInputStyle}
                  placeholder={addCategory === CATEGORY_PRODUCTION ? '사육시설명' : '시설명'}
                />
              </div>
              <div style={modalRowStyle}>
                <label style={modalLabelStyle}>테마색</label>
                <div style={{ ...modalRangeWrapStyle, gap: 10 }}>
                  <input
                    type="color"
                    value={addForm.themeColor}
                    onChange={(e) => setAddForm((f) => ({ ...f, themeColor: e.target.value.toUpperCase() }))}
                    style={{ width: 44, height: 34, border: '1px solid #e5e7eb', borderRadius: 6, padding: 2, background: '#fff' }}
                  />
                  <input
                    type="text"
                    value={addForm.themeColor}
                    onChange={(e) => setAddForm((f) => ({ ...f, themeColor: e.target.value }))}
                    style={modalInputStyle}
                    placeholder="#38BDF8"
                  />
                </div>
              </div>
              {addCategory === CATEGORY_PRODUCTION && (
                <>
                  <div style={modalRowStyle}>
                    <label style={modalLabelStyle}>적정밀도(마리수)</label>
                    <input
                      type="text"
                      value={addForm.optimalDensity}
                      onChange={(e) => setAddForm((f) => ({ ...f, optimalDensity: e.target.value }))}
                      style={modalInputStyle}
                      placeholder="0.33"
                    />
                  </div>
                  <div style={modalRowStyle}>
                    <label style={modalLabelStyle}>泥댁쨷 踰붿쐞</label>
                    <div style={modalRangeWrapStyle}>
                      <input
                        type="text"
                        value={addForm.weightMin}
                        onChange={(e) => setAddForm((f) => ({ ...f, weightMin: e.target.value }))}
                        style={modalRangeInputStyle}
                        placeholder="최소"
                      />
                      <span style={modalRangeSepStyle}>~</span>
                      <input
                        type="text"
                        value={addForm.weightMax}
                        onChange={(e) => setAddForm((f) => ({ ...f, weightMax: e.target.value }))}
                        style={modalRangeInputStyle}
                        placeholder="최대"
                      />
                    </div>
                  </div>
                  <div style={modalRowStyle}>
                    <label style={modalLabelStyle}>일령 표기</label>
                    <input
                      type="text"
                      value={addForm.ageLabel}
                      onChange={(e) => setAddForm((f) => ({ ...f, ageLabel: e.target.value }))}
                      style={modalInputStyle}
                      placeholder="비육"
                    />
                  </div>
                </>
              )}
              <div style={modalRowStyle}>
                <label style={modalLabelStyle}>설명</label>
                <input
                  type="text"
                  value={addForm.description}
                  onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                  style={modalInputStyle}
                  placeholder="설명"
                />
              </div>
              {addError && <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 8 }}>{addError}</p>}
              </div>
              <div style={modalFooterStyle}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '10px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer' }}
                >
                  {submitting ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setAddCategory(null)}
                  style={{ padding: '10px 20px', background: '#fff', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {editingTemplate && (
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
              borderRadius: 8,
              width: '100%',
              maxWidth: 440,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={modalHeaderStyle}>
              {editingTemplate.category === CATEGORY_PRODUCTION ? '사육시설 수정' : '보조시설 수정'}
            </div>
            <form onSubmit={handleEditSubmit}>
              <div style={modalBodyStyle}>
                <div style={modalRowStyle}>
                  <label style={modalLabelStyle}>{editingTemplate.category === CATEGORY_PRODUCTION ? '사육시설 이름' : '템플릿 이름'}</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    style={modalInputStyle}
                    placeholder={editingTemplate.category === CATEGORY_PRODUCTION ? '사육시설명' : '시설명'}
                  />
                </div>
                <div style={modalRowStyle}>
                  <label style={modalLabelStyle}>테마색</label>
                  <div style={{ ...modalRangeWrapStyle, gap: 10 }}>
                    <input
                      type="color"
                      value={editForm.themeColor}
                      onChange={(e) => setEditForm((f) => ({ ...f, themeColor: e.target.value.toUpperCase() }))}
                      style={{ width: 44, height: 34, border: '1px solid #e5e7eb', borderRadius: 6, padding: 2, background: '#fff' }}
                    />
                    <input
                      type="text"
                      value={editForm.themeColor}
                      onChange={(e) => setEditForm((f) => ({ ...f, themeColor: e.target.value }))}
                      style={modalInputStyle}
                      placeholder="#38BDF8"
                    />
                  </div>
                </div>
                {editingTemplate.category === CATEGORY_PRODUCTION && (
                  <>
                    <div style={modalRowStyle}>
                      <label style={modalLabelStyle}>적정밀도(마리수)</label>
                      <input
                        type="text"
                        value={editForm.optimalDensity}
                        onChange={(e) => setEditForm((f) => ({ ...f, optimalDensity: e.target.value }))}
                        style={modalInputStyle}
                        placeholder="0.33"
                      />
                    </div>
                    <div style={modalRowStyle}>
                      <label style={modalLabelStyle}>泥댁쨷 踰붿쐞</label>
                      <div style={modalRangeWrapStyle}>
                        <input
                          type="text"
                          value={editForm.weightMin}
                          onChange={(e) => setEditForm((f) => ({ ...f, weightMin: e.target.value }))}
                          style={modalRangeInputStyle}
                          placeholder="최소"
                        />
                        <span style={modalRangeSepStyle}>~</span>
                        <input
                          type="text"
                          value={editForm.weightMax}
                          onChange={(e) => setEditForm((f) => ({ ...f, weightMax: e.target.value }))}
                          style={modalRangeInputStyle}
                          placeholder="최대"
                        />
                      </div>
                    </div>
                    <div style={modalRowStyle}>
                      <label style={modalLabelStyle}>일령 표기</label>
                      <input
                        type="text"
                        value={editForm.ageLabel}
                        onChange={(e) => setEditForm((f) => ({ ...f, ageLabel: e.target.value }))}
                        style={modalInputStyle}
                        placeholder="비육"
                      />
                    </div>
                  </>
                )}
                <div style={modalRowStyle}>
                  <label style={modalLabelStyle}>설명</label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    style={modalInputStyle}
                    placeholder="설명"
                  />
                </div>
                {editError && <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 8 }}>{editError}</p>}
              </div>
              <div style={{ ...modalFooterStyle, justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    style={{ padding: '10px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, cursor: editSubmitting ? 'not-allowed' : 'pointer' }}
                  >
                    {editSubmitting ? '저장 중...' : '저장'}
                  </button>
                  <button
                    type="button"
                    disabled={editSubmitting}
                    onClick={() => setEditingTemplate(null)}
                    style={{ padding: '10px 20px', background: '#fff', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}
                  >
                    취소
                  </button>
                </div>
                <button
                  type="button"
                  disabled={editSubmitting}
                  onClick={handleEditDelete}
                  style={{ padding: '10px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, cursor: editSubmitting ? 'not-allowed' : 'pointer' }}
                >
                  삭제
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
