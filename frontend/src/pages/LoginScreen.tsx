import { useEffect } from 'react';
import { Button } from '@consta/uikit/Button';
import { Card } from '@consta/uikit/Card';
import { Text } from '@consta/uikit/Text';
import { login, getUser, getUserManager } from '../auth/oidc';

export default function LoginScreen() {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('state')) {
      getUserManager().signoutRedirectCallback().catch(() => {}).finally(() => {
        getUserManager().removeUser().then(() => { window.location.href = '/login'; });
      });
      return;
    }
    getUser().then((u) => {
      if (u && !u.expired) window.location.href = '/';
    });
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card col={1} verticalSpace="3xl" horizontalSpace="3xl" style={{ width: 420, textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <div>
            <Text as="h1" size="2xl" weight="bold" style={{ color: '#1677ff', marginBottom: 8 }}>
              КТК ЭЛОУ-АВТ
            </Text>
            <Text as="p" size="m" view="ghost">
              Компьютерный тренажёрный комплекс
            </Text>
            <Text as="p" size="s" view="ghost">
              Электродегидрация и обессоливание
            </Text>
          </div>
          <Button label="Войти через Keycloak" size="l" view="primary" width="full" onClick={login} />
        </div>
      </Card>
    </div>
  );
}
