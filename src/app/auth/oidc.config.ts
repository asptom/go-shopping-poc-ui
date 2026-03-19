import { OpenIdConfiguration } from 'angular-auth-oidc-client';
import { environment } from '../../environments/environment';

export function createAuthConfig(): OpenIdConfiguration {
  return {
    authority: environment.keycloak.issuer,
    clientId: environment.keycloak.clientId,
    redirectUrl: `${window.location.origin}/home`,
    postLogoutRedirectUri: window.location.origin,
    scope: environment.keycloak.scope,
    responseType: environment.keycloak.responseType,
    silentRenew: environment.keycloak.silentRenew,
    useRefreshToken: environment.keycloak.useRefreshToken,
    renewTimeBeforeTokenExpiresInSeconds: 30,
    unauthorizedRoute: '/home',
    customParamsAuthRequest: {
      prompt: 'consent',
    },
  };
}
