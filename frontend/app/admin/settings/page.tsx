'use client';

import { useEffect, useState } from 'react';
import { getConnectionSettings, saveConnectionSettings } from '@/lib/api';

export default function AdminSettingsPage() {
  const [conn, setConn] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getConnectionSettings()
      .then((d) => {
        const c = d.connection;
        setConn({
          serverUrl: c.serverUrl ?? '',
          serverUser: c.serverUser ?? '',
          serverPassword: '',
          dbHost: c.dbHost ?? '',
          dbPort: c.dbPort ?? '',
          dbName: c.dbName ?? '',
          dbUser: c.dbUser ?? '',
          dbPassword: '',
        });
      })
      .catch(() => setMessage('연결 설정을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      await saveConnectionSettings(conn);
      setMessage('저장되었습니다. 서버 재시작 후 적용됩니다.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div>로딩 중...</div>;

  return (
    <>
      <h2 style={{ marginBottom: 16 }}>연결 설정</h2>
      <p style={{ color: '#64748b', marginBottom: 16 }}>서버·DB 주소와 접근 정보를 수정할 수 있습니다. 저장 후 Go API 서버를 재시작하면 적용됩니다.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 16 }}>
        {(['serverUrl', 'serverUser', 'serverPassword', 'dbHost', 'dbPort', 'dbName', 'dbUser', 'dbPassword'] as const).map((key) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>
              {key === 'serverUrl' && '서버 주소'}
              {key === 'serverUser' && '서버 접근 아이디'}
              {key === 'serverPassword' && '서버 접근 암호'}
              {key === 'dbHost' && 'DB 주소'}
              {key === 'dbPort' && 'DB 포트'}
              {key === 'dbName' && 'DB 이름'}
              {key === 'dbUser' && 'DB 접근 아이디'}
              {key === 'dbPassword' && 'DB 접근 암호'}
            </label>
            <input
              type={key.includes('Password') ? 'password' : 'text'}
              value={conn[key] ?? ''}
              onChange={(e) => setConn((p) => ({ ...p, [key]: e.target.value }))}
              style={{ width: '100%', padding: 8, border: '1px solid #e2e8f0', borderRadius: 6 }}
            />
          </div>
        ))}
      </div>
      <button onClick={handleSave} disabled={saving} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer' }}>
        {saving ? '저장 중...' : '저장'}
      </button>
      {message && <p style={{ marginTop: 12, color: message.startsWith('저장') ? '#10b981' : '#ef4444' }}>{message}</p>}
    </>
  );
}
