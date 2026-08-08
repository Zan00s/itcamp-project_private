import { useEffect } from 'react';
import { login } from '../auth/oidc';

export default function LoginScreen() {
  useEffect(() => {
    import('../auth/oidc').then(m => m.getUser()).then((u) => {
      if (u && !u.expired) window.location.href = '/';
    });
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', background: '#1a1a2e', color: '#eee',
    }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>КТК ЭЛОУ-АВ</h1>
      <p style={{ color: '#aaa', marginBottom: '2rem' }}>Компьютерный тренажёрный комплекс</p>
      <button onClick={login} style={{
        padding: '12px 48px', fontSize: '1.2rem', background: '#0f3460',
        color: '#e94560', border: '2px solid #e94560', borderRadius: '8px', cursor: 'pointer',
      }}>
        Войти через Keycloak
      </button>
    </div>
  );
}
