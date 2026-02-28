import type { Metadata } from 'next';
import './globals.css';
import NonAdminShell from '@/components/NonAdminShell';

// data URL SVG 아이콘 (별도 요청 없이 favicon 제공)
const FAVICON_SVG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="%230f172a" rx="4"/><text x="16" y="22" font-size="18" text-anchor="middle">🐷</text></svg>'
  );

export const metadata: Metadata = {
  title: '양돈농장 관리 시스템',
  description: '양돈농장 운영 관리',
  icons: { icon: FAVICON_SVG },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <NonAdminShell>{children}</NonAdminShell>
      </body>
    </html>
  );
}
