'use client';

import { usePathname } from 'next/navigation';
import { me, logout, updateAdminUser, type UpdateUserBody } from '@/lib/api';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopHeader from '@/components/TopHeader';

type UserShape = { id: string; fullName: string; username: string; email?: string | null; phone?: string | null };

const formStyle = {
  marginBottom: 12,
  display: 'block' as const,
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  fontSize: 14,
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserShape | null>(null);
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
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [farmEnvMenuOpen, setFarmEnvMenuOpen] = useState(false);

  function loadUser() {
    return me()
      .then((d) => setUser(d.user as UserShape))
      .catch(() => router.push('/login'));
  }

  useEffect(() => {
    loadUser().finally(() => setReady(true));
  }, [router]);

  useEffect(() => {
    setFarmEnvMenuOpen(false);
    setSettingsMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (pathname.startsWith('/admin/settings')) setSettingsMenuOpen(true);
  }, [pathname]);
  useEffect(() => {
    if (pathname.startsWith('/admin/farms') || pathname.startsWith('/admin/breeds') || pathname.startsWith('/admin/structure-templates') || pathname.startsWith('/admin/schedule-work-plans')) setFarmEnvMenuOpen(true);
  }, [pathname]);

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
        loadUser(); // 사용자 정보 갱신
      })
      .catch((e) => setProfileError(e instanceof Error ? e.message : '저장에 실패했습니다.'))
      .finally(() => setProfileSubmitting(false));
  }

  if (!ready) return <div style={{ padding: 24 }}>로딩 중...</div>;
  if (!user) return null;

  const nav = [
    { href: '/admin', label: '대시보드' },
    { href: '/admin/users', label: '회원 관리' },
    {
      label: '농장 환경 설정',
      menuKey: 'farmEnv' as const,
      children: [
        { href: '/admin/farms', label: '농장 목록' },
        { href: '/admin/structure-templates', label: '농장 구조 설정' },
        { href: '/admin/schedule-work-plans', label: '기초 일정관리' },
        { href: '/admin/breeds', label: '품종관리' },
      ],
    },
    {
      label: '시스템 설정',
      menuKey: 'settings' as const,
      children: [
        { href: '/admin/settings', label: '계정 설정' },
      ],
    },
  ];

  const isUserFarmsPage = pathname != null && /^\/admin\/users\/[^/]+\/farms\/?$/.test(pathname);
  if (isUserFarmsPage) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <TopHeader />
        <div style={{ flex: 1 }}>{children}</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#f8fafc' }}>
      {/* 좌측 사이드바 - 다크 블루 */}
      <aside
        className="admin-sidebar"
        style={{
          width: 250,
          minHeight: '100vh',
          background: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <button type="button" onClick={() => router.push('/admin')} style={{ textDecoration: 'none', color: 'inherit', border: 'none', background: 'none', cursor: 'pointer', padding: 0, width: '100%', textAlign: 'left' }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>🐷 양돈 농장 관리 시스템</span>
          </button>
        </div>
        <nav className="admin-sidebar-nav" style={{ flex: 1, padding: '12px 0' }}>
          {nav.map((item) => {
            if ('children' in item) {
              const menuKey = item.menuKey ?? 'settings';
              const isOpen = menuKey === 'farmEnv' ? farmEnvMenuOpen : settingsMenuOpen;
              const isActive = menuKey === 'farmEnv'
                ? pathname.startsWith('/admin/farms') || pathname.startsWith('/admin/breeds') || pathname.startsWith('/admin/structure-templates') || pathname.startsWith('/admin/schedule-work-plans')
                : pathname.startsWith('/admin/settings');
              return (
                <div key={item.label} style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const nextOpen = !isOpen;
                      if (menuKey === 'farmEnv') {
                        setFarmEnvMenuOpen(nextOpen);
                        if (nextOpen) setSettingsMenuOpen(false);
                      } else {
                        setSettingsMenuOpen(nextOpen);
                        if (nextOpen) setFarmEnvMenuOpen(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      margin: '0 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      border: 'none',
                      background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                      cursor: 'pointer',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.85)',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 10 }}>{isOpen ? 'v' : '>'}</span>
                    {item.label}
                  </button>
                  {isOpen && (item.children ?? []).map(({ href, label }) => {
                    const active = pathname === href || pathname.startsWith(href + '/');
                    return (
                      <button
                        type="button"
                        key={`${href}-${label}`}
                        onClick={() => router.push(href)}
                        className="admin-sidebar-link"
                        style={{
                          display: 'block',
                          width: 'calc(100% - 24px)',
                          padding: '8px 16px 8px 24px',
                          margin: '2px 12px',
                          borderRadius: 6,
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 13,
                          textAlign: 'left',
                          color: active ? '#fff' : 'rgba(255,255,255,0.85)',
                          fontWeight: active ? 600 : 500,
                          background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              );
            }
            const { href, label } = item as { href: string; label: string };
            const active = pathname === href || (href !== '/admin' && pathname.startsWith(href));
            return (
              <button
                type="button"
                key={href}
                onClick={() => router.push(href)}
                className="admin-sidebar-link"
                style={{
                  display: 'block',
                  width: 'calc(100% - 24px)',
                  padding: '10px 16px',
                  margin: '2px 12px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  textAlign: 'left',
                  color: active ? '#fff' : 'rgba(255,255,255,0.85)',
                  fontWeight: active ? 600 : 500,
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                }}
              >
                {label}
              </button>
            );
          })}
        </nav>
        <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
            시스템관리자
          </div>
          <button
            type="button"
            onClick={openProfileModal}
            style={{
              width: '100%',
              padding: 0,
              margin: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              font: 'inherit',
              color: '#93c5fd',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {user.fullName}
          </button>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2, marginBottom: 10 }}>
            @{user.username}
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 500,
              background: 'transparent',
              color: 'rgba(255,255,255,0.9)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            로그아웃
          </button>
        </div>
      </aside>
      {/* 메인 영역 - 밝은 배경 */}
      <main style={{ flex: 1, padding: '24px 40px 24px 24px', overflow: 'auto', background: '#fff' }}>
        {children}
      </main>

      {/* 시스템관리자 정보 수정 모달 */}
      {profileModalOpen && (
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
            <h3 style={{ marginTop: 0, marginBottom: 20 }}>시스템관리자 정보 수정</h3>
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
                    background: '#111',
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
    </div>
  );
}

