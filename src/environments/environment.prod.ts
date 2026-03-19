export const environment = {
  production: true,
  apiUrl: 'https://api.pocstore.com/api/v1',
  keycloak: {
    issuer: 'https://auth.pocstore.com/realms/pocstore-realm',
    clientId: 'pocstore-client',
    scope: 'openid profile email',
    responseType: 'code',
    silentRenew: false,
    useRefreshToken: true,
  }
};
