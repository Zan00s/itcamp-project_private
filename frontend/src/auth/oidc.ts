import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

let _userManager: UserManager | null = null;

function getConfig() {
  const authority = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180/realms/elouav';
  const redirectUri = import.meta.env.VITE_REDIRECT_URI || window.location.origin + '/callback';
  const postLogoutUri = import.meta.env.VITE_POST_LOGOUT_URI || window.location.origin + '/login';
  return {
    authority,
    client_id: 'elouav-frontend',
    redirect_uri: redirectUri,
    post_logout_redirect_uri: postLogoutUri,
    response_type: 'code',
    scope: 'openid profile roles',
    userStore: new WebStorageStateStore({ store: window.localStorage }),
  };
}

export function getUserManager(): UserManager {
  if (!_userManager) {
    _userManager = new UserManager(getConfig());
  }
  return _userManager;
}

export async function login() {
  await getUserManager().signinRedirect();
}

export async function logout() {
  const mgr = getUserManager();
  try {
    const user = await mgr.getUser();
    if (user?.id_token) {
      await mgr.signoutRedirect({
        id_token_hint: user.id_token,
        post_logout_redirect_uri: import.meta.env.VITE_POST_LOGOUT_URI || window.location.origin + '/login',
      });
    } else {
      await mgr.removeUser();
      window.location.href = '/login';
    }
  } catch {
    try { await mgr.removeUser(); } catch { /* ignore */ }
    window.location.href = '/login';
  }
}

export async function getUser(): Promise<User | null> {
  try {
    return await getUserManager().getUser();
  } catch {
    return null;
  }
}

export async function handleCallback() {
  return await getUserManager().signinRedirectCallback();
}

export async function getAccessToken(): Promise<string | null> {
  const user = await getUser();
  return user?.access_token || null;
}

export function extractRoles(user: User | null): string[] {
  if (!user) return [];
  const profile = user.profile as any;
  const realmRoles: string[] = profile?.realm_access?.roles || [];
  const resourceAccess = profile?.resource_access || {};
  const clientRoles: string[] = Object.values(resourceAccess).flatMap((r: any) => r?.roles || []);
  return [...realmRoles, ...clientRoles];
}

export async function getUserRoles(): Promise<string[]> {
  return extractRoles(await getUser());
}

export async function hasRole(role: string): Promise<boolean> {
  return (await getUserRoles()).includes(role);
}
