import { useEffect } from 'react';
import { getUserManager } from '../auth/oidc';

export default function CallbackPage() {
  useEffect(() => {
    getUserManager().signinRedirectCallback()
      .then(() => { window.location.href = '/'; })
      .catch(() => { window.location.href = '/'; });
  }, []);
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Обработка авторизации...</div>;
}
