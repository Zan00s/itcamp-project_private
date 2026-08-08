import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

const keycloakConfig = {
  authority: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180/realms/elouav',
  client_id: 'elouav-frontend',
  redirect_uri: import.meta.env.VITE_REDIRECT_URI || 'http://localhost:5173/callback',
  post_logout_redirect_uri: import.meta.env.VITE_REDIRECT_URI || 'http://localhost:5173',
  response_type: 'code',
  scope: 'openid profile roles',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
};

export const userManager = new UserManager(keycloakConfig);

export async function login() {
  await userManager.signinRedirect();
}

export async function logout() {
  await userManager.signoutRedirect();
}

export async function getUser() {
  return await userManager.getUser();
}

export async function handleCallback() {
  return await userManager.signinRedirectCallback();
}
