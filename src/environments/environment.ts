// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  apiUrl: 'https://pocstore.local/api/v1',
  keycloak: {
    issuer: 'https://keycloak.local/realms/pocstore-realm',
    clientId: 'pocstore-client',
    scope: 'openid profile email',
    responseType: 'code',
    silentRenew: false,
    useRefreshToken: true,
  }
};
