'use client';

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import {
  createFarmStaff,
  deleteFarmStaff,
  getFarmStaff,
  type FarmStaffItem,
  updateFarmStaff,
} from '@/lib/api';

type NewStaffForm = {
  username: string;
  password: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  position: string;
};

type EditStaffForm = {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  position: string;
};

export default function SettingsStaffPage() {
  const [farmId, setFarmId] = useState<string | null>(null);
  const [items, setItems] = useState<FarmStaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<FarmStaffItem | null>(null);
  const [form, setForm] = useState<NewStaffForm>({
    username: '',
    password: '',
    fullName: '',
    email: '',
    phone: '',
    role: 'staff',
    department: '',
    position: '',
  });
  const [editForm, setEditForm] = useState<EditStaffForm>({
    fullName: '',
    email: '',
    phone: '',
    role: 'staff',
    department: '',
    position: '',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setFarmId(localStorage.getItem('currentFarmId'));
  }, []);

  const load = useCallback(async () => {
    if (!farmId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const list = await getFarmStaff(farmId);
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '직원 목록을 불러오지 못했습니다.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) =>
      [s.fullName, s.username, s.email, s.phone, s.department, s.position].some((v) =>
        (v ?? '').toLowerCase().includes(q)
      )
    );
  }, [items, query]);
  const hasFarmAdmin = useMemo(() => items.some((s) => s.isActive && s.role === 'farm_admin'), [items]);

  useEffect(() => {
    if (hasFarmAdmin && form.role === 'farm_admin') {
      setForm((prev) => ({ ...prev, role: 'staff' }));
    }
  }, [hasFarmAdmin, form.role]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    if (!form.username.trim() || !form.password.trim() || !form.fullName.trim()) {
      setError('아이디, 비밀번호, 이름은 필수입니다.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await createFarmStaff(farmId, {
        account: {
          username: form.username.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
        },
        staff: {
          role: form.role,
          department: form.department.trim() || undefined,
          position: form.position.trim() || undefined,
        },
      });
      setForm({
        username: '',
        password: '',
        fullName: '',
        email: '',
        phone: '',
        role: 'staff',
        department: '',
        position: '',
      });
      setCreateModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '직원 등록 실패');
    } finally {
      setCreating(false);
    }
  }

  function openEditModal(staff: FarmStaffItem) {
    setEditingStaff(staff);
    setEditForm({
      fullName: staff.fullName ?? '',
      email: staff.email ?? '',
      phone: staff.phone ?? '',
      role: staff.role ?? 'staff',
      department: staff.department ?? '',
      position: staff.position ?? '',
    });
    setEditModalOpen(true);
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId || !editingStaff) return;
    if (!editForm.fullName.trim()) {
      setError('이름은 필수입니다.');
      return;
    }
    const nextRole = editForm.role;
    if (nextRole === 'farm_admin' && hasFarmAdmin && editingStaff.role !== 'farm_admin') {
      setError('농장관리자는 농장당 1명만 등록할 수 있습니다.');
      return;
    }
    setSavingId(editingStaff.userFarmId);
    setError('');
    try {
      await updateFarmStaff(farmId, editingStaff.userFarmId, {
        user: {
          fullName: editForm.fullName.trim(),
          email: editForm.email.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
        },
        staff: {
          role: nextRole,
          department: editForm.department.trim() || undefined,
          position: editForm.position.trim() || undefined,
        },
      });
      setEditModalOpen(false);
      setEditingStaff(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '직원 수정 실패');
    } finally {
      setSavingId(null);
    }
  }

  async function onDelete(userFarmId: string, name: string) {
    if (!farmId) return;
    if (!confirm(`${name || '해당 직원'}을(를) 퇴사 처리할까요?`)) return;
    setDeletingId(userFarmId);
    setError('');
    try {
      await deleteFarmStaff(farmId, userFarmId);
      if (editingStaff?.userFarmId === userFarmId) {
        setEditModalOpen(false);
        setEditingStaff(null);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '직원 삭제 실패');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 20, marginBottom: 6 }}>직원 관리</h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>농장 직원 목록 조회 및 계정 등록/권한 관리를 할 수 있습니다.</p>
      </div>
      {!farmId ? (
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            background: '#ffffff',
            padding: 16,
            color: '#64748b',
          }}
        >
          먼저 농장을 선택해 주세요.
        </div>
      ) : (
        <>
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              background: '#ffffff',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                padding: '12px 14px',
                background: '#f8fafc',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>직원 목록</div>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  style={{
                    border: 'none',
                    borderRadius: 8,
                    background: '#1d4ed8',
                    color: '#fff',
                    padding: '8px 12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  직원 등록
                </button>
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름/아이디/이메일/연락처 검색"
                style={{
                  width: '100%',
                  maxWidth: 360,
                  padding: '8px 10px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  background: '#fff',
                }}
              />
            </div>

            {error && <p style={{ color: '#dc2626', margin: 0, padding: '10px 14px', borderBottom: '1px solid #fee2e2', background: '#fef2f2' }}>{error}</p>}

            {loading ? (
              <p style={{ color: '#64748b', margin: 0, padding: '14px' }}>불러오는 중...</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={th}>이름</th>
                    <th style={th}>아이디</th>
                    <th style={th}>연락처</th>
                    <th style={th}>부서/직책</th>
                    <th style={th}>권한</th>
                    <th style={th}>상태</th>
                    <th style={th}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr
                      key={s.userFarmId}
                      style={{ cursor: 'pointer' }}
                      onClick={() => openEditModal(s)}
                    >
                      <td style={td}>{s.fullName ?? '-'}</td>
                      <td style={td}>{s.username ?? '-'}</td>
                      <td style={td}>{s.phone ?? s.email ?? '-'}</td>
                      <td style={td}>{[s.department, s.position].filter(Boolean).join(' / ') || '-'}</td>
                      <td style={td}>{s.role}</td>
                      <td style={td}>{s.isActive ? '재직' : '비활성'}</td>
                      <td style={td}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(s);
                          }}
                          style={{
                            border: '1px solid #bfdbfe',
                            color: '#1d4ed8',
                            background: '#eff6ff',
                            borderRadius: 6,
                            padding: '4px 8px',
                            cursor: 'pointer',
                            marginRight: 6,
                          }}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(s.userFarmId, s.fullName ?? s.username ?? '직원');
                          }}
                          disabled={deletingId === s.userFarmId}
                          style={{
                            border: '1px solid #fecaca',
                            color: '#dc2626',
                            background: '#fff',
                            borderRadius: 6,
                            padding: '4px 8px',
                            cursor: deletingId === s.userFarmId ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {deletingId === s.userFarmId ? '처리중...' : '퇴사처리'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td style={tdEmpty} colSpan={7}>
                        등록된 직원이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {createModalOpen && (
            <div style={modalBackdropStyle} onClick={() => !creating && setCreateModalOpen(false)}>
              <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
                <h3 style={modalTitleStyle}>직원 등록</h3>
                <form onSubmit={onCreate} style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
                  <input placeholder="아이디 *" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} style={inputStyle} />
                  <input placeholder="비밀번호 *" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} style={inputStyle} />
                  <input placeholder="이름 *" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} style={inputStyle} />
                  <input placeholder="연락처" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} style={inputStyle} />
                  <input placeholder="이메일" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} style={inputStyle} />
                  <input placeholder="부서" value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} style={inputStyle} />
                  <input placeholder="직책" value={form.position} onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))} style={inputStyle} />
                  <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} style={inputStyle}>
                    <option value="staff">직원(staff)</option>
                    {!hasFarmAdmin && <option value="farm_admin">농장관리자(farm_admin)</option>}
                  </select>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={() => setCreateModalOpen(false)} style={secondaryBtnStyle}>취소</button>
                    <button type="submit" disabled={creating} style={primaryBtnStyle}>{creating ? '등록 중...' : '등록'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {editModalOpen && editingStaff && (
            <div style={modalBackdropStyle} onClick={() => savingId ? null : setEditModalOpen(false)}>
              <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
                <h3 style={modalTitleStyle}>직원 정보 수정</h3>
                <form onSubmit={onSaveEdit} style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
                  <input placeholder="이름 *" value={editForm.fullName} onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))} style={inputStyle} />
                  <input placeholder="연락처" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} style={inputStyle} />
                  <input placeholder="이메일" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} style={inputStyle} />
                  <select value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))} style={inputStyle}>
                    <option value="staff">staff</option>
                    {(editingStaff.role === 'farm_admin' || !hasFarmAdmin) && <option value="farm_admin">farm_admin</option>}
                  </select>
                  <input placeholder="부서" value={editForm.department} onChange={(e) => setEditForm((p) => ({ ...p, department: e.target.value }))} style={inputStyle} />
                  <input placeholder="직책" value={editForm.position} onChange={(e) => setEditForm((p) => ({ ...p, position: e.target.value }))} style={inputStyle} />
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => onDelete(editingStaff.userFarmId, editingStaff.fullName ?? editingStaff.username ?? '직원')}
                      disabled={deletingId === editingStaff.userFarmId}
                      style={{ ...dangerBtnStyle, opacity: deletingId === editingStaff.userFarmId ? 0.7 : 1 }}
                    >
                      {deletingId === editingStaff.userFarmId ? '처리중...' : '퇴사처리'}
                    </button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => setEditModalOpen(false)} style={secondaryBtnStyle}>닫기</button>
                      <button type="submit" disabled={savingId === editingStaff.userFarmId} style={primaryBtnStyle}>
                        {savingId === editingStaff.userFarmId ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const th: CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  borderBottom: '1px solid #e5e7eb',
  fontSize: 13,
  color: '#334155',
};

const td: CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #f1f5f9',
  fontSize: 14,
  color: '#0f172a',
};

const tdEmpty: CSSProperties = {
  ...td,
  textAlign: 'center',
  color: '#64748b',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  background: '#fff',
};

const modalBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalCardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 720,
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  padding: 20,
  boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
};

const modalTitleStyle: CSSProperties = {
  margin: '0 0 14px 0',
  fontSize: 18,
  color: '#0f172a',
};

const primaryBtnStyle: CSSProperties = {
  border: 'none',
  borderRadius: 8,
  background: '#1d4ed8',
  color: '#fff',
  padding: '8px 12px',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryBtnStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  background: '#fff',
  color: '#334155',
  padding: '8px 12px',
  fontWeight: 500,
  cursor: 'pointer',
};

const dangerBtnStyle: CSSProperties = {
  border: '1px solid #fecaca',
  borderRadius: 8,
  background: '#fff1f2',
  color: '#be123c',
  padding: '8px 12px',
  fontWeight: 600,
  cursor: 'pointer',
};
