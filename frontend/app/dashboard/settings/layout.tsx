'use client';

import { usePathname, useRouter } from 'next/navigation';

const SETTINGS_NAV = [
  { href: '/dashboard/settings', label: '농장 정보' },
  { href: '/dashboard/settings/staff', label: '직원 관리' },
  { href: '/dashboard/settings/schedule', label: '일정 관리' },
  { href: '/dashboard/settings/devices', label: '장치 관리' },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const SIDEBAR_WIDTH = 220;
  /** 상단 헤더 바로 아래 시작 (TopHeader minHeight 58 + 여유 2px) */
  const HEADER_OFFSET = 60;

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, background: '#f8fafc', fontFamily: '"Noto Sans KR", "Malgun Gothic", sans-serif' }}>
      <aside
        style={{
          position: 'fixed',
          left: 0,
          top: HEADER_OFFSET,
          bottom: 0,
          width: SIDEBAR_WIDTH,
          background: '#334155',
          padding: '16px 0',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          zIndex: 10,
        }}
      >
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 16 }}>
          {SETTINGS_NAV.map(({ href, label }) => {
            const active = pathname === href || (href !== '/dashboard/settings' && pathname?.startsWith(href));
            return (
              <button
                key={href}
                type="button"
                onClick={() => router.push(href)}
                style={{
                  display: 'block',
                  width: 'calc(100% - 16px)',
                  padding: '10px 15px 10px 16px',
                  margin: '0 8px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 15,
                  textAlign: 'right',
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
      </aside>
      <main style={{ flex: 1, minWidth: 0, marginLeft: SIDEBAR_WIDTH, padding: 24, overflow: 'auto', background: '#f8fafc' }}>
        {children}
      </main>
    </div>
  );
}
