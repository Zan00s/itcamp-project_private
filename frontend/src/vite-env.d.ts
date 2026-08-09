/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_KEYCLOAK_URL?: string;
  readonly VITE_REDIRECT_URI?: string;
  readonly VITE_NO_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
