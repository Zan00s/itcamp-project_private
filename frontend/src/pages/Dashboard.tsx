import { useEffect, useState } from 'react';
import { logout, getUser, getUserRoles } from '../auth/oidc';
import type { User } from 'oidc-client-ts';
import InstructorDashboard from './InstructorDashboard';
import MethodistPanel from './MethodistPanel';
import AdminPanel from './AdminPanel';
import ScenarioSelect from './ScenarioSelect';

const ROLE_LABELS: Record<string, string> = {
  student: 'Студент',
  instructor: 'Преподаватель',
  methodist: 'Методист',
  admin: 'Администратор',
};

type Tab = 'scenarios' | 'sessions' | 'manage' | 'admin';

export default function Dashboard() {
  const [userInfo, setUserInfo] = useState<{ name: string; role: string }>({ name: '', role: '' });
  const [roles, setRoles] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>('scenarios');

  useEffect(() => {
    getUser().then(async (u: User | null) => {
      if (u?.profile?.preferred_username) {
        const r = await getUserRoles();
        setRoles(r);
        const knownRole = r.find(rl => ROLE_LABELS[rl]);
        setUserInfo({
          name: u.profile.preferred_username as string,
          role: knownRole || 'student',
        });
        if (r.includes('instructor')) setTab('sessions');
        if (r.includes('methodist')) setTab('manage');
        if (r.includes('admin')) setTab('admin');
      }
    });
  }, []);

  const isStudent = roles.includes('student');
  const isInstructor = roles.includes('instructor');
  const isMethodist = roles.includes('methodist');
  const isAdmin = roles.includes('admin');

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'scenarios', label: 'Сценарии', show: isStudent || isAdmin },
    { id: 'sessions', label: 'Сессии', show: isInstructor || isAdmin },
    { id: 'manage', label: 'Управление', show: isMethodist || isAdmin },
    { id: 'admin', label: 'Админка', show: isAdmin },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', color: '#eee' }}>
      <div style={{
        padding: '0.75rem 2rem', background: '#16213e',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #333',
      }}>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>КТК ЭЛОУ-АВТ</h2>
          {tabs.filter(t => t.show).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '6px 16px',
                background: tab === t.id ? '#0f3460' : '#16213e',
                color: tab === t.id ? '#e94560' : '#aaa',
                border: '1px solid #333',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {userInfo.name && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 'bold' }}>{userInfo.name}</div>
              <div style={{ color: '#e94560', fontSize: '0.85rem' }}>
                {ROLE_LABELS[userInfo.role] || userInfo.role}
              </div>
            </div>
          )}
          <button onClick={logout} style={btnStyle}>Выйти</button>
        </div>
      </div>

      <div style={{ padding: '1.5rem' }}>
        {tab === 'scenarios' && (isStudent || isAdmin) && <ScenarioSelect embedded />}
        {tab === 'sessions' && (isInstructor || isAdmin) && <InstructorDashboard />}
        {tab === 'manage' && (isMethodist || isAdmin) && <MethodistPanel />}
        {tab === 'admin' && isAdmin && <AdminPanel />}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '6px 16px',
  background: '#16213e',
  color: '#eee',
  border: '1px solid #333',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.9rem',
};
