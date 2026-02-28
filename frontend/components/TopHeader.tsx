'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { me, logout, updateAdminUser, getFarm, type UpdateUserBody } from '@/lib/api';

const formStyle = {
  marginBottom: 12,
  display: 'block' as const,
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  fontSize: 14,
};

type UserShape = { id: string; fullName: string; systemRole: string; username: string; email?: string | null; phone?: string | null };

const DASHBOARD_NAV = [
  { href: '/dashboard', label: '실시간 모니터링' },
  { href: '/dashboard/schedule', label: '일정' },
  { href: '/dashboard/move', label: '이동' },
  { href: '/dashboard/report', label: '리포트' },
  { href: '/dashboard/settings', label: '환경 설정' },
];

export default function TopHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const isDashboard = pathname != null && pathname.startsWith('/dashboard');
  const [user, setUser] = useState<UserShape | null>(null);
  const [position, setPosition] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<UpdateUserBody & { password: string }>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [profileError, setProfileError] = useState('');
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [currentFarmName, setCurrentFarmName] = useState<string | null>(null);

  function loadUser() {
    return me()
      .then((d) => {
        setUser(d.user as UserShape);
        setPosition(d.position ?? null);
      })
      .catch(() => {
        setUser(null);
        setPosition(null);
      });
  }

  useEffect(() => {
    loadUser().finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!isDashboard || typeof window === 'undefined') {
      setCurrentFarmName(null);
      return;
    }
    const farmId = localStorage.getItem('currentFarmId');
    const name = localStorage.getItem('currentFarmName');
    if (name) {
      setCurrentFarmName(name);
      return;
    }
    // 환경 설정 페이지에서 중복 호출을 막기 위해 농장명 자동 조회를 건너뜀
    if (pathname?.startsWith('/dashboard/settings')) {
      setCurrentFarmName(null);
      return;
    }
    if (farmId) {
      getFarm(farmId)
        .then((f) => {
          setCurrentFarmName(f.farmName);
          localStorage.setItem('currentFarmName', f.farmName);
        })
        .catch(() => {
          setCurrentFarmName(null);
          localStorage.removeItem('currentFarmId');
          localStorage.removeItem('currentFarmName');
        });
    } else {
      setCurrentFarmName(null);
    }
  }, [isDashboard, pathname]);

  async function handleLogout() {
    await logout();
    router.push('/login');
    router.refresh();
  }

  function openProfileModal() {
    if (!user) return;
    setProfileModalOpen(true);
    setProfileError('');
    setProfileForm({
      fullName: user.fullName,
      email: user.email ?? '',
      phone: user.phone ?? '',
      password: '',
    });
  }

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setProfileError('');
    const body: UpdateUserBody = {
      fullName: profileForm.fullName?.trim() || undefined,
      email: profileForm.email?.trim() || undefined,
      phone: profileForm.phone?.trim() || undefined,
    };
    if (profileForm.password) {
      if (profileForm.password.length < 8) {
        setProfileError('비밀번호는 최소 8자 이상이어야 합니다.');
        return;
      }
      body.password = profileForm.password;
    }
    setProfileSubmitting(true);
    updateAdminUser(user.id, body)
      .then(() => {
        setProfileModalOpen(false);
        loadUser();
      })
      .catch((e) => setProfileError(e instanceof Error ? e.message : '저장에 실패했습니다.'))
      .finally(() => setProfileSubmitting(false));
  }

  return (
    <>
      <header
        style={{
          width: '100%',
          padding: '12px 24px',
          minHeight: 58,
          background: '#0f172a',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          flexWrap: 'wrap',
          gap: 16,
          position: 'relative',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 150 }}>
          <button
            type="button"
            onClick={() => router.push(user ? '/dashboard' : '/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              color: '#fff',
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: 22 }}>🐷</span>
            <span>양돈 농장 관리 시스템</span>
          </button>
          {isDashboard && user && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {DASHBOARD_NAV.map(({ href, label }) => (
                <button
                  type="button"
                  key={href}
                  onClick={() => router.push(href)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: pathname === href ? 600 : 500,
                    color: pathname === href ? '#fff' : 'rgba(255,255,255,0.85)',
                    background: pathname === href ? 'rgba(255,255,255,0.15)' : 'transparent',
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {ready && (
            user ? (
              <>
                {isDashboard && (
                  <>
                    {currentFarmName && (
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          color: '#fff',
                          marginRight: 12,
                          padding: '8px 14px',
                          borderRadius: 8,
                          background: 'rgba(59, 130, 246, 0.85)',
                        }}
                      >
                        {currentFarmName}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => router.push('/select-farm')}
                      style={{
                        fontSize: 14,
                        color: 'rgba(255,255,255,0.9)',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        padding: '6px 10px',
                        borderRadius: 6,
                      }}
                    >
                      농장 변경
                    </button>
                  </>
                )}
                {user.systemRole === 'system_admin' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => router.push('/admin')}
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: '#e2e8f0',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        padding: '6px 10px',
                        borderRadius: 6,
                      }}
                    >
                      시스템관리자
                    </button>
                    <button
                      type="button"
                      onClick={openProfileModal}
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: '#e2e8f0',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '6px 10px',
                        borderRadius: 6,
                      }}
                    >
                      {user.fullName}
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 16, fontWeight: 500, color: '#e2e8f0' }}>
                      {user.systemRole === 'super_admin' ? '운영관리자' : (position ?? '-')}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 500, color: '#e2e8f0' }}>{user.fullName}</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    padding: '6px 12px',
                    fontSize: 14,
                    background: 'transparent',
                    color: '#e2e8f0',
                    border: '1px solid #64748b',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  로그아웃
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => router.push('/login')}
                style={{
                  fontSize: 14,
                  color: '#e2e8f0',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  border: '1px solid #64748b',
                  borderRadius: 6,
                }}
              >
                로그인
              </button>
            )
          )}
        </div>
      </header>

      {profileModalOpen && user && (
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
          onClick={() => !profileSubmitting && setProfileModalOpen(false)}
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
            <h3 style={{ marginTop: 0, marginBottom: 20 }}>개인정보 수정</h3>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>사용자명: {user.username}</p>
            <form onSubmit={handleProfileSubmit}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#374151' }}>이름 *</label>
              <input
                type="text"
                value={profileForm.fullName ?? ''}
                onChange={(e) => setProfileForm((f) => ({ ...f, fullName: e.target.value }))}
                style={formStyle}
                placeholder="이름"
              />
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#374151' }}>이메일</label>
              <input
                type="email"
                value={profileForm.email ?? ''}
                onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                style={formStyle}
                placeholder="email@example.com"
              />
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#374151' }}>전화번호</label>
              <input
                type="text"
                value={profileForm.phone ?? ''}
                onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                style={formStyle}
                placeholder="010-0000-0000"
              />
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#374151' }}>비밀번호 변경(비워두면 유지)</label>
              <input
                type="password"
                value={profileForm.password}
                onChange={(e) => setProfileForm((f) => ({ ...f, password: e.target.value }))}
                style={formStyle}
                placeholder="8자 이상 입력 시 변경"
                autoComplete="new-password"
              />
              {profileError && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{profileError}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button
                  type="submit"
                  disabled={profileSubmitting}
                  style={{
                    padding: '10px 20px',
                    background: '#0f172a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 14,
                    cursor: profileSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {profileSubmitting ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  disabled={profileSubmitting}
                  onClick={() => setProfileModalOpen(false)}
                  style={{
                    padding: '10px 20px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 14,
                    cursor: profileSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

