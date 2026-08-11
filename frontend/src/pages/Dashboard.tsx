import { useEffect, useState } from 'react';
import { Button } from '@consta/uikit/Button';
import { Text } from '@consta/uikit/Text';
import { Avatar } from '@consta/uikit/Avatar';
import { Card } from '@consta/uikit/Card';
import { Tabs } from '@consta/uikit/Tabs';
import { IconExit } from '@consta/icons/IconExit';
import { IconSun } from '@consta/icons/IconSun';
import { IconMoon } from '@consta/icons/IconMoon';
import { logout, getUser, getUserRoles } from '../auth/oidc';
import { useThemeMode } from '../theme/ThemeContext';
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
  const { mode, toggle } = useThemeMode();
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

  const tabItems = ([
    { value: 'scenarios', label: 'Сценарии', show: isStudent || isAdmin },
    { value: 'sessions', label: 'Сессии', show: isInstructor || isAdmin },
    { value: 'manage', label: 'Управление', show: isMethodist || isAdmin },
    { value: 'admin', label: 'Админка', show: isAdmin },
  ] as const).filter(t => t.show);

  const isDark = mode === 'dark';
  const bgColor = isDark ? '#1a1a2e' : '#f0f2f5';
  const headerBg = isDark ? '#16213e' : '#ffffff';
  const titleColor = isDark ? '#64b5f6' : '#1677ff';

  return (
    <div style={{ minHeight: '100vh', background: bgColor }}>
      <Card
        col={1}
        verticalSpace="s"
        horizontalSpace="xl"
        style={{ borderRadius: 0, background: headerBg, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flex: 1 }}>
          <Text as="h2" size="l" weight="bold" style={{ color: titleColor, margin: 0 }}>
            КТК ЭЛОУ-АВТ
          </Text>
          <Tabs
            items={tabItems as any}
            value={tab as any}
            getItemKey={(item: any) => item.value}
            getItemLabel={(item: any) => item.label}
            onChange={({ value }: any) => setTab(value as Tab)}
            size="m"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            label=""
            size="s"
            view="ghost"
            iconLeft={isDark ? IconSun : IconMoon}
            onClick={toggle}
            title={isDark ? 'Светлая тема' : 'Тёмная тема'}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar size="s" name={userInfo.name} />
            <div style={{ lineHeight: 1.2 }}>
              <Text size="s" weight="medium">{userInfo.name}</Text>
              <Text size="xs" view="ghost">{ROLE_LABELS[userInfo.role] || userInfo.role}</Text>
            </div>
          </div>
          <Button label="Выйти" size="s" view="ghost" iconLeft={IconExit} onClick={logout} />
        </div>
      </Card>

      <div style={{ padding: 24 }}>
        {tab === 'scenarios' && (isStudent || isAdmin) && <ScenarioSelect embedded />}
        {tab === 'sessions' && (isInstructor || isAdmin) && <InstructorDashboard />}
        {tab === 'manage' && (isMethodist || isAdmin) && <MethodistPanel />}
        {tab === 'admin' && isAdmin && <AdminPanel />}
      </div>
    </div>
  );
}
