export const environment = {
  production: true,
  apiUrl: 'https://api.pocstore.com/customers',
  keycloak: {
    issuer: 'https://auth.pocstore.com/realms/pocstore-realm',
    redirectUri: window.location.origin,
    clientId: 'go-shopping-poc-ui',
    scope: 'openid profile email',
    responseType: 'code',
    silentRenew: true,
    useRefreshToken: true,
    ignoreNonce: true,
    logLevel: 'warn'
  }
};