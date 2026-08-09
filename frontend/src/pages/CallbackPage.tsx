import { useEffect } from 'react';
import { getUserManager } from '../auth/oidc';

export default function CallbackPage() {
  useEffect(() => {
    getUserManager().signinRedirectCallback()
      .then(() => { window.location.href = '/'; })
      .catch(() => { window.location.href = '/login'; });
  }, []);
  return <div>Обработка авторизации...</div>;
}
