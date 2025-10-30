import { OpenIdConfiguration } from 'angular-auth-oidc-client';

export const authConfig: OpenIdConfiguration = {
  authority: 'https://keycloak.local/realms/pocstore-realm',
  redirectUrl: window.location.origin + '/home',
  postLogoutRedirectUri: window.location.origin,
  clientId: 'pocstore-client',
  scope: 'openid profile email',
  responseType: 'code',
  silentRenew: false,
  useRefreshToken: true,
  renewTimeBeforeTokenExpiresInSeconds: 30,

  unauthorizedRoute: '/home',
  customParamsAuthRequest: {
    prompt: 'consent',
  },

};