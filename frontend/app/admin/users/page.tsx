'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminUsers, createAdminUser, updateAdminUser, type UserListItem, type CreateUserBody, type UpdateUserBody } from '@/lib/api';

const formStyle = {
  marginBottom: 12,
  display: 'block' as const,
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  fontSize: 14,
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateUserBody>({
    username: '',
    fullName: '',
    email: '',
    password: '',
    phone: '',
  });
  const [editForm, setEditForm] = useState<UpdateUserBody & { password: string }>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
  });

  function loadUsers() {
    getAdminUsers()
      .then((d) => setUsers(d.users.filter((u) => u.systemRole !== 'system_admin')))
      .catch((e) => setError(e instanceof Error ? e.message : '목록 조회 실패'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function openModal() {
    setEditingUser(null);
    setModalOpen(true);
    setSubmitError('');
    setForm({ username: '', fullName: '', email: '', password: '', phone: '' });
  }

  function openEditModal(user: UserListItem) {
    setEditingUser(user);
    setSubmitError('');
    setEditForm({
      fullName: user.fullName,
      email: user.email ?? '',
      phone: user.phone ?? '',
      password: '',
    });
  }

  function closeModals() {
    setModalOpen(false);
    setEditingUser(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    if (!form.username.trim() || !form.fullName.trim() || !form.email.trim() || !form.password) {
      setSubmitError('사용자명, 이름, 이메일, 비밀번호를 모두 입력해 주세요.');
      return;
    }
    if (form.password.length < 8) {
      setSubmitError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }
    setSubmitting(true);
    createAdminUser({
      username: form.username.trim(),
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      password: form.password,
      phone: form.phone?.trim() || undefined,
    })
      .then(() => {
        closeModals();
        loadUsers();
      })
      .catch((e) => setSubmitError(e instanceof Error ? e.message : '회원 추가 실패'))
      .finally(() => setSubmitting(false));
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitError('');
    const body: UpdateUserBody = {
      fullName: editForm.fullName?.trim() || undefined,
      email: editForm.email?.trim() || undefined,
      phone: editForm.phone?.trim() || undefined,
    };
    if (editForm.password) {
      if (editForm.password.length < 8) {
        setSubmitError('비밀번호는 최소 8자 이상이어야 합니다.');
        return;
      }
      body.password = editForm.password;
    }
    setSubmitting(true);
    updateAdminUser(editingUser.id, body)
      .then(() => {
        closeModals();
        loadUsers();
      })
      .catch((e) => setSubmitError(e instanceof Error ? e.message : '회원 수정 실패'))
      .finally(() => setSubmitting(false));
  }

  if (loading) return <div>로딩 중...</div>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>회원 관리</h2>
        <button
          type="button"
          onClick={openModal}
          style={{
            padding: '8px 16px',
            background: '#111',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          회원 추가
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>사용자명</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>이름</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>이메일</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>전화번호</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>권한</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}>상태</th>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#64748b' }}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer' }}
                onClick={() => openEditModal(u)}
              >
                <td style={{ padding: 12 }}>{u.username}</td>
                <td style={{ padding: 12 }}>{u.fullName}</td>
                <td style={{ padding: 12 }}>{u.email ?? '-'}</td>
                <td style={{ padding: 12 }}>{u.phone ?? '-'}</td>
                <td style={{ padding: 12 }}>{u.systemRole}</td>
                <td style={{ padding: 12 }}>{u.isActive ? '활성' : '비활성'}</td>
                <td style={{ padding: 12 }} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => router.push(`/admin/users/${u.id}/farms`)}
                    style={{ fontSize: 14, color: '#2563eb', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    농장 배정
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p style={{ padding: 24, color: '#64748b' }}>등록된 회원이 없습니다.</p>}
      </div>

      {(modalOpen || editingUser) && (
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
              padding: 24,
              width: '100%',
              maxWidth: 400,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {editingUser ? (
              <>
                <h3 style={{ marginTop: 0, marginBottom: 20 }}>회원 수정</h3>
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>사용자명: {editingUser.username}</p>
                <form onSubmit={handleEditSubmit}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#374151' }}>이름 *</label>
                  <input
                    type="text"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                    style={formStyle}
                    placeholder="이름"
                  />
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#374151' }}>이메일 *</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    style={formStyle}
                    placeholder="email@example.com"
                  />
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#374151' }}>전화번호 (선택)</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    style={formStyle}
                    placeholder="010-0000-0000"
                  />
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#374151' }}>비밀번호 변경(비워두면 유지)</label>
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                    style={formStyle}
                    placeholder="8자 이상 입력 시 변경"
                    autoComplete="new-password"
                  />
                  {submitError && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{submitError}</p>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        padding: '10px 20px',
                        background: '#111',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 14,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {submitting ? '저장 중...' : '저장'}
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={closeModals}
                      style={{
                        padding: '10px 20px',
                        background: '#f3f4f6',
                        color: '#374151',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 14,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      취소
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0, marginBottom: 20 }}>회원 추가</h3>
                <form onSubmit={handleSubmit}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#374151' }}>사용자명 *</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                style={formStyle}
                placeholder="로그인 ID"
                autoComplete="username"
              />
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#374151' }}>이름 *</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                style={formStyle}
                placeholder="이름"
              />
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#374151' }}>이메일 *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                style={formStyle}
                placeholder="email@example.com"
                autoComplete="email"
              />
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#374151' }}>비밀번호 * (8자 이상)</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                style={formStyle}
                placeholder="비밀번호"
                autoComplete="new-password"
              />
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#374151' }}>전화번호 (선택)</label>
              <input
                type="text"
                value={form.phone ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                style={formStyle}
                placeholder="010-0000-0000"
              />
              {submitError && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{submitError}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    background: '#111',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 14,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? '등록 중...' : '등록'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={closeModals}
                  style={{
                    padding: '10px 20px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 14,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  취소
                </button>
              </div>
            </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

