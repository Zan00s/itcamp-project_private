import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

let _userManager: UserManager | null = null;

function clearAuthStorageEntries(storage: Storage) {
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && /oidc|userManager|auth/i.test(key)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => storage.removeItem(key));
}

function clearAuthState() {
  clearAuthStorageEntries(window.localStorage);
  clearAuthStorageEntries(window.sessionStorage);
}

function getConfig() {
  const authority = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180/realms/elouav';
  const redirectUri = import.meta.env.VITE_REDIRECT_URI || window.location.origin + '/callback';
  const postLogoutUri = import.meta.env.VITE_POST_LOGOUT_URI || window.location.origin + '/';
  return {
    authority,
    client_id: 'elouav-frontend',
    redirect_uri: redirectUri,
    post_logout_redirect_uri: postLogoutUri,
    response_type: 'code',
    scope: 'openid profile roles',
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
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
  const postLogoutUri = import.meta.env.VITE_POST_LOGOUT_URI || window.location.origin + '/';

  try {
    const user = await mgr.getUser();
    clearAuthState();
    try {
      await mgr.removeUser();
    } catch {
      // ignore
    }
    try {
      mgr.stopSilentRenew();
    } catch {
      // ignore
    }

    if (user?.id_token) {
      await mgr.signoutRedirect({
        id_token_hint: user.id_token,
        post_logout_redirect_uri: postLogoutUri,
      });
      return;
    }
  } catch {
    clearAuthState();
  }

  window.location.replace(postLogoutUri);
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
