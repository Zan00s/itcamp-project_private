import { useEffect } from 'react';
import { userManager } from '../auth/oidc';

export default function CallbackPage() {
  useEffect(() => {
    userManager.signinRedirectCallback()
      .then(() => { window.location.href = '/'; })
      .catch(() => { window.location.href = '/login'; });
  }, []);
  return <div>Обработка авторизации...</div>;
}
